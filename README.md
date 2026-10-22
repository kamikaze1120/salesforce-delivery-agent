<div align="center">

# Delivery Studio
### From a BRD to a reviewed Salesforce release

**Clarify → Mock up → Build → Test → Promote**

![Version](https://img.shields.io/badge/version-0.4.0-2563eb)
![License](https://img.shields.io/badge/license-MIT-green)
![Runtime](https://img.shields.io/badge/node-22-blue)

[Quick start](#quick-start) · [Connect accounts](#connect-your-accounts) · [CI/CD setup](docs/PIPELINE.md) · [Architecture](docs/ARCHITECTURE.md) · [Verification](docs/VERIFICATION.md)

</div>

> **Release status:** v0.4 adds mockup review, test generation, a Salesforce MCP bridge and a gated GitHub Actions pipeline. Automated tests pass locally. The four-org pipeline has **not** been verified end to end against live accounts. Configure and validate non-production environments before enabling production.

## What you can do

| Start with | The studio prepares | You control |
|---|---|---|
| A BRD and your Salesforce metadata | Requirement-linked plan, follow-up questions and Jira stories | Business rules and plan approval |
| An approved plan | AI concept mockups and revisions | Mockup approval before code generation |
| An approved design | Apex, objects, draft Flows, permission sets and LWC metadata | Code and test-expectation review |
| A reviewed release | Validation, deployment and tests across your environments | UAT and production approvals in GitHub |
| An observed non-production failure | A bounded AI repair using the original BRD and frozen tests | Repair budget, pause, evidence and escalation |

**Default deployment order:** Salesforce Dev → QA → UAT → Business approval → Production. QA/Dev/UAT are named, separate Salesforce orgs—not environments hosted by Vercel. Stage order is fixed. Dev can be a sandbox or an explicitly verified Developer Edition org. Developer Edition can substitute for a non-production sandbox only when explicitly selected and verified by org ID and edition.

Copado is no longer required. Old Copado connection records are retained for compatibility but are not used by the pipeline.

## Quick start

Use Node.js 22, download or clone this repository, and run:

```sh
npm ci --ignore-scripts
npm run dev
```

Open `http://localhost:3000` and choose **Open sample workspace**. No credentials are needed for the sample. Install the locked dependencies first; the server uses a structural XML parser for Salesforce results and metadata policy checks. The sample is a fixture, not a live LLM or deployment.

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

## Branches and releases

`main` is the single integration branch for this application. The previous version branches were already merged; the audit safety changes were merged in PR #3. Completed branches are removed after their work is preserved in `main`.

For each new change, use one short-lived branch and pull request, run the required checks, merge, then delete the branch. This provides a reviewable diff and Vercel preview without keeping permanent version branches. Keep main protected against force pushes and deletion; do not bypass required checks.

Merging application changes into `main` triggers the connected Vercel production build. Check that deployment's commit and Ready status before treating the release as live. This deploys the **web application** only. Salesforce metadata promotion uses the separate delivery pipeline, target-org checks and business approval gates.

## Current implementation checkpoint

| Area | Verified behavior | Remaining work |
|---|---|---|
| Application safety | 75 local tests passed at the audit checkpoint; runner routing and structural XML checks corrected | Live account integration rehearsal |
| Apex security | Real Code Analyzer CI accepted a clean fixture and detected the unsafe injection fixture | Broader metadata policies and runtime authorization tests |
| Interrupted runs | Durable intents, operation IDs, immutable outcomes and replay prevention | B10 authenticated reconciliation and reviewer interface |
| Pause | Checks before deployment submissions and test actions | Cancellation of operations already accepted by Salesforce |
| Promotion | Required evidence gates block unsupported or unknown results | Reviewed per-plan quality policies, Flow adapter and four-org rehearsal |

Use [the backlog](docs/BACKLOG.md) for all 35 items and [work status](docs/WORK-STATUS.md) for evidence. A successful Vercel build does not mean Salesforce promotion is ready.

## Connect your accounts

All settings are per workspace; there are no hardcoded customer accounts.

| Connection | Required setup |
|---|---|
| Salesforce development | My Domain login URL, environment kind, expected org ID for Developer Edition, External Client App client ID/secret, OAuth authorization |
| Jira Cloud | Site URL, project key, issue type ID, account email, API token and any required field defaults |
| GitHub CI/CD | Private Salesforce source repository, source folder, base branch, fine-grained token, trusted runner commit, four environment definitions |
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

A successful non-production repair creates a new artifact and Git commit, preserves approved tests, and restarts from Dev. UAT/production approvals apply again to that new run. Repairs cannot change permission-set files, test classes, requirement text, mockups, or acceptance expectations. No-op repairs, ambiguity, exhausted budget, authentication failures and unknown write outcomes stop the automation. There is no automatic production repair or rollback; a failed production release needs investigation.

## Grounding and safety boundaries

“Zero hallucinations” cannot be guaranteed. This system limits unsupported behavior through exact BRD excerpts, requirement IDs, reviewed mockups, frozen test expectations, strict metadata paths, verified target identities, signed runner identity, and actual Salesforce/Playwright results. A model response is never accepted as test evidence.

- GitHub runner identity uses signed OIDC with audience, repository, workflow, exact SHA, branch, environment and run binding.
- UAT/production environments require reviewers with self-review prevented. Every environment must restrict deployment to protected branches.
- The MCP bridge exposes only org inspection, immutable-package validation/deployment, status polling and named Apex tests. It does not expose arbitrary shell, SOQL or unrestricted tool execution.
- Playwright interprets an approved declarative test plan. It does not evaluate model-generated JavaScript. Browser traffic is restricted to the configured Salesforce login and Lightning hosts; unsupported CDN/SSO dependencies fail closed and require reviewed adapter changes.
- Production browser tests must be read-only. Write-based browser scenarios currently block production; use read-only smoke assertions for a full four-stage run.
- Salesforce validation and deployment always use `RunLocalTests`, `rollbackOnError` and warnings-as-failures. Validation is not a substitute for business acceptance.
- Generated Flows remain Draft. Activation, destructive changes, data migration, managed packages and broad org administration are outside the current automation scope.

## Documentation and project policies

| Need | Read |
|---|---|
| Full backend credentials, runner installation and four-org configuration | [CI/CD setup](docs/PIPELINE.md) |
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

### Revised delivery architecture (October 2026)

The authoritative flow and implementation matrix are in [Delivery flow](docs/DELIVERY-FLOW.md). Jira story creation and GitHub Actions CI/CD are core integrations. Copado is not used. New deliveries require a resolved, approved Salesforce architecture before code generation. After UAT, the app generates a traceable release report; a reviewer records business approval before the production runner can claim its package. Approve the report in the app **before** releasing the protected production job in GitHub.

**Current rollout blocker:** the expanded quality gate deliberately blocks promotion until the trusted runner supplies coverage, security, performance, license, regression, business and Flow applicability/results evidence. B05–B08 adapters now execute reviewed policies for their documented supported scope; Flow execution and live verification remain outstanding. Do not enable this pipeline for production simply because web-app unit tests pass. See the implementation matrix for remaining work.

### Specialized agents and target stack

[Agent responsibilities and stack decisions](docs/AGENTS-AND-STACK.md) separates the existing implementation from the target React/Next.js, FastAPI and LangGraph architecture. [Agent contracts](config/agent-contracts.json) define responsibilities and tool boundaries. Requirement analysis now creates structured test cases alongside stories, covering every acceptance criterion; executable test generation must preserve their expected outcomes.

### Quality adapter progress

The runner derives changed-Apex-class coverage and acceptance-case execution coverage from observed results. It does not accept external pass files. Security combines isolated Apex scanning, constrained metadata policy and reviewed runtime access cases. Performance evaluates measured Apex/bulk and browser budgets. Destination-license checks run before each metadata operation; baseline regression uses independently reviewed tests with pinned sources. All require a per-plan policy from the trusted runner commit. Changed-Flow checks remain blocked pending B17. See [quality policy setup](docs/QUALITY-POLICIES.md). No complete end-to-end Salesforce pipeline is claimed.

## Implementation backlog

The [backlog board and story catalog](docs/BACKLOG.md) tracks the original 35 audit items plus newly discovered work across six epics. Each Jira-style story includes priority, status, implementation tasks, acceptance criteria, dependencies, required evidence and expected results. The Kanban summary separates backlog, in-progress work, verification and live-setup blockers. [Work status](docs/WORK-STATUS.md) records verified checkpoints and live-verification limits. Passing web-app checks does not establish Salesforce production readiness.


### Security preflight setup (B05, limited pilot scope)

Before enabling a Salesforce pipeline, set `CODE_ANALYZER_VERSION` in each GitHub environment to an exact reviewed **5.x.y** release of `@salesforce/plugin-code-analyzer`, alongside the existing CLI and Playwright version variables. The runner requires Java 11+ and installs the scanner before environment credentials are used. Do not use `latest`.

Security checks run **before any Salesforce validation or deployment**. The policy scans all Apex source using PMD rules tagged Security, rejects suppression markers, and fails on every reported security severity. Unknown, incomplete or inconsistent evidence blocks the stage. Generated scanner configuration is never executed.

Restricted private custom objects with simple fields and constrained permission sets now have structural security policies. Flows, LWC, profiles, triggers and more complex metadata remain blocked pending expanded coverage. A clean static scan alone cannot pass the security gate: reviewed allow/deny CRUD/FLS/sharing cases must also execute. Configure all gates using [reviewed quality policies](docs/QUALITY-POLICIES.md). See [security policy details](docs/SECURITY-GATE.md) and [backlog](docs/BACKLOG.md).

### Interrupted runs and pause behavior

The runner saves each validation/deployment intent before submission, its Salesforce operation ID before polling, and the terminal outcome before continuing. Lost or ambiguous responses block replay and automatic repair. A passing stage report must match those saved operation IDs. Pause checks run before validation, deployment, each Apex scenario and each browser step; outcome reporting and read-only polling of an already submitted deployment remain available while paused. Pause cannot undo or cancel an operation already accepted by Salesforce, and there is a small race between permission checks and external submission. Do not treat it as emergency cancellation. See [runner recovery](docs/RUNNER-RECOVERY.md).

A separate credential-free `Security scanner integration` workflow exercises the pinned real scanner against clean and intentionally unsafe synthetic Apex. Its result is distinct from unit tests and web preview deployment. It needs no Salesforce credentials and performs no Salesforce writes.


### Interrupted operation recovery

The CI/CD journal shows saved Salesforce operation evidence and blocks unresolved restarts. A restricted MCP reconciliation mode now allows org inspection and status reads for exact saved IDs without exposing write tools. Owners and reviewers can now request an authenticated, read-only GitHub recovery check after pausing and stopping the original runner. Results update the saved operation journal while the delivery remains paused. Reviewers can retire an interrupted read request after its claimed worker stops, or after 24 hours if it was never claimed, then request a fresh check. Retirement preserves unresolved deployment outcomes and the pause. Controlled recovery decisions and live verification remain pending. See [runner recovery](docs/RUNNER-RECOVERY.md) for the contract and limitations, and [B10](docs/BACKLOG.md#b10) for the remaining acceptance criteria.

### October 21 delivery controls

Business approval now dispatches a separate protected production continuation. Runner repositories must install `salesforce-production.yml` and review/pin the updated commit. New test suites map acceptance criteria to exact Apex methods or browser assertions. Git revisions track owned files and explicit removals; legacy deliveries without ownership records block safely. Workspace owners can run setup preflight from Connections.

- [Setup and behavior changes](docs/DELIVERY-CONTROLS.md)
- [Current versus target architecture](docs/ARCHITECTURE-DECISION-001.md)
- [Unresolved runner dependency audit](docs/TOOLCHAIN-AUDIT.md)

These changes do not establish live Salesforce readiness. The official Hosted/DX MCP adapter, org-wide locks and other open backlog items remain outstanding.
