# Northstar · Action Lab

A working template that turns a dashboard signal into a **real notification**: inspect a fictional order → review the message → confirm → send to your own ntfy inbox → read it back and verify the receipt.

The dashboard, 24 synthetic orders, review interface, server integration, receipt verification and visual workshop guide are included. Clone it, change the rules and wording, and deploy your version. No previous class project is required.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjosncmar%2Fie-apps-action-lab)

[Open the live app](https://ie-apps-action-lab.vercel.app) · [Visual guide](https://ie-apps-action-lab.vercel.app/guide.html) · [Download the complete ZIP](https://ie-lessons-tracker.vercel.app/apps-lab-starter.zip)

## Instructor integration preflight

The separate `/preflight.html` page prepares a mail/Teams draft and can test four real actions: a Trello card, a Resend email to your own address, a saved review in Supabase, and a GitHub pull request with a one-file policy diff. These privileged tests are disabled until you configure your own server credentials and a test-panel access phrase. Start with [the simple connection guide](public/start-here.html), then see [the setup and evidence guide](reference/FOUR-ACTIONS.md) and [.env.example](.env.example). The existing ntfy demo remains available while these providers are configured.

The GitHub transport has passed a real create/read-back test in an isolated private-repository fixture. Trello, Resend and external draft opening still need account-specific end-to-end checks; mocked tests do not establish provider access or free-plan eligibility. The policy fixture is illustrative and is not yet consumed by the dashboard. Use the repository for this preflight; the portal ZIP is updated separately.

## Make your own copy

1. Click **Deploy with Vercel**, sign in and choose your own GitHub account for the copied repository. If settings are requested, use framework **Other**, build command **npm run build** and output directory **public**. No environment variables are required for the included ntfy integration.
2. Open your deployment. Check the 24 orders and $19,512 net revenue, connect your own test inbox, inspect an order, review the message and explicitly confirm one real notification. Open its external inbox and verify the matching receipt in your app.
3. Open your copied repository with your coding assistant. Change a rule, wording or message field; commit and push. Verify that your change appears on your Vercel URL.

To run locally, install Node.js 22 or newer, clone your repository and run `npm run dev`, then open http://127.0.0.1:3000. There are no npm dependencies. Alternatively, extract the ZIP and put its contents in a new GitHub repository with `package.json` at the root, then import it into Vercel.

## What works, and what you change

| Block | Start from the included app | Your exercise |
| --- | --- | --- |
| 1. Define the action | Metrics, filters and details over 24 orders | Choose a signal and customize the rule and requested next step. |
| 2. Review before acting | Editable preview, explicit confirmation and cancellation | Improve the message and recipient context; send one reviewed notification. |
| 3. Connect and verify | Node API sends to ntfy and reads the message back | Inspect the payload and response; verify the real identifier and adapt a field. |
| 4. Handle uncertainty | Separate received, rejected and unknown results; local history | Test cancellation, validation, repeated clicks and read-only verification after uncertainty. |
| 5. Optional extension | Server transport reference for GitHub | Add an authenticated GitHub issue, another destination, or Supabase persistence. |

See the illustrated guide for instructions, five diagrams, screenshots, prompts and acceptance criteria. Practice mode remains available for controlled failure rehearsals; simulated results are always labelled and are not external deliveries.

## Real integration and its limits

The server creates a random inbox identifier without opening a provider account. It publishes only to the fixed `ntfy.sh` host, using a topic derived from that identifier. The message includes facts from the bundled order, a stable request ID and your reviewed title/reason. A successful HTTP response is distinct from a verified receipt: the app reads the provider's cached messages and looks for the matching request.

Use **at most two real sends per student** for the core lab. ntfy's free public service publishes limits of 250 messages per visitor/IP per day, a request burst of 60 and refill of one request per five seconds. Hosting networks may share outbound IPs. Cached messages expire after about 12 hours; an old message disappearing is not proof that it was never delivered. Recheck current limits and perform one preflight before class. Availability and free quotas cannot be guaranteed.

The random topic is an unlisted public test inbox, **not an authenticated private mailbox**. Anyone with its address can read or publish there. Use fictional data only and do not post credentials, customer information or personal messages. Neither a received notification nor a closed ticket proves the underlying business problem was resolved.

History in this starter stays in the current browser. It is not a shared database or an audit log. Looking for an existing request before sending helps with repeat calls but is not an atomic, durable exactly-once guarantee. After an uncertain result, verify the existing request instead of automatically sending it again. A production workflow needs authentication, authorization and durable server-side state; that is an optional extension here.

## Code map

```text
public/
  index.html, styles.css, app.js   Dashboard, review and history
  data.json                       24 fictional retail orders
  guide.html, diagrams/, images/  Illustrated workshop
api/
  receiver.js                     Create a random test inbox identifier
  send-event.js                   Validate and send a real notification
  verify-event.js                 Read back the external receipt
  create-issue.js                 Disabled GitHub teaching route (HTTP 501)
server-lib/                       Provider transport and HTTP validation
reference/
  INTEGRATION.md                  Auth/persistence contract for the GitHub extension
  github-issue.mjs                Server-side GitHub transport
  preflight.mjs                   Explicit opt-in GitHub create/read/close check
scripts/server.mjs                Local development server
scripts/build.mjs                 Deployment asset checks
vercel.json                       Deployment configuration
```

The GitHub route is not enabled by adding a token. Implement its complete authentication, authorization, persistence and dispatch contract first. Keep all future GitHub, Trello or email secrets on the server. Your assistant's connected tools do not automatically authorize your deployed app.

## Synthetic dataset

`public/data.json` contains `meta` and an `orders` array, with a fixed reference date of 2026-11-17. All names, teams and records are fictional; there are no customer identities or contact addresses.

| Fields | Meaning |
| --- | --- |
| `id` | Stable order identifier, for example `NS-1041`. |
| `product`, `category`, `region`, `channel` | Display and filter categories. |
| `orderDate`, `promisedDate`, `deliveredDate` | Calendar dates; an undelivered order has a null delivery date. |
| `status`, `quantity` | Delivery status and units ordered. |
| `revenue`, `cost`, `refund` | Order totals in USD, not unit prices. |
| `owner`, `note` | Fictional responsible team and investigation context. |

Net revenue = revenue − refund. Contribution = net revenue − cost. Margin rate uses net revenue; refund rate uses gross revenue. Attention means negative contribution, late delivery at the fixed reference date, or a refund rate of at least 25%. Count distinct flagged orders because signals can overlap.

Baseline: 24 orders, $19,512 net revenue, $7,533 contribution and 9 orders needing attention. If you change a rule, change its explanation and server-side payload consistently.

## Verify your copy

```sh
npm test
npm run build
```

Automated transport tests use fixtures and mocked responses. They do not send real notifications or issues. After deploying, perform a single reviewed live send, verify the matching external receipt and test cancellation without a send. Use practice mode for repeated failure scenarios.

## License

MIT. See [LICENSE](LICENSE).
