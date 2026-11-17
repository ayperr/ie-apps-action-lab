# Northstar · Action Lab

A working app with four actions already implemented: **email → Supabase → Trello → GitHub**. Copy it, deploy your own version, personalize the interface and business case, connect your own accounts, then verify the real results. You do not build four APIs from scratch.

The dashboard, 24 fictional orders, previews, confirmation and external verification are supplied. The interface, data and action buttons work immediately after cloning. You can preview and confirm an action; if its connection is missing, the app explains which server settings to add instead of contacting the provider. No previous class project is required.

[Open the action panel](https://ie-apps-action-lab.vercel.app/preflight.html) · [Simple learner guide](https://ie-apps-action-lab.vercel.app/start-here.html) · [Dashboard](https://ie-apps-action-lab.vercel.app)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fjosncmar%2Fie-apps-action-lab)

## Start with your own app · 35 minutes

1. Click **Deploy with Vercel**, using your own GitHub account for the copied repository. If asked: Framework **Other**, build command **npm run build**, output directory **public**.
2. Keep your own URL. Open **your URL + `/start-here.html`** and the dashboard. The interface and supplied data are ready before you add keys.
3. Open your copied repository with your coding assistant. Personalize the design and use case before connecting services. You may use a previous class dataset or the included fictional case.
4. Push the change, wait for Vercel to deploy it and check your own URL. Try the email/Teams draft warm-up in **`/preflight.html`**. Opening a draft does not send it.

A prompt to start:

> Personalize this working Northstar Action Lab for my chosen business case. First propose a simple design and explain the action each button takes. Keep the four implemented integrations, destination previews, confirmation and independent verification. Use the included fictional data unless I provide a previous class dataset. If we change the action record, update the interface AND the server record/previews consistently, and adapt the Supabase fixture and function too. Do not change only the labels while sending the old record. Keep credentials in server settings. Show me the result and the checks you performed.

The supplied NS-1041 case is the ready-to-use fallback: revenue $1,200, cost $1,320 and contribution −$120. Using your own dataset is optional. Changing the dashboard alone does not change the fixed record sent by the action panel.

## Four exercises, four checkpoints

| Exercise | Time | What you do | Checkpoint |
| --- | --- | --- | --- |
| 1 · Email | 30 min | Connect Resend, review the message and send one email to your own account address. | A real email ID, provider status and the message in your inbox. Accepted alone is not delivered. |
| 2 · Supabase | 35 min | Connect your practice database and save a reviewed record. | Reload and read the saved status, request ID and timestamp again. |
| 3 · Trello | 30 min | Connect your practice list and turn the signal into a review task. | Open the real card and compare its list, title and description. |
| 4 · GitHub | 30 min | Connect your copied repository and propose a one-file policy change. | Open the PR and inspect **Files changed**. Nothing is merged automatically. |

With the initial 35 minutes, a 10-minute break and a 10-minute close, the workshop lasts **180 minutes**. Prepare the one-time Supabase setup with the instructor or assistant; the exercise is about connecting and checking the supplied flow. The email/Teams draft is a warm-up, not a fifth real integration exercise.

## Connect your own accounts

Put each setting directly in **your Vercel project → Settings → Environment Variables → Production**, save, then **Deployments → latest deployment → Redeploy**. A copied project does not inherit the instructor’s accounts.

Before adding provider credentials, create `LAB_ACCESS_KEY`: a random password of **at least 32 characters** saved in your password manager and Vercel. Enter that password in the action panel’s **Lab access phrase** field to authorize configured real operations. No activation flag is needed. Provider keys go only in server settings, never in chat or committed files.

You can press the action buttons before setup. If a setting is missing, the result names it—for example, `RESEND_API_KEY` and `LAB_EMAIL_TO`. Add the named settings in Vercel, save, redeploy and test again. If values are present but invalid, the app identifies the settings to review. A configured service still requires your lab access phrase before any real operation.

| Service | Settings in Vercel | Preparation |
| --- | --- | --- |
| Email | `RESEND_API_KEY`, `LAB_EMAIL_TO` | A Resend **Full access** key and your own account email. Sender is already `onboarding@resend.dev`. |
| Supabase | `LAB_SUPABASE_URL`; shared `LAB_ACCESS_KEY` | Run supplied `supabase/setup.sql` once and deploy `supabase/writeback/index.ts` as `ie-action-lab-writeback`, with the hash of your own lab password. A URL alone is not enough. |
| Trello | `TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_LIST_ID` | Your own practice list; **Trello Auth → Generate API key → Token → Allow**. |
| GitHub | `LAB_GITHUB_TOKEN`, `LAB_GITHUB_REPOSITORY`, `LAB_GITHUB_BASE_BRANCH`, `LAB_GITHUB_POLICY_PATH` | **Only select repositories** for your copy; **Contents** and **Pull requests** read/write. **Public repositories** is read-only. |

Use the [simple learner guide](https://ie-apps-action-lab.vercel.app/start-here.html) for the screens and [the instructor setup guide](reference/FOUR-ACTIONS.md) for exact values and supplied Supabase files. [.env.example](.env.example) lists the setting names. A configured connection is preparation; each checkpoint needs a real result.

## Verified in the instructor’s app

On **17 November 2026**, all four real actions were checked:

- Email: provider delivery status and the message confirmed in the recipient’s inbox.
- Supabase: saved record checked independently through SQL.
- Trello: created and checked [card N3nb8mnq](https://trello.com/c/N3nb8mnq).
- GitHub: created and verified [PR #1](https://github.com/josncmar/ie-apps-action-lab/pull/1) through the app interface.

Your copy still needs its own configuration and checks. Account billing screens were not inspected: these results do not certify a Free plan or remaining quota. The draft warm-up depends separately on each person’s email/Teams client and account.

If the outcome is unknown, inspect the existing result before repeating. Keep the request ID. The GitHub policy file is a teaching proposal; editing it does not yet change dashboard rules automatically. The lab access phrase protects a temporary classroom panel, not a complete production user system.

## Optional extra: ntfy notification demo

The dashboard also retains an **optional ntfy demo** and local practice mode. These are extra materials, not the four exercises above. The ntfy demo needs no provider account or environment variables and checks a fictional event in an unlisted test topic. Anyone with that topic can access it; use synthetic data only and at most two live sends per student. Provider availability and shared-network limits still apply.

Local practice results are browser-local simulations. The real Supabase exercise is the path that persists a reviewed record outside the browser. Neither simulated history nor an ntfy receipt proves another integration works.

## Useful files

| Location | Purpose |
| --- | --- |
| `public/start-here.html` | Simple learner guide for the current four exercises. |
| `public/preflight.html` | Draft warm-up and four real actions. |
| `public/index.html`, `public/data.json` | Dashboard, fictional dataset and optional ntfy demo. |
| `api/action-preflight.js`, `server-lib/action-preflight.mjs` | Server-side actions and verification. |
| `reference/FOUR-ACTIONS.md` | Setup instructions and evidence. |
| `supabase/setup.sql`, `supabase/writeback/index.ts` | Practice table and restricted write-back function. |
| `classroom-fixtures/review-policy.json` | File changed by the PR exercise. |

The legacy `api/create-issue.js` reference route is not used by the working PR exercise. Your assistant’s connected accounts do not automatically authorize the deployed app.

## Optional local development

Use Node.js 22 or newer and `npm run dev`, then open http://127.0.0.1:3000. There are no npm dependencies. Your assistant can run `npm test` and `npm run build`; automated service tests use mocks and do not establish live access.

The included dataset has a fixed reference date of **2026-11-17**: **24 orders**, **$19,512 net revenue**, **$7,533 contribution** and **9 orders needing attention**. All records are fictional. Net revenue = revenue − refund; contribution = net revenue − cost. Count distinct flagged orders because signals can overlap.

After the workshop, clear the lab access phrase from the page and revoke temporary provider tokens you no longer need. The app remains available; configured real operations still require the lab access phrase.

## License

MIT. See [LICENSE](LICENSE).
