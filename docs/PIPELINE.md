# CI/CD setup — v0.4

## 1. Know the two repositories and the five orgs

The application repository deploys the web UI/API to Vercel. A **private Salesforce source repository** contains the trusted deployment runner and feature branches. GitHub Actions is the long-running execution service; Supabase stores workflow state and evidence. No Copado connection is required.

Provision five distinct Salesforce orgs for Sandbox, QA, Dev, UAT and production. QA, Dev and UAT should normally be sandboxes. A verified Developer Edition may be selected for an explicitly non-production pilot. Never relabel your production org as a development org. The server and MCP bridge verify actual organization IDs and editions before work.

The default order follows the product requirement: Sandbox → QA → Dev → UAT → Production. Only the middle stages may be reordered. A repair always starts a new run from the first environment.

## 2. Install the trusted runner

Copy these files from a reviewed Delivery Studio release to the Salesforce source repository:

- `.github/workflows/salesforce-delivery.yml`
- Entire `runner/` directory
- `lib/core.mjs`, `lib/integrations.mjs`, `lib/store.mjs` (MCP bridge dependencies)

Use a protected branch such as `main`. Review all copied code, pin a tested Node/runtime/toolchain, and record the resulting 40-character commit SHA. Do not place runner logic on generated feature branches, run pull-request code with production secrets, or change the workflow’s name or path without updating identity validation. The pipeline fails if the configured trusted branch head moves until the new reviewed SHA is saved.

The workflow must exist on the default branch for `workflow_dispatch` to work. It installs the exact Salesforce CLI and Playwright versions from repository variables without lifecycle scripts, then installs Chromium. Test the selected versions before enabling secrets. Root web-app tests do not install or exercise those external tools.

## 3. Create protected GitHub environments

Create `sandbox`, `qa`, `dev`, `uat`, `production` (or your chosen names).

For **every environment**, restrict deployments to protected branches. Protect the trusted runner branch from force pushes/deletion and require status checks and code review. For **UAT and production**, add required human reviewers and enable **Prevent self-review**. Confirm these rules are actually enforced under your GitHub plan. A saved but unenforced rule is insufficient.

Set these repository variables:

| Variable | Value |
|---|---|
| `DELIVERY_APP_ORIGIN` | Exact Vercel app origin, matching its `APP_ORIGIN` |
| `DELIVERY_ENVIRONMENTS` | `{"sandbox":"sandbox","qa":"qa","dev":"dev","uat":"uat","production":"production"}`; values are your GitHub environment names |
| `SALESFORCE_CLI_VERSION` | Exact reviewed `@salesforce/cli` version, no `latest` or version ranges |
| `PLAYWRIGHT_VERSION` | Exact reviewed `playwright` version, no ranges |

The runner uses the hosted Ubuntu image’s Node.js runtime (Node 22+ required). For reproducibility, organizations should additionally pin their reviewed runner image and Node setup action. Review dependencies and update pinned versions through pull requests.

## 4. Configure Salesforce JWT authentication per environment

In each Salesforce org:

1. Create a dedicated least-privilege integration user and a separate external client app for CI.
2. Configure the Salesforce OAuth JWT bearer flow with a signing certificate. Grant API access, required metadata deployment access and Apex-test permissions. Configure permitted users/admin preauthorization appropriately.
3. Keep the private key in your secret manager; upload the public certificate to Salesforce. Do not reuse a production credential in lower environments.
4. Store the following **GitHub environment secrets**, not repository-wide secrets:

| Secret | Purpose |
|---|---|
| `SF_CLIENT_ID` | JWT client app consumer key |
| `SF_USERNAME` | Dedicated user for that target org |
| `SF_JWT_PRIVATE_KEY` | PEM signing key corresponding to its Salesforce certificate |
| `SF_BROWSER_STATE` | Optional Playwright storage-state JSON for a dedicated browser-test user; required when browser scenarios exist |

The runner authenticates with `sf org login jwt`, keeps its auth files in a private temporary home, and deletes them when it exits. Credentials, auth files, BRDs and raw traces are not uploaded as Actions artifacts. Environment secrets become available only after the environment’s required approval.

JWT configuration is **additional** to the existing web OAuth connection. Do not assume that creating the Delivery Studio web client has enabled JWT or connected production.

For browser tests, establish a legitimate dedicated test-user session using your organization’s approved login/MFA flow, then store its Playwright storage state as a secret. Do not disable MFA or bypass bot/session restrictions. Sessions expire and must be refreshed. Browser access is confined to the configured My Domain and derived Lightning host; additional trusted Salesforce/CDN/SSO hosts need an explicit reviewed adapter change. Production browser scenarios must use only navigation and assertions. The current suite applies to every stage, so a write scenario intentionally blocks production. Test users must have appropriate access for the scenarios; API integration credentials do not automatically authenticate browser users.

## 5. Configure GitHub in the application

Create a fine-grained GitHub token scoped only to the Salesforce source repository. It needs Contents read/write for isolated feature commits, Actions read/write for dispatch and run inspection, Metadata read, and sufficient read access to environment protection settings. Restrict branch and environment administration to administrators. Never grant the runner permissions to approve its own deployments.

Paste this structure into **Connections → GitHub CI/CD → CI/CD configuration** after replacing every placeholder:

```json
{
  "enabled": true,
  "ref": "main",
  "trustedCommit": "REPLACE_WITH_REVIEWED_40_CHARACTER_COMMIT_SHA",
  "maxRepairs": 2,
  "stages": [
    {"name":"sandbox","environment":"sandbox","orgId":"REPLACE_ORG_ID","kind":"sandbox","url":"https://YOUR-SANDBOX.my.salesforce.com"},
    {"name":"qa","environment":"qa","orgId":"REPLACE_ORG_ID","kind":"sandbox","url":"https://YOUR-QA.my.salesforce.com"},
    {"name":"dev","environment":"dev","orgId":"REPLACE_ORG_ID","kind":"sandbox","url":"https://YOUR-DEV.my.salesforce.com"},
    {"name":"uat","environment":"uat","orgId":"REPLACE_ORG_ID","kind":"sandbox","url":"https://YOUR-UAT.my.salesforce.com"},
    {"name":"production","environment":"production","orgId":"REPLACE_ORG_ID","kind":"production","url":"https://YOUR-PRODUCTION.my.salesforce.com"}
  ]
}
```

`maxRepairs` is 0–3. Zero disables automatic repairs. `kind: "developer"` is allowed only for a verified non-production Developer Edition org. All five org IDs must differ. `environment` must match both the GitHub environment and `DELIVERY_ENVIRONMENTS` mapping. Saving configuration invalidates existing approvals; create new deliveries after changing account bindings.

Run **Check connection**. The server verifies the runner SHA, active workflow, protected branch and environment rules. It does not prove the Salesforce JWT login or browser session works; the first stage preflight does that. Apply `database/migrations/003_pipeline.sql` to an existing database before starting a pipeline.

## 6. Human and automatic gates

- Human: approve requirements, mockup, implementation and test expectations before initial dispatch.
- Automated per stage: verify signed GitHub OIDC identity; bind workflow commit, environment, run and delivery; verify Salesforce org; check-only metadata validation; deploy with local tests and rollback-on-error; run named Apex and declarative browser tests; persist actual evidence.
- Human: approve GitHub UAT and production environment requests with self-review prevented.
- Repair: known non-production validation/test failures may trigger up to the configured budget. The model receives the original BRD, answers, approved design, metadata, frozen tests and observed failure. It can replace implementation content within existing file paths; permission sets and Apex test files remain frozen. Each repair creates a new Git commit and a new complete pipeline run.
- Stop: unknown write outcomes, missing credentials, manual-only scenarios, empty/no-op repairs, changed requirements, exhausted budget, failed production and policy drift.

Do not rerun an interrupted Actions job. Stage claims are single-use and GitHub `run_attempt > 1` is rejected. Inspect Salesforce deployment IDs and GitHub history, then reconcile state. The current UI does not provide automatic recovery of an interrupted pipeline; an administrator must investigate and reconcile the durable record before a fresh reviewed delivery/run. Never clear the marker solely to retry a deployment.

## MCP integration

`runner/mcp-server.mjs` implements a private stdio MCP server using newline-delimited JSON-RPC. `runner/mcp-client.mjs` initializes it, discovers the required tools and invokes only the allowlist. Tools: `inspect_org`, `validate_metadata`, `deploy_metadata`, `deployment_status`, `run_apex_tests`. The server rechecks the org before every call and reads a single immutable artifact package. It is project-owned, not a Salesforce-certified “360” connector.

The Salesforce-hosted MCP services are a separate optional future adapter: their available tools and org enablement must be discovered and verified; business-data MCP access must not be assumed to include metadata deployment. The local `@salesforce/mcp` package’s upstream repository announces end of life on November 2, 2026, so this implementation does not depend on it.

## Official references

- [Salesforce JWT authorization](https://developer.salesforce.com/docs/platform/sfdx-dev/guide/sfdx-dev-auth-jwt-flow.html)
- [Salesforce DX MCP source and lifecycle notice](https://github.com/salesforcecli/mcp)
- [Salesforce hosted MCP overview](https://developer.salesforce.com/docs/platform/hosted-mcp-servers/overview)
- [GitHub OIDC claims](https://docs.github.com/en/actions/reference/security/oidc)
- [GitHub environment protection](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [Playwright authentication](https://playwright.dev/docs/auth)

Before production: run a synthetic BRD through all non-production stages, exercise failure/repair and approval rejection, verify role isolation, review rollback/recovery procedures, confirm API limits and runner costs, and verify that no secrets or private BRD content enter public logs or Git history.
