# Delivery Studio — Salesforce Delivery Agent

A configurable web application that turns a business requirements document into reviewed Salesforce sandbox development work. Each workspace supplies its own Salesforce, Jira, GitHub, Copado pipeline, and development LLM settings. No organization, project, repository, or model is hardcoded.

**Release v0.2.0: sandbox pilot.** This is source you can commit and deploy, not a claim of a tested production integration. Live accounts were not supplied during development. Automated Copado promotion and production deployment are deliberately unavailable in this release.

## Upgrade from v0.1

Run `database/migrations/002_release_safety.sql` against your existing Supabase database before deploying this version. New installations use the complete `database/schema.sql` instead. See [UPGRADE.md](docs/UPGRADE.md) for release and recovery changes.

## Run locally

Requires Node.js 22 or newer. There are no runtime npm dependencies.

```bash
npm run dev
```

Open http://localhost:3000 and choose **Open sample workspace** to inspect the workflow without accounts. Sample actions do not call external services or simulate successful tests/deployments.

For live use, follow [SETUP.md](docs/SETUP.md): create a Supabase project, run `database/schema.sql`, and copy `.env.example` to `.env.local` with the actual server settings. Configure connections through the web application after signing in. Never commit `.env.local` or real credentials.

```bash
npm test
npm run build
```

## What works in the pilot

| Area | Implementation |
| --- | --- |
| Identity and workspaces | Supabase email/password authentication, encrypted HttpOnly session cookies, workspace roles: owner, reviewer, developer, viewer |
| Connection setup | Per-workspace configuration; encrypted Jira/GitHub/LLM credentials; Salesforce OAuth with one-use, user-bound state |
| BRD intake | Paste text or upload `.txt` / `.md`; document stored in the workspace |
| Clarification and planning | User-selected OpenAI or Azure OpenAI model, structured requirements, exact BRD citations, stories, risks, acceptance criteria, follow-up questions |
| Org context | Verifies `Organization.IsSandbox`; inspects object catalog, selected field schemas, Apex class names |
| Jira | Creates approved stories one at a time, maps configurable issue type, records issue links, recovers matching markers |
| Salesforce generation | Generates allowlisted Apex, CustomObject, Flow, permission set, and LWC metadata; builds package.xml on the server |
| Human code review | File inspection/editing; exact artifact hash approval; edits reset approvals |
| GitHub | Commits a reviewed release to a new isolated branch; no force push or automatic merge; converts supported Metadata API objects into source format |
| Sandbox tests | Check-only Metadata API deployment with `RunLocalTests`; durable deployment IDs and actual failure messages |
| Sandbox release | Four-hour reviewer approval bound to the exact validation run, artifact, Git commit, and org; live Git branch check before dispatch |
| Business acceptance | Reviewer records observed evidence for every plan test scenario after sandbox deployment |
| Copado handoff | Downloads metadata plus a release manifest containing Jira links, Git commit, review decisions, target, and test results |
| Human intervention | Pause/resume, ten-minute operation leases, durable write checkpoints; unknown outcomes remain blocked |
| Persistence and audit | Postgres-backed job state, optimistic concurrency, server-generated actor events, model usage tracking |

## Workflow

1. Sign in and create a workspace.
2. Configure Salesforce, Jira, GitHub, Copado handoff, and your LLM. Authorize the sandbox.
3. Create a delivery from a BRD. Choose **Analyze with development LLM**.
4. Answer blocking questions and reanalyze. Review/edit the plan, then approve it.
5. Create Jira work items and generate Salesforce changes.
6. Review/edit every generated file and approve the code.
7. Commit to its isolated Git branch and validate the package. Refresh Salesforce status until it finishes.
8. Review validation evidence, approve the sandbox release, and deploy. Refresh its status.
9. Run the business acceptance scenarios in the sandbox and record evidence.
10. Download the Copado handoff. Your release manager continues UAT and production through the existing Copado process.

Every write is an explicit user action in this pilot. The application does not run an autonomous repair loop or background development agent. Salesforce validation/deployment jobs execute asynchronously in Salesforce; their IDs and state persist in the database. The browser must refresh their status, so human review does not depend on a running server request.

## Deploy to Vercel

Import your committed GitHub repository. Select **Other** as the framework preset, `npm run build` as the build command, and `public` as the output directory. The API entry point is `api/service.mjs`; `vercel.json` includes function limits and security headers. Set the variables listed in `.env.example`. `APP_ORIGIN` must equal the exact HTTPS site origin, without a trailing slash. Use a stable deployment URL for OAuth callbacks; see [SETUP.md](docs/SETUP.md).

Vercel hosting does not provide the application database or account credentials automatically. A Supabase project and the configured external accounts are required for live operation. No accounts, subscriptions, integrations, or resources have been provisioned by this source package.

## Boundaries and next milestones

- Copado is a **manual release handoff**, not a live automated connector. Pipeline edition/version and licensed API access must be identified before implementing that adapter. Production is disabled on the server.
- Current connectors support Jira Cloud, GitHub.com, Salesforce My Domain sandboxes, and OpenAI/Azure models compatible with Chat Completions JSON mode. Enterprise GitHub, Jira Data Center, arbitrary model gateways, and other Git providers are not supported yet.
- PDF and Word extraction are not included. Convert the BRD to text/Markdown first.
- The org inspection is intentionally bounded and not a full dependency graph or source retrieval. Existing Flow logic, Apex bodies, managed package constraints, and every org feature are not inspected. Developer review remains mandatory.
- Generated metadata is untrusted until reviewed and validated. Model generation does not guarantee correct Salesforce code, security, or business behavior.
- Apex tests run through Salesforce. Browser-based LWC tests, automated UAT, Copado Robotic Testing, static analyzers, and external integration tests need separate runners.
- No destructive changes, deletion manifests, data migrations, automatic merges, automatic PR creation, or production data access are supported.
- Changing workspace connections requires a new delivery. Model calls have a per-user limit, but organization spending quotas must also be configured at the model provider.
- Password recovery, enterprise SSO, managed invite emails, credential rotation UI, and compliance-grade immutable audit retention are next milestones. A Supabase administrator manages accounts and recovery for the pilot.

See [ARCHITECTURE.md](docs/ARCHITECTURE.md), [VERIFICATION.md](docs/VERIFICATION.md), and [COPADO-CONNECTOR.md](docs/COPADO-CONNECTOR.md) for the controls, evidence, and release-adapter contract.

## Commit the source

Extract this package and copy its contents into your existing `salesforce-delivery-agent` checkout. Review the source, then:

```bash
git add .
git commit -m "Add configurable Salesforce delivery sandbox pilot"
git push origin main
```

Do not upload the ZIP itself into the repository: commit the extracted source files.
