# Connect a development sandbox

## 1. Confirm the app and database

Use the stable Vercel application URL configured as `APP_ORIGIN`, not a temporary preview URL. Sign in as a workspace owner. Apply the existing schema and numbered database migrations in order, including migration 004 for org-wide target locks. Run **Connections → Run setup preflight** against the intended workspace; a saved report from another workspace or an earlier migration state is not current evidence.

## 2. Register the Salesforce OAuth client

In the development sandbox, open **Setup → External Client Apps → External Client App Manager** and create an External Client App for Delivery Studio. Enable OAuth web server authorization. Set its callback URL to the exact value displayed in **Delivery Studio → Connections → Salesforce**:

`https://YOUR-STABLE-APP/api/service?op=sfCallback`

Select the `api` and `refresh_token` / `offline_access` scopes. Require PKCE and retain client-secret validation for web-server and refresh-token flows; this application exchanges codes on its backend. Configure app access for the intended user under the organization's access policy. Save and retrieve its Consumer Key (client ID) and Consumer Secret. Enter secrets only in the application's connection form, never in Git, a BRD, logs or chat.

Salesforce references: [OAuth web server flow](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm&language=en_US&type=5) and [External Client App OAuth settings](https://help.salesforce.com/s/articleView?id=sf.configure_external_client_app_oauth_settings.htm&language=en_US&type=5).

## 3. Authorize in Delivery Studio

Select **Sandbox**, enter the sandbox My Domain login origin (`https://YOURDOMAIN--dev.sandbox.my.salesforce.com`), and copy the Organization ID from **Setup → Company Information** into **Expected organization ID**. Use the login origin, not a Salesforce Setup URL or Lightning page path. Save the client ID and secret, then use **Authorize Salesforce** and sign in to that sandbox. The server verifies the environment and expected org identity.

Refresh the license and capability report. Inspect edition, API limits, license inventory and unknown probes. System Administrator access alone does not establish every product entitlement. BRD analysis sends selected metadata and requirements to the workspace's configured LLM provider; select the approved provider before uploading internal requirements.

## 4. Prepare runner credentials separately

Web authorization connects the application. GitHub Actions uses separate per-environment JWT authentication: `SF_CLIENT_ID`, `SF_USERNAME` and `SF_JWT_PRIVATE_KEY`, with the corresponding public certificate configured in Salesforce. Never paste the private key into this document.

Follow [PIPELINE.md](PIPELINE.md) and [ENVIRONMENT-READINESS.md](ENVIRONMENT-READINESS.md) for environment secrets, protected branches, required reviewers, pinned tool versions, source repository settings, trusted runner commit and reviewed quality policies. Browser tests additionally need dedicated test-user sessions.

The promotion workflow requires four distinct org identities: Dev, QA, UAT and Production. One Dev sandbox permits initial connection and controlled validation, but it does not satisfy a full promotion rehearsal. UAT and Production require protected GitHub environments and independent human reviewers. Business approval remains required before production.

## 5. Run the read-only setup verification

In the private Salesforce source repository, run **Actions → Salesforce setup verification → Run workflow** for a configured non-production target. The setup workflow authenticates, validates the expected org identity and exposes only the restricted inspection tools documented in [ENVIRONMENT-READINESS.md](ENVIRONMENT-READINESS.md). It does not deploy metadata, execute Apex or change business records.

A successful setup probe is necessary but not sufficient. It does not certify deployment permissions, browser sessions, project-specific quality policies, business requirements or production readiness.

## 6. Evidence before calling setup complete

Record successful OAuth identity verification, current preflight results, source-repository protection, JWT setup verification, Jira/model connection checks and a deliberately scoped synthetic sandbox validation. Then verify deployment, Apex/business assertions, failure handling and recovery using the live-check backlog.

Missing full metadata retrieval, Flow testing, official Hosted MCP integration and other open work remain explicit limitations. The current project-owned MCP bridge is not an activated Salesforce Hosted MCP connection.

A connection or setup check is read-only. Any sandbox deployment must use the reviewed plan, code, validation and approval gates. This guide does not authorize a Salesforce production deployment.
