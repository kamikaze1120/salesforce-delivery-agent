# Setup and deployment

## 1. Inspect the source locally

Use Node.js 22 or newer. No package installation is required to run the code.

```bash
npm run dev
npm test
npm run build
```

The first launch offers a clearly labeled sample workspace. It makes no external changes. Live configuration is required to analyze an actual BRD or develop in your org.

## 2. Create the application database and identity service

Create a new Supabase project in an approved region. Run the entire `database/schema.sql` in the SQL Editor **once in a fresh project**. It creates workspaces, members, connections, deliveries, audit events, OAuth state, and request limits. Browser access to those tables is revoked. Only the backend's service role has access; every application operation also checks the authenticated user's workspace membership.

For an existing v0.1 database, run only `database/migrations/002_release_safety.sql` before deploying v0.2; do not rerun the table-creation schema. See `UPGRADE.md`.

In Supabase Auth, create your pilot users and confirm their emails. Self-registration is disabled by default. If you intentionally want it enabled, set `ALLOW_SIGNUP=true` and optionally `SIGNUP_EMAIL_DOMAINS=yourcompany.com`. Configure email delivery and Supabase password policies for your organization. Account recovery is managed through Supabase for this release.

Copy `.env.example` to `.env.local`. Fill in:

| Variable | Value |
| --- | --- |
| `APP_ORIGIN` | Exact origin: `http://localhost:3000` for local use; the stable HTTPS origin on Vercel |
| `SUPABASE_URL` | `https://PROJECT.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase project anon key, used by the backend for authentication |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key, **server-only** |
| `ENCRYPTION_KEY` | 32 random bytes encoded in base64, **server-only** |
| `SALESFORCE_API_VERSION` | A supported pinned API version, initially `65.0` |

Generate the encryption key locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Keep a secure backup of that key. Losing it makes saved connections unreadable. Rotating it requires re-encrypting stored credentials or reconnecting every integration, and existing sessions expire. Never use a `NEXT_PUBLIC_` prefix or expose either server secret to browser code.

## 3. Configure a workspace

Sign in, create a workspace, and open **Connections**. The owner configures accounts; developers run build/test operations; reviewers approve plans, code, releases, and acceptance; viewers inspect records. The owner can also act as a reviewer for a small pilot. Strict separation of duties is a future production requirement, not enforced for the owner in this release.

To add a teammate, create their account through Supabase Auth, copy its user UUID, and assign a role through **Connections → Manage team access**. This assigns an existing account; the app does not send an invitation email.

### Salesforce sandbox

In the Salesforce org, configure an External Client App with Web Server OAuth, PKCE, required client secret, and the `api` and `refresh_token` scopes. Set the callback exactly to:

```text
https://YOUR-STABLE-APP-ORIGIN/api/service?op=sfCallback
```

For local testing, use `http://localhost:3000/api/service?op=sfCallback` if permitted by your Salesforce client-app policies. Use different client apps for development and production-hosted pilot instances as appropriate.

Enter your sandbox My Domain URL, client ID, and client secret. Save and select **Authorize Salesforce**. The server uses one-use, account-bound OAuth state and S256 PKCE, then verifies `Organization.IsSandbox=true`. A production org is rejected regardless of what the entered URL looks like.

The connected Salesforce identity is used for workspace operations. Use a dedicated sandbox integration user with only the necessary API, metadata deployment, org-query, and Tooling API permissions. Teammates do not automatically execute under their own individual Salesforce identity. No production integration credentials are required.

### Jira Cloud

Enter the Jira origin, project key, account email, API token, and numeric issue type ID. Use a Task or Story type with the fields supported by this app. **Check connection** verifies project access, the selected type, and paginated creation-field metadata. Add required values in **Jira field defaults (JSON)**, for example `{"customfield_10001":{"id":"10002"}}`. Use actual field/option IDs from your project. Defaults support custom fields, priority, components, versions, assignee, reporter, due date, and environment. Project, issue type, summary, description, and tracking labels remain controlled by the app. Labels must be available on the create screen. The same preflight runs before each new issue write; Jira validates field values when creating the issue. Subtasks are not supported.

Descriptions use Atlassian Document Format. Each story includes its acceptance criteria, requirement IDs, delivery ID, and a unique marker label. Do not retry an ambiguous write until someone checks the project: Jira's search indexing can be eventually consistent.

### GitHub / Copado source

Select the Salesforce GitHub repository used by your pipeline, a base branch, and its source-format metadata directory. Use a fine-grained token limited to that repository with Contents read/write permissions. The repository must already contain at least one commit and the selected base branch.

The app uses `sfda/<delivery-id>` branches. It does not merge, force-push, or modify the base branch. A revision advances only that delivery's recorded branch when its head still matches the recorded commit. Review the diff through your normal Git/Copado process before any merge.

The repository containing this application is separate from the repository containing your Salesforce changes. GitHub Enterprise and other Git hosting providers require additional adapters.

### Copado

Answer the pipeline-type question and enter its pipeline name, dev/UAT environment names, and release owner. **This records a manual handoff configuration. It does not authorize or connect to Copado APIs.** Download the release bundle after testing, then continue through your existing Copado user story and promotion process. See `COPADO-CONNECTOR.md` for the next integration milestone.

### Development LLM

Choose OpenAI API or Azure OpenAI, enter the model/deployment name and API key, and, for Azure, its approved endpoint and API version. There is no assumed model name. Use a model that supports Chat Completions with JSON mode (`response_format: {type: "json_object"}`). Providers using a different API or output format need an adapter.

**Test model connection** sends one small synthetic request and verifies the returned JSON. It may incur provider charges; no BRD or org metadata is sent. Saving credentials alone does not mark the model verified. Verification records model usage in the audit log.

Analyzing sends the BRD, clarification answers, and selected org context to this provider. Generating sends the approved plan, answers, and selected org context. No integration credentials are included in either prompt. Use the model provider's organization/project quotas and data handling policy; application-side requests are capped at 12 model operations per user per hour.

## 4. Deploy to Vercel

1. Commit the extracted source files to your GitHub repository.
2. In Vercel, import the repository.
3. Select **Other**, build command `npm run build`, output directory `public`, and Node.js 22.
4. Set the server environment variables above. Do not include any real `.env.local` file in Git.
5. Use a stable HTTPS URL and set `APP_ORIGIN` to that exact origin, without a trailing slash.
6. Set the Salesforce OAuth callback to that origin and authorize the sandbox from the deployed app.
7. Confirm `/api/service?op=health` returns `configured:true` and `productionEnabled:false`. This only checks variable presence; sign in and test persistence to verify actual values.
8. Perform a small BRD-to-sandbox test with dedicated pilot accounts. Check Jira links, Git diff, test evidence, and Copado handoff before broadening access.

Do not reuse live credentials or the production database in untrusted preview deployments. The application has not been deployed to Vercel or tested against your live accounts during source creation.

## 5. Operating the pilot

- A browser refresh retrieves saved deliveries; asynchronous Salesforce IDs persist in Postgres.
- Select **Refresh Salesforce status** to poll validation/deployment jobs. A function does not wait for the entire deployment to finish.
- **Pause** stops subsequent app actions. It does not cancel work already submitted to Salesforce.
- Interrupted operations remain locked; ambiguous external writes are paused for reconciliation. Recovery is available only after the ten-minute lease expires and only when no external write outcome is unknown. A note alone cannot unlock an ambiguous write. Inspect the external system before recording findings and resuming. If an unknown deployment or Git write cannot be mapped conclusively, keep the delivery paused and reconstruct it through your normal release process. Do not clear database locks blindly.
- Sandbox approval expires after four hours and binds the exact validation ID, validation timestamp, artifact hash, Git commit, and target org. Validation must have succeeded within 24 hours. Approval cannot override failed prechecks.
- Connection editing is blocked while deliveries are running, polling a submitted deployment, or awaiting reconciliation. Token refresh uses a connection revision check to avoid overwriting newer settings.
- Every credential/account configuration change increments the workspace connection version. Start a new delivery after account changes so approvals bind to the correct accounts.
- Failed tests return the delivery to code review. Correct the files, approve again, commit a new revision to the isolated branch, and revalidate.
- After sandbox deployment succeeds, record observed results and evidence references for each acceptance scenario. This is a human sign-off, not automated UI testing.
- Backup the database and encryption key. Set your own retention, deletion, incident monitoring, and recovery policy before handling sensitive BRDs at scale.

## Test identities and live pilot accounts

The sample selector provides `owner@example.test`, `developer@example.test`, `reviewer@example.test`, and `viewer@example.test`. These are temporary browser fixtures; they do not have passwords, database records, or service permissions. Reloading resets the sample. It supports the included Service Request BRD and never generates fake deployment evidence.

For real authentication and tenant-isolation checks, use a separate Supabase staging project with the schema installed. Create confirmed test users in Supabase Auth using email aliases you control, then sign in through the deployed app. Create two workspaces under different owners; assign developer, reviewer, and viewer memberships in Connections. Verify that the developer cannot approve, the reviewer cannot generate, the viewer cannot write, and an unrelated account cannot access another workspace. Keep test credentials outside Git and configure dedicated sandbox/Jira test resources.

The public health response lists missing environment variable names only. `configured:true` means values are present, not that credentials or the database have been verified.

## v0.4 CI/CD update

Copado setup is no longer required for new pipelines. Follow [PIPELINE.md](PIPELINE.md) for the authoritative four-org GitHub Actions setup, MCP bridge, JWT credentials, Playwright sessions and production approval gates. Existing sections describing a sandbox-only/Copado pilot are historical. The web OAuth setup remains required for development analysis; runner JWT setup is separate.
