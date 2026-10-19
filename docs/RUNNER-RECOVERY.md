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

B10 now includes reviewer visibility of the journal. The authenticated live status reconciliation worker and supported recovery transition remain outstanding. The journal display cannot resolve an unknown outcome or authorize promotion. An `intent` without an ID requires investigating the Salesforce deployment history and runner records before any future recovery. Journaling cannot eliminate the gap between a remote submission and receipt of its ID.

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

**This manifest is not authentication or authorization.** A future trusted worker must receive it from the persisted journal through an authenticated API, with the original target/run/artifact bindings verified server-side. The current change does not add a dispatch endpoint, workflow, reconciliation result recorder or recovery transition; it does not clear pause/reconciliation flags or authorize promotion. Do not hand-edit a manifest to resolve application state. B10 remains in progress.

Verification includes policy rejection tests and a real MCP subprocess against an offline simulated Salesforce transport. The subprocess checks supported reads, wrong-org rejection and blocked writes without Salesforce credentials. Live org compatibility and recovery rehearsal remain unverified.
