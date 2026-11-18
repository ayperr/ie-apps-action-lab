-- Session 3: synthetic scenario assumptions, separate from frozen booking facts.
begin;
create table public.mint_lab_upgrade_policy (
  departure_id text primary key references public.mint_lab_departures(id),
  upgrade_fee_usd integer not null default 450 check (upgrade_fee_usd between 250 and 1200 and upgrade_fee_usd % 50 = 0),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.mint_lab_upgrade_policy enable row level security;
revoke all on public.mint_lab_upgrade_policy from anon, authenticated;
grant select on public.mint_lab_upgrade_policy to anon, authenticated;
create policy "Synthetic scenario assumptions are readable" on public.mint_lab_upgrade_policy for select to anon, authenticated using (true);
grant select, update on public.mint_lab_upgrade_policy to service_role;

create table public.mint_lab_upgrade_policy_audit (
  request_id uuid primary key,
  departure_id text not null references public.mint_lab_upgrade_policy(departure_id),
  old_fee_usd integer not null,
  new_fee_usd integer not null,
  old_revision integer not null,
  new_revision integer not null,
  reason text not null check (char_length(btrim(reason)) between 12 and 1000),
  saved_at timestamptz not null default now()
);
create index mint_policy_audit_departure on public.mint_lab_upgrade_policy_audit(departure_id, saved_at);
alter table public.mint_lab_upgrade_policy_audit enable row level security;
revoke all on public.mint_lab_upgrade_policy_audit from anon, authenticated;
grant select, insert on public.mint_lab_upgrade_policy_audit to service_role;

-- Explicitly seeded teaching default, matching the existing browser scenario.
insert into public.mint_lab_upgrade_policy(departure_id) select id from public.mint_lab_departures;

create function public.mint_lab_save_upgrade_fee(
  p_departure_id text, p_expected_revision integer, p_expected_fee integer,
  p_new_fee integer, p_reason text, p_request_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_row public.mint_lab_upgrade_policy%rowtype;
  previous public.mint_lab_upgrade_policy_audit%rowtype;
begin
  if p_departure_id is null or p_expected_revision is null or p_expected_fee is null
     or p_new_fee is null or p_reason is null or p_request_id is null
     or p_new_fee < 250 or p_new_fee > 1200 or p_new_fee % 50 <> 0
     or char_length(btrim(p_reason)) not between 12 and 1000 then
    return jsonb_build_object('state','rejected','message','Invalid scenario adjustment.');
  end if;
  select * into current_row from public.mint_lab_upgrade_policy where departure_id=p_departure_id for update;
  if not found then return jsonb_build_object('state','rejected','message','Departure not found.'); end if;
  select * into previous from public.mint_lab_upgrade_policy_audit where request_id=p_request_id;
  if found then
    if previous.departure_id=p_departure_id and previous.old_fee_usd=p_expected_fee
       and previous.old_revision=p_expected_revision and previous.new_fee_usd=p_new_fee and previous.reason=btrim(p_reason) then
      return jsonb_build_object('state','saved','replayed',true,'receipt',to_jsonb(previous),'record',to_jsonb(current_row));
    end if;
    return jsonb_build_object('state','conflict','message','Request ID belongs to different content.');
  end if;
  if current_row.revision<>p_expected_revision or current_row.upgrade_fee_usd<>p_expected_fee then
    return jsonb_build_object('state','conflict','message','Saved fee changed. Reload and reconsider your proposal.','record',to_jsonb(current_row));
  end if;
  if p_new_fee=current_row.upgrade_fee_usd then
    return jsonb_build_object('state','rejected','message','Choose a different fee before saving.');
  end if;
  update public.mint_lab_upgrade_policy set upgrade_fee_usd=p_new_fee, revision=revision+1, updated_at=now()
    where departure_id=p_departure_id returning * into current_row;
  insert into public.mint_lab_upgrade_policy_audit(request_id,departure_id,old_fee_usd,new_fee_usd,old_revision,new_revision,reason)
    values(p_request_id,p_departure_id,p_expected_fee,p_new_fee,p_expected_revision,current_row.revision,btrim(p_reason)) returning * into previous;
  return jsonb_build_object('state','saved','replayed',false,'receipt',to_jsonb(previous),'record',to_jsonb(current_row));
end;
$$;
revoke all on function public.mint_lab_save_upgrade_fee(text,integer,integer,integer,text,uuid) from public, anon, authenticated;
grant execute on function public.mint_lab_save_upgrade_fee(text,integer,integer,integer,text,uuid) to service_role;
commit;

