# Connect a development sandbox

## 1. Confirm the app and database

Use the stable Vercel application URL configured as `APP_ORIGIN`, not a temporary preview URL. Sign in as a workspace owner. Apply the existing schema and numbered database migrations in order, including 004 for org locks. These instructions do not mean migrations have been applied. Run Connections → Run setup preflight to identify missing setup.

## 2. Register the Salesforce OAuth client

In the development sandbox, open Setup → External Client Apps → External Client App Manager and create an External Client App for Delivery Studio. Enable OAuth web server authorization. Set its callback URL to the exact value displayed in Delivery Studio → Connections → Salesforce:

`https://YOUR-STABLE-APP/api/service?op=sfCallback`

Select the `api` and `refresh_token` / `offline_access` scopes. Require PKCE and retain client-secret validation for web server and refresh-token flows; this application exchanges codes on its backend. Configure app access for the intended user under your organization's access policy. Save and retrieve its Consumer Key (client ID) and Consumer Secret. Enter secrets only in the app's connection form, never in Git, a BRD, or a chat message.

Salesforce reference: [OAuth web server flow](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_web_server_flow.htm&language=en_US&type=5) and [External Client App OAuth settings](https://help.salesforce.com/s/articleView?id=sf.configure_external_client_app_oauth_settings.htm&language=en_US&type=5).

## 3. Authorize in Delivery Studio

Select Sandbox, enter the sandbox's My Domain login origin (`https://YOURDOMAIN--dev.sandbox.my.salesforce.com`), and copy the Organization ID from Setup → Company Information into Expected organization ID. Use the login domain, not a Salesforce Setup URL or a Lightning page path. Save the client ID and secret, then use Authorize Salesforce and sign in to that sandbox. The server verifies environment and expected org identity.

Refresh the license & capability report. Inspect edition, API limits, license inventory and unknown probes. System Administrator access alone does not establish every product entitlement. BRD analysis sends selected metadata and requirements to the workspace's configured LLM provider; select the approved provider before uploading internal requirements.

## 4. Prepare deployment credentials separately

Web authorization connects the app. GitHub Actions uses separate per-environment JWT authentication: `SF_CLIENT_ID`, `SF_USERNAME` and `SF_JWT_PRIVATE_KEY`, with the corresponding public certificate configured in Salesforce. Never paste the private key into this document. Follow [PIPELINE.md](PIPELINE.md) for all environment secrets, pinned tool versions, source repository, trusted runner commit and reviewed quality policies. Browser tests additionally need the dedicated test-user session described there.

The current pipeline requires four distinct orgs: Dev, QA, UAT and Production. Having one Dev sandbox permits initial connection and controlled sandbox verification, but does not satisfy the full promotion rehearsal. UAT and Production need protected GitHub environments and human reviewers. Business approval remains required before production.

## 5. Evidence before calling setup complete

Record successful OAuth identity verification, capability results, database preflight, Jira/model/source-repository connection checks, and a deliberately scoped synthetic sandbox validation. Then verify deployment, Apex/business assertions and recovery using the live-check backlog. Missing metadata, Flow testing, official Hosted MCP integration and other open implementation work remain explicit limitations. The current project-owned MCP bridge is not an activated Salesforce Hosted MCP connection.

A connection check is read-only. Any sandbox deployment must use the app's reviewed plan/code/validation gates. This guide does not authorize a Salesforce production deployment.
