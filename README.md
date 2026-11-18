MINT REVENUE LAB — WORKING SUPABASE + VERCEL APP

BLOCK 3 / CONTEXTUAL EMAIL
Click an overview KPI, then Share finding by email. The server independently
reads the current Supabase dataset, validates it and derives the selected scope.
Recipient, subject and body are editable. Review exposes the complete message
and traceability footer. Cancel causes no provider call. Sending needs explicit
confirmation, the correct lab phrase, and the configured permitted recipient.

Configure RESEND_API_KEY (Full access), LAB_EMAIL_TO (your own Resend account
address) and a random 32–256-character LAB_ACCESS_KEY in Vercel Production.
Enter the key directly in server settings, never in chat or public files.
Enter only the lab phrase in Email connection & lab access, then check connection.
The phrase is kept in memory and can be cleared. It is not a multi-user login.

A changed source snapshot invalidates the review. Each send uses a request UUID
and a provider idempotency key; uncertain outcomes are not automatically retried.
The warm-instance request cache is not a durable ledger. Keep the identifiers and
inspect Resend before any new send. A separate provider GET checks exact content;
acceptance/delivery events do not prove that the user observed the inbox message.

The email transport and confirmation pattern are adapted from the MIT-licensed
josncmar/ie-apps-action-lab starter. See reference/LICENSE. The operative dataset,
KPI calculations, source footer and business questions are Mint-specific.
This exercise adds email only. Trello, numeric write-back and issue creation are
later exercises. Existing synthetic tables remain read-only.

Live app: https://mint-revenue-lab.vercel.app
Vercel project: https://vercel.com/ayper1/mint-revenue-lab
Supabase project: https://supabase.com/dashboard/project/dwpcbdgiznubcjqtvrzj

Data source: Supabase project dwpcbdgiznubcjqtvrzj, mint_lab_* tables.
Deployment project: mint-revenue-lab, Vercel team ayper1.

The frontend loads its complete dataset using the read-only mint_lab_dataset RPC.
No bundled sample-data fallback is used. Browser access uses a publishable key,
SELECT-only grants and Row Level Security. No secret/service-role key is used.

LOCAL RUN
Use Node.js 24 or later. No package installation is needed.
Configure .env.local with SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.
Run: node scripts/serve.mjs
Open http://127.0.0.1:4173
Run model checks: node --test tests/analytics.test.mjs

FLOW
Overview -> Booking pace / Fare & channel mix -> Departure detail.
Shared route, departure-range and as-of filters persist across navigation.
Channel filters affect booking metrics only; capacity stays all channels.
The Data & model view exposes grain, definitions, source counts and the model diagram.

FOUNDATION
Synthetic data, seed 20261110, as-of 2026-11-10.
6 routes; 48 departures; 375 bookings; 2,304 daily snapshots.
Frozen contract v1.0.0 remains unchanged: revenue USD 777,930; average fare
USD 2,074.48; booked utilization 48.828125%; remaining seats 393; pickup 126.
Future demand, fares and cabin layouts are assumptions, not JetBlue observations.

SCENARIO EXTENSION
Departure detail includes a one-stage upgrade-versus-hold comparison, using
240 paired synthetic futures and a fixed seed. Each paired policy uses the same
demand draws. Results exclude already booked revenue, count existing economy
customers' upgrade payments only, and account for diverted new customers choosing
economy plus an upgrade. Full-fare switching, upgrade demand and future request
levels are explicit assumptions. No policy is labeled optimal. Range displays
are scenario percentiles, not confidence intervals or proven real-world uplift.
The extension does not modify the five frozen foundation KPIs or booking records.
The Session 3 extension persists the upgrade-fee assumption separately.

DEPLOYMENT
The Vercel plugin deploys public/ and api/config.js. Runtime config uses the
Vercel SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY environment variables.
The .env.local file is excluded from source control and deployment uploads.
The database/schema.sql file records the applied, read-only synthetic schema
and seed data; do not rerun it against already-created tables.

VALIDATION
Automated checks cover core values, channel denominator isolation, trend/route
reconciliation, empty/incomplete contexts, paired baseline equality, seat
conservation and revenue accounting. Browser checks cover drilldown, Back/Reset,
filters, data/model view, empty states, refresh failure and mobile overflow.

SESSION 3 — CONTEXTUAL EMAIL AND NUMERIC WRITEBACK
Email: api/mint-email.js sends a reviewed scope through Resend once, then attempts
an independent provider read. Missing provider read permission is reported honestly.
Production settings: RESEND_API_KEY, LAB_EMAIL_TO, LAB_ACCESS_KEY (32–256 chars).
The onboarding sender permits only the configured Resend account recipient.
Provider acceptance, delivery status and actual inbox confirmation are separate.

Upgrade fee: database/upgrade-policy.sql adds 48 synthetic practice assumptions,
one per departure, initially USD 450 to match the existing scenario default.
Do not rerun the migration on the existing database. The public table permits
SELECT only. The audit table has RLS and no client policies intentionally;
service_role alone may insert/read audit rows. The save RPC is SECURITY INVOKER
and executable only by service_role, with no anonymous write privileges.
Add SUPABASE_SECRET_KEY as a server-only Production Secret to enable writes.
The protected API restricts input to the upgrade-fee workflow; it does not accept
arbitrary table names or fields. Prices must be 250–1200 in steps of 50. A reason,
explicit review, matching old fee and revision, and a UUID request are required.
The SQL transaction locks the departure policy and writes its audit atomically.
An identical request ID returns the original receipt; conflicting edits are rejected.
Uncertain outcomes are never retried automatically. Read before another attempt.

Successful lab verification creates a Secure, HttpOnly, SameSite=Strict API-path
session for one hour so protected actions work across the app's tabs. The password
is not stored in the cookie. Clear phrase clears the session. Server keys are never
included in /api/config, public files, source archives or screenshots.

Saving a fee updates the existing 240-draw simulation. The reviewed comparison
uses base demand, 15% switching and up to three protected seats. Other sliders
remain temporary and are reset to those explicit assumptions after a saved read.
Booked revenue, passengers, inventory and pickup stay unchanged. The modeled
future revenue difference is an assumption-driven sensitivity, not measured uplift.

Run: node --test tests/*.test.mjs reference/resend-email.test.mjs
38 checks cover analytics, accounting, email, authorization, fee bounds, review,
stale changes, readback and uncertain outcomes. SQL transaction fixtures additionally
checked a valid save, same-request replay, invalid fee and stale conflict, then rolled
back; no practice adjustment was retained by those tests.

