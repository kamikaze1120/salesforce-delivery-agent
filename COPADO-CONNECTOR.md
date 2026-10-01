# Copado integration milestone

The current app records pipeline configuration and exports a release handoff. It does **not** create Copado records, invoke Copado jobs, promote changes, or deploy to production through Copado. The manual mode is clearly labeled in the UI and backend.

## Discover before implementing

Identify the installed Copado product, package version, pipeline generation/format, environment mappings, Git conventions, licensed API capabilities, user-story object mapping, test tools, and existing release approvals. Copado API and job contracts vary by configuration; do not guess object API names or promote/deploy payloads from the BRD.

## Adapter contract

Implement a versioned server-only adapter with these operations:

| Operation | Input | Result |
| --- | --- | --- |
| Verify | Scoped integration credential, selected pipeline | Actual pipeline/environment IDs, capabilities, connector version |
| Bind work | Approved Jira stories, delivery ID, Git branch/commit | Copado user-story IDs with idempotency/reconciliation records |
| Prepare promotion | Exact commit/artifact hash, target environment | Immutable promotion/release ID and component diff |
| Validate | Promotion ID, required test policy | Real validation job ID, test evidence, dependency checks |
| Inspect | Job/release ID | Durable status, errors, tests, artifact identity |
| Deploy | Approved release ID and target | Deployment job ID, audit linkage |

The agent must not get direct production credentials. A production-capable release worker must independently check exact artifact and target identity, fresh validation, security findings, UAT acceptance, separation of duties, authorized approver identity, release window, branch protection, org drift, recovery plan, and approval expiration. Any artifact or target change resets approval. Missing evidence denies the operation.

Model output cannot create a production approval or override a failed pre-check. An approval tied only to a title, mutable branch name, or UI checkbox is insufficient. Production must be enabled only after the adapter and its positive/negative integration tests have been reviewed against a dedicated Copado test pipeline.

Use your existing Copado governance and recovery process. A successful validation does not guarantee a later deployment or business outcome. Data migrations and destructive changes require their own reviewed backup/recovery strategy.
