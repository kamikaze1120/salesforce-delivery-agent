<div align="center">

# Delivery Studio
### From a BRD to a reviewed Salesforce release

**Clarify → Mock up → Build → Test → Promote**

![Version](https://img.shields.io/badge/version-0.4.0-2563eb)
![License](https://img.shields.io/badge/license-MIT-green)
![Runtime](https://img.shields.io/badge/node-22-blue)

[Quick start](#quick-start) · [Connect accounts](#connect-your-accounts) · [CI/CD setup](docs/PIPELINE.md) · [Architecture](docs/ARCHITECTURE.md) · [Verification](docs/VERIFICATION.md)

</div>

> **Release status:** v0.4 adds mockup review, test generation, a Salesforce MCP bridge and a gated GitHub Actions pipeline. Automated tests pass locally. The five-org pipeline has **not** been verified end to end against live accounts. Configure and validate non-production environments before enabling production.

## What you can do

| Start with | The studio prepares | You control |
|---|---|---|
| A BRD and your Salesforce metadata | Requirement-linked plan, follow-up questions and Jira stories | Business rules and plan approval |
| An approved plan | AI concept mockups and revisions | Mockup approval before code generation |
| An approved design | Apex, objects, draft Flows, permission sets and LWC metadata | Code and test-expectation review |
| A reviewed release | Validation, deployment and tests across your environments | UAT and production approvals in GitHub |
| An observed non-production failure | A bounded AI repair using the original BRD and frozen tests | Repair budget, pause, evidence and escalation |

**Default deployment order:** Salesforce Sandbox → QA → Dev → UAT → Production. QA/Dev/UAT are named, separate Salesforce orgs—not environments hosted by Vercel. You can reorder the middle stages; the first stage remains Sandbox and production remains last. Developer Edition can substitute for a non-production sandbox only when explicitly selected and verified by org ID and edition.

Copado is no longer required. Old Copado connection records are retained for compatibility but are not used by the pipeline.

## Quick start

Use Node.js 22, download or clone this repository, and run:

```sh
npm run dev
```

Open `http://localhost:3000` and choose **Open sample workspace**. No credentials or runtime npm installation are needed for the web app. The sample is a fixture, not a live LLM or deployment.

```sh
npm test
npm run build
```

The separate GitHub runner installs explicitly pinned Salesforce CLI and Playwright versions. It runs generated Salesforce metadata, not arbitrary model-generated shell or JavaScript test code.

## Deploy the web app to Vercel

1. Import this repository into Vercel.
2. Set **Framework: Other**, **Root: ./**, **Build: npm run build**, **Output: public**, **Node: 22.x**.
3. Create a Supabase project. For a new database, run `database/schema.sql` once. For an existing v0.3 database, run `database/migrations/003_pipeline.sql`—do not rerun the complete schema.
4. Add the settings below to the intended Vercel environment and redeploy.
5. Create and confirm users in Supabase Auth. Sign in, create a workspace, and configure its connections.

| Vercel variable | Purpose |
|---|---|
| `APP_ORIGIN` | Exact HTTPS web-app origin, no trailing slash |
| `SUPABASE_URL` | Hosted Supabase project origin |
| `SUPABASE_ANON_KEY` | Supabase Auth public/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database credential; never expose to the browser |
| `ENCRYPTION_KEY` | Random 32 bytes, encoded as base64; preserve securely with database backups |
| `SALESFORCE_API_VERSION` | Optional; defaults to `65.0`; verify it against your orgs |
| `ALLOW_SIGNUP` | Optional; `true` enables self-registration; disabled by default |
| `SIGNUP_EMAIL_DOMAINS` | Optional comma-separated signup domain allowlist |

Generate an encryption key locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`. Store it in your secret manager and Vercel, not Git or a ticket. Use `.env.local` for local credentials. Never share production credentials with untrusted previews.

## Connect your accounts

All settings are per workspace; there are no hardcoded customer accounts.

| Connection | Required setup |
|---|---|
| Salesforce development | My Domain login URL, environment kind, expected org ID for Developer Edition, External Client App client ID/secret, OAuth authorization |
| Jira Cloud | Site URL, project key, issue type ID, account email, API token and any required field defaults |
| GitHub CI/CD | Private Salesforce source repository, source folder, base branch, fine-grained token, trusted runner commit, five environment definitions |
| Development LLM | OpenAI or Azure OpenAI API credentials and a JSON-capable Chat Completions model/deployment |

Salesforce OAuth callback: `https://YOUR-APP/api/service?op=sfCallback`. Enable Web Server OAuth with `api` and `refresh_token` scopes, PKCE and client-secret validation. Rotated refresh tokens are persisted with a database revision claim; interrupted exchanges require reauthorization instead of token replay.

Pipeline authentication is separate: configure certificate-based JWT integration credentials and optional dedicated browser-test sessions in **each GitHub environment**, including production. The existing web OAuth app does not automatically grant those permissions. See [the complete CI/CD setup guide](docs/PIPELINE.md).

The Salesforce source repository is separate from the repository hosting this application. Install the trusted workflow, `runner/` and its required `lib/` modules into that repository, protect the runner branch, and pin its reviewed commit. Generated feature code goes to an isolated `sfda/<delivery-id>` branch. The runner receives the exact package from the authenticated application and does not execute generated repository scripts.

## Deliver a feature

1. Create a delivery from plain text or Markdown BRD content. PDF/Word conversion is not included.
2. Analyze the original BRD and answer blocking questions. Approve the plan.
3. Open **Mockup**, generate concept screens, request revisions, then approve the current design.
4. Create all Jira stories, generate metadata, and review the code.
5. Open **Test evidence**, generate and approve requirement-linked test scripts. Resolve manual-only scenarios before starting automatic promotion.
6. Approve the implementation and commit it to the isolated feature branch.
7. Open **CI/CD** and start the reviewed pipeline. Review the real runner evidence and GitHub environment approval requests.
8. Approve UAT and production through GitHub. Verify business behavior and retain release evidence.

A successful non-production repair creates a new artifact and Git commit, preserves approved tests, and restarts from Sandbox. UAT/production approvals apply again to that new run. Repairs cannot change permission-set files, test classes, requirement text, mockups, or acceptance expectations. No-op repairs, ambiguity, exhausted budget, authentication failures and unknown write outcomes stop the automation. There is no automatic production repair or rollback; a failed production release needs investigation.

## Grounding and safety boundaries

“Zero hallucinations” cannot be guaranteed. This system limits unsupported behavior through exact BRD excerpts, requirement IDs, reviewed mockups, frozen test expectations, strict metadata paths, verified target identities, signed runner identity, and actual Salesforce/Playwright results. A model response is never accepted as test evidence.

- GitHub runner identity uses signed OIDC with audience, repository, workflow, exact SHA, branch, environment and run binding.
- UAT/production environments require reviewers with self-review prevented. Every environment must restrict deployment to protected branches.
- The MCP bridge exposes only org inspection, immutable-package validation/deployment, status polling and named Apex tests. It does not expose arbitrary shell, SOQL or unrestricted tool execution.
- Playwright interprets an approved declarative test plan. It does not evaluate model-generated JavaScript. Browser traffic is restricted to the configured Salesforce login and Lightning hosts; unsupported CDN/SSO dependencies fail closed and require reviewed adapter changes.
- Production browser tests must be read-only. Write-based browser scenarios currently block production; use read-only smoke assertions for a full five-stage run.
- Salesforce validation and deployment always use `RunLocalTests`, `rollbackOnError` and warnings-as-failures. Validation is not a substitute for business acceptance.
- Generated Flows remain Draft. Activation, destructive changes, data migration, managed packages and broad org administration are outside the current automation scope.

## Documentation and project policies

| Need | Read |
|---|---|
| Full backend credentials, runner installation and five-org configuration | [CI/CD setup](docs/PIPELINE.md) |
| Existing web app setup | [Setup](docs/SETUP.md) |
| Trust boundaries and repair flow | [Architecture](docs/ARCHITECTURE.md) |
| Tested behavior and live gaps | [Verification](docs/VERIFICATION.md) |
| Upgrade an existing database | [Upgrade](docs/UPGRADE.md) |
| Contribute changes | [Contributing](CONTRIBUTING.md) |
| Community expectations | [Code of conduct](CODE_OF_CONDUCT.md) |
| Vulnerability reporting | [Security policy](SECURITY.md) |
| Usage and distribution terms | [MIT license](LICENSE) |

The MIT license covers this project’s code. Salesforce, GitHub, Vercel, Supabase, model providers and Playwright have their own terms and licenses. No provider subscription or service charge is included.

### License-aware planning

Salesforce authorization now collects an evidence report: org edition (including Developer Edition), the connected user's license when available, user/feature/package license inventories, API limits and effective object CRUD flags. Refresh it under **Workspace setup → Salesforce → Refresh license & capability report**. BRD analysis obtains a new snapshot and asks blocking questions about unverified licensed features, with alternatives to investigate.

A denied probe is **unknown**, not “unlicensed.” Inventories are capped at 200 rows and disclose truncation. License fields are discovered before querying; unavailable counts are never invented. Inventory does not establish assignment to every user. CRUD access does not establish metadata deployment permission. Exact-package validation and destination-specific testing remain mandatory. These reports cannot verify commercial contracts or promise zero hallucinations; the current requirement assessment is model-assisted, not a complete deterministic entitlement rules engine.
