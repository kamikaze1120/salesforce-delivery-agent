# Runner interruption and pause safeguards

## Durable journal

Each claimed stage contains `operations` in the existing job JSON. No new database migration is needed for this journal. The authenticated runner API records changes under the delivery's versioned lock and audit transaction.

| Phase | Persisted evidence | If the worker disappears |
|---|---|---|
| `intent` | Operation kind, artifact hash, run ID and start time | Submission may or may not have reached Salesforce. Never replay it automatically. |
| `submitted` | Salesforce `0Af` operation ID and submission time | Inspect that exact ID in the exact target org. Do not create a replacement deployment. |
| `completed` | Same ID, explicit success/failure and completion time | Retain the result; only successful validation can authorize deployment. |

The intent response must succeed before submission. The ID checkpoint must succeed before polling. Terminal completion must be recorded before the next operation. Lost checkpoint responses stop the worker conservatively. Repeated reporting of the same ID/outcome is idempotent; conflicting IDs or outcomes are rejected. A passed stage requires both saved successful IDs to match its report. Unresolved operations force an unknown outcome and prohibit automatic repair, generic recovery and starting another pipeline.

## Pause behavior

Pause blocks new stage claims, validation/deployment intents, Apex scenarios, browser steps and automatic repair. It does not block the authenticated runner from recording an ID or terminal outcome, or submitting a final report. Read-only polling of an operation already submitted to Salesforce continues so the result is not lost.

This is cooperative pause at action boundaries, not atomic distributed cancellation. An operation authorized just before pause may already have started. A browser action or Apex test already running can finish. No Salesforce cancellation API is implemented. A paused delivery stays paused even if its in-flight stage records a successful outcome.

## Current recovery limit

The CI/CD screen displays each stage’s saved operation journal: operation kind, phase/outcome, Salesforce ID, GitHub run ID, artifact hash and checkpoint timestamps. These are saved runner records, not a live Salesforce status query. Pipeline start is disabled in the UI while paused or awaiting reconciliation, or when any operation is unresolved; server-side guards remain authoritative. The journal is also available in the delivery export under `pipeline.stages[].operations`. A reviewer must match the target org, artifact hash, GitHub run and Salesforce operation ID. Do not clear flags manually, rerun a GitHub job or submit a second deployment to work around an unknown outcome.

B10 includes journal visibility and an authenticated read-only status workflow. A controlled recovery transition and live Salesforce rehearsal remain outstanding. The journal display cannot resolve an unknown outcome or authorize promotion. An `intent` without an ID requires investigating the Salesforce deployment history and runner records before any future recovery. Journaling cannot eliminate the gap between a remote submission and receipt of its ID.

Local tests exercise interruption after intent and ID persistence, mismatched IDs, replay prevention, pause handling, run binding and immutable completion. A disposable-org fault-injection rehearsal is still required. Org-wide locks, production recovery, business-approval continuation and full promotion rehearsal remain separate backlog items.


## Read-only MCP reconciliation foundation

The project-owned MCP server now supports `DELIVERY_MCP_MODE=reconciliation`. This mode advertises only `inspect_org` and `deployment_status`. Both the client and server reject deployment, validation and Apex execution. The server validates tool arguments before making an org query, verifies org ID/type/URL for permitted calls, and only accepts the exact saved operation IDs from a constrained manifest. No deployable artifact is loaded in this mode. An unknown or empty mode fails closed; existing delivery jobs that omit the mode retain their normal tool set.

The mode requires `DELIVERY_TARGET_FILE` and `DELIVERY_RECONCILIATION_FILE`, plus an already authenticated `delivery-target` CLI alias. The version-1 manifest contract is:

```json
{
  "version": 1,
  "pipelineId": "12345678-1234-1234-1234-123456789abc",
  "stage": "dev",
  "orgId": "00D000000000001AAA",
  "targetKind": "developer",
  "targetUrl": "https://example.my.salesforce.com",
  "artifactHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "runId": "123",
  "operations": [{
    "kind": "validation",
    "phase": "submitted",
    "id": "0Af000000000001AAA",
    "artifactHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "runId": "123"
  }]
}
```

These are synthetic example values, not usable org credentials. Up to two unique submitted operations (validation/deployment) may be included. Intent-only, completed, duplicated or mismatched records are rejected. An intent with no ID remains blocked for investigation.

**This manifest is not authentication or authorization.** The trusted worker receives it from the persisted journal through authenticated API callbacks, with original target/run/artifact bindings verified server-side. The workflow records observations but does not clear pause/reconciliation flags or authorize promotion. A controlled recovery transition is still required. Do not hand-edit a manifest to resolve application state. B10 remains in progress.

Verification includes policy rejection tests and a real MCP subprocess against an offline simulated Salesforce transport. The subprocess checks supported reads, wrong-org rejection and blocked writes without Salesforce credentials. Live org compatibility and recovery rehearsal remain unverified.


## Requesting an authenticated status check

1. Ensure the protected runner branch and reviewed `trustedCommit` include `salesforce-reconciliation.yml`, `runner/reconcile.mjs` and the corresponding server changes. Existing deliveries with an older pinned runner or changed connection settings are blocked; do not edit stored policy to bypass this check.
2. Configure the same `DELIVERY_ENVIRONMENTS`, `DELIVERY_APP_ORIGIN`, pinned `SALESFORCE_CLI_VERSION` and stage-specific JWT credentials used by delivery. UAT/production environment reviewer rules remain in force. The recovery job does not receive browser-session credentials or install browser/scanner tools.
3. Pause the delivery. As an owner or reviewer, open CI/CD and select **Check saved Salesforce status** for a stage with submitted IDs. The API confirms that the original GitHub delivery run is completed, verifies branch/environment protections, and snapshots the persisted journal. An active runner or an intent without an ID blocks dispatch.
4. The request ID and snapshot are saved under the job lock before GitHub dispatch. A lost dispatch response remains `dispatch_unknown`; it is not automatically sent again. Inspect the existing run/request instead of using GitHub Re-run jobs.
5. The workflow uses GitHub OIDC to claim the request. Repository, protected ref, pinned workflow SHA, reconciliation workflow filename, environment, request-specific run title and first run attempt must match. One GitHub run may claim a request. Recovery callbacks expire 24 hours after the request was created; delayed or interrupted runs cannot report after expiry. Reviewers may retire an interrupted request under the rules below.
6. The worker checks each saved ID once through the restricted MCP mode. It records an explicit terminal or in-progress observation. An in-progress result remains unresolved; after that worker finishes, a reviewer may request another read. All observations retain the original release identity.

`pipeline.reconciliation` stores the current request and its redacted outcome; previous observed or retired requests are retained in `pipeline.reconciliationHistory`. Terminal results update only the corresponding operation journal records. They never mark a stage passed, replace acceptance evidence, clear pause/reconciliation flags, repair artifacts, or authorize another deployment. A generic **Record reconciliation** note cannot unlock a pipeline that has a reconciliation request.

### Retiring an interrupted status check

An owner or reviewer can select **Retire interrupted status check** while the delivery is paused and its lock is free. Enter an investigation reason (20–2,000 characters). This retires only the read request; it does not resolve an operation, restart a deployment or clear the pause.

- If the request has a claimed GitHub run ID, the server fetches that exact run and requires it to be completed with the original trusted commit and request-specific title. Stop an active workflow before retrying retirement.
- If no run ID was claimed, the request must be at least 24 hours old. Its callback authorization has then expired; an uncertain dispatch is never automatically retried.
- Retirement records the reviewer, reason, time and verification basis. Old context claims and result callbacks are rejected. A subsequent status-check request gets a fresh ID and journal snapshot, while the retired request remains in history.
- Deployment operation IDs, outcomes, stage state and approval requirements are preserved. A retired request cannot unlock generic recovery or authorize promotion. Existing connection-version and job-lock checks still apply.

### Remaining B10 limitations

- Controlled reviewer recovery transitions, including decisions about missing tests and safe continuation, are not implemented.
- A busy job with an expired lease is not automatically taken over. Requests rejected because of a stale lock remain blocked for administrator investigation; never clear a lock or outcome flag manually to replay a write.
- Interrupted requests require explicit reviewer retirement before a new read can be requested. Active claimed workers and unclaimed requests younger than 24 hours remain blocked. There is no automatic redispatch of an uncertain request.
- Missing IDs, target/configuration changes and contradictory Salesforce outcomes stay unresolved.
- GitHub dispatch and callback behavior are covered with simulated transport and signed synthetic OIDC tokens. No live Salesforce recovery run or production promotion has been verified.
