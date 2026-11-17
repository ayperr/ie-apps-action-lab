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
The extension does not modify the five frozen foundation KPIs or database records.

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
