# Delivery controls and rollout — October 21, 2026

## Production continuation (B12)

Install `.github/workflows/salesforce-production.yml` in the configured runner repository alongside the delivery and reconciliation workflows. Protect its production environment with required reviewers and prevent self-review. Review and pin the new runner commit in workspace configuration before starting a new delivery. Existing runs retain their pinned policy and must not be migrated by editing their records.

The delivery workflow ends after UAT. Business approval creates a durable continuation intent tied to the exact UAT report before dispatching a fresh production workflow. Its OIDC identity must match the production workflow, pinned commit, environment and unique continuation title. It can claim production only once. The callback validity window starts at continuation creation, so an expired original worker does not prevent late approval. Credentials are obtained afresh by GitHub OIDC and the environment's JWT login.

An uncertain dispatch is not retried. Pause and investigate the recorded GitHub run before further action. Rejection is represented by withholding approval and pausing the delivery; a dedicated rejection/revision UI remains future work. This is locally verified continuation logic, not a live promotion rehearsal.

## Assertion evidence (B20/B25)

New Apex scenarios must map their requirement case to exact `apexMethods: [{className, methodName}]`. Approvers review whether those methods contain meaningful business assertions. The runner retains Salesforce test-run/result IDs and outcomes. Missing, duplicated, skipped or mismatched methods block business acceptance. A class name and a green aggregate cannot satisfy the gate.

Browser results include every step's hash, index, duration and passed/failed/blocked/skipped status. A confirmed text mismatch fails; an unavailable locator, session, navigation or network path blocks. Expected and actual text are hashed, never stored as raw page content. No raw exception, cookie, URL query or screenshot is exported. This preserves privacy but limits visual diagnosis. Full persona, controlled test-data and artifact evidence retention remain backlog work.

## Repair decisions (B26)

Only confirmed non-production Apex test failures with matching frozen release identities, completed validation/deployment and an available persisted repair budget qualify. Missing method evidence, browser infrastructure failures, deployment/setup failures, changed requirements, uncertain writes, pauses and production failures do not authorize generation. The response records the classification and next action. Static analysis and performance findings are not yet automatically repaired. The original BRD and frozen test files remain outside repair authority.

## Source ownership (B30)

Every new Git commit records delivery-owned source paths and Git blob hashes. Before a revision, a complete repository tree must match those hashes. Removed owned files receive explicit Git deletion entries; unrelated files remain untouched. New paths cannot overwrite unowned files. A changed source root or a legacy delivery without ownership records blocks and requires reconciliation; do not manually invent ownership records.

Git removals are **not** Salesforce destructive deployment instructions. Removing metadata from an existing org requires a separate reviewed destructive-change plan; no automatic org deletion was added.

## Setup preflight (B31)

Workspace owners can run **Connections → Run setup preflight**. The API checks the schema marker, development Salesforce connection, Jira required fields, a synthetic model request, and protected pipeline configuration. It returns passed/failed/unknown with remediation and a connection-version timestamp. It never returns provider error bodies or credentials. Model verification may incur the provider's normal usage charge.

Environment JWT keys, browser sessions, tool installation and destination identities cannot be verified from the web server. They remain explicitly unknown until protected runner/live checks provide evidence. A green connection check alone is not deployment readiness.

## Manual evidence (B27)

Current policy is automation-required: manual notes are supplemental, visibly labeled, and never satisfy automatic pipeline acceptance. Notes retain reviewer, timestamp, artifact and suite binding. Configurable manual exemptions, expiry policy and review workflow remain unimplemented; no exemption has been silently granted.

## Toolchain posture (B19/B36)

The bridge remains project-owned MCP, not Salesforce Hosted/DX MCP. It now uses the current dedicated CLI token command with fixed arguments and suppressed credential output. See [the dependency audit](TOOLCHAIN-AUDIT.md) for unresolved runner vulnerabilities. No claim of security clearance or full production readiness is made.
