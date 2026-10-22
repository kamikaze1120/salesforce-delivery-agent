# Work status — latest checkpoint 2026-10-20

## Checkpoint 1: critical audit corrections

Branch: `fix/audit-critical-safety`, based on main `a064749`.

- All 35 audit items are tracked in BACKLOG.md.
- B01: corrected runner POST routing; HTTP tests confirm that requests reach identity verification and missing/invalid identities remain blocked. Live successful GitHub OIDC execution is still unverified.
- B02: structural XML parsing reads overall Salesforce deployment outcome independently of nested components. Contradictory success, errors, ambiguous values and malformed XML cannot produce a successful result.
- B03: structural permission checks close namespace, numeric-boolean and entity spelling bypasses for the existing forbidden administrative permissions. Broad object grants are also blocked. This is not the complete security adapter or a full least-privilege policy.
- B04: added five regression test groups covering the above. Full suite: **61 passed, 0 failed**. Syntax build and git whitespace checks passed.
- Locked fast-xml-parser dependency; CI and Salesforce runner installation now install application dependencies. README setup instructions updated.

## Verification limits

- Local runtime was Node 24.19.0. Attempt to obtain Node 22 for an additional check was interrupted by network approval cancellation.
- `npm audit --omit=dev` was interrupted by network approval cancellation. No clean vulnerability-scan claim is made.
- No live Salesforce changes or production deployment were performed in this checkpoint.
- Quality adapters B05–B08 still block promotion; no missing check was converted into a pass.
- Remaining work requires both implementation and live evidence. Jira, LLM, destination orgs, test users, sessions, GitHub environment configuration and database migration must be verified before the end-to-end pilot.

## Next implementation work

1. B05–B08: define reviewed policies and evidence contracts, then implement applicable security, performance, destination-license and regression adapters.
2. B09–B13: durable operation checkpointing, reconciliation, pause behavior, approval continuation and org-wide locks.
3. Continue remaining items in BACKLOG.md; preserve immutable requirements and tests during repairs.

Daily usage remaining is not visible. This file is a durable checkpoint, not a scheduled background job or a promise of work after the session stops.

## Publishing status

The initial command-line push had no GitHub authentication. The tested changes are now being published through the authorized GitHub browser session on `fix/audit-critical-safety`, including this backlog and status report. The branch uses several browser commits instead of the local checkpoint commit. GitHub check results and Vercel preview status are recorded on the associated pull request; local test success alone is not a deployment claim. Main and Salesforce production have not been changed by this correction checkpoint.


## Checkpoint 2: security preflight — 2026-10-13 (B05 in progress)

- Added an isolated, artifact-bound Code Analyzer v5 PMD Security adapter for Apex-only packages. All reported security findings fail; suppression markers, missing engine evidence, bad counts, failures and unsupported metadata block.
- Security preflight now runs before Salesforce authentication, validation or deployment. Scanner subprocesses receive no Salesforce/JWT/GitHub credentials. Source excerpts and scanner messages are excluded from evidence.
- The runner installs an exact reviewed `CODE_ANALYZER_VERSION` into a separate tool home. Every stage requires this variable; Java 11+ is required.
- Seven new fixture-based regression groups; **68 local tests passed**, syntax build passed. Live scanner and GitHub checks are tracked separately; fixture success is not proof of tool interoperability.
- B05 remains in progress: permission/Flow/LWC/object policies, runtime authorization tests and the live Salesforce pilot are not implemented or verified. Performance, destination-license and baseline-regression categories remain blocked.
- No Salesforce deployment or production change was performed.

Live-tool attempt: Salesforce CLI 2.153.5 installed locally and Java 17 was available. Installing Code Analyzer 5.16.0 through the CLI failed twice with a registry lookup error. A real scan was not executed; no scanner interoperability or Salesforce readiness claim is made.

Publishing checkpoint — 2026-10-14: the security adapter, runner wiring, pinned-tool installation, workflow variables, seven regression groups, README and policy documentation were committed through the GitHub editor to `fix/audit-critical-safety` (PR #3). B05 remains in progress. Final CI results belong to the current PR head; older successful checks do not certify these changes. Main and Salesforce production remain unchanged.


## Checkpoint 3 — 2026-10-14

- B05: added a credential-free real-scanner CI job, using a shared isolated installer and positive/negative synthetic Apex fixtures. A real scanner result must be observed separately; mocked unit tests do not prove installation or rule execution. Broader metadata/security policies remain pending.
- B09: operation intents, Salesforce IDs and completion outcomes now persist in the stage journal through authenticated, locked API calls. Submission is never retried; unknown outcomes block recovery and new pipeline dispatch. Passing reports must match durable IDs. Local interruption and invariant tests added; live fault injection remains pending.
- B11: pause is checked at operation and test action boundaries; authenticated outcome recording remains possible while paused. Existing Salesforce operations continue read-only polling to record the actual outcome. In-flight cancellation and a UI for reconciliation remain pending.
- B06–B08 stay blocked pending approved performance policies, destination entitlement rules, and a representative regression baseline. These cannot safely be replaced with invented pass evidence.
- No Salesforce org was modified and no production promotion was started for this checkpoint.

### Verification follow-up — 2026-10-15

All 75 local tests and JavaScript syntax checks passed. GitHub's real-scanner job succeeded at commit `50940ab` (run `38617194532`, job `116035202934`), using CLI 2.153.5 and Code Analyzer 5.16.0. The job asserts both a clean result and detection of PMD ApexSOQLInjection in the documented concatenated-query fixture. The original direct-input fixture was not detected and caused CI to fail; it was replaced with the documented rule example. This demonstrates limited rule execution, not complete vulnerability detection. Salesforce org execution and runtime authorization remain unverified.


## Checkpoint 4 — backlog story catalog, 2026-10-19

- Expanded all 35 existing audit IDs into Jira-style stories across six epics, with a repository-maintained Kanban summary, dependencies, acceptance checklists and evidence requirements. No Jira issues or GitHub Projects board were created by this documentation change.
- Snapshot: 25 backlog, 3 in progress, 5 awaiting remaining verification and 2 blocked on live setup. No story is declared fully verified. Implemented fixes retain their existing evidence descriptions.
- Included the merged B10 journal visibility checkpoint (`ec5e04d`): 76 local tests and three passing PR checks were recorded for that earlier code change, not rerun or claimed as new execution here. Live reconciliation remains outstanding.
- Validated all 35 unique story IDs, index entries and required story fields; README points to the expanded catalog. This change does not modify application behavior or execute Salesforce operations.


## Checkpoint 5 — B10 read-only MCP foundation, 2026-10-19

- Added an explicit reconciliation mode that exposes only org inspection and exact journal-ID status reads. Unknown modes, write tools, extra arguments and mismatched manifest bindings fail closed. Recovery mode does not load deployment artifacts.
- The client rejects a reconciliation server that advertises extra tools and blocks write calls before transport. The server independently enforces policy and retains target org identity checks.
- Five focused tests cover immutable ID allowlists, manifest mismatches, delivery compatibility, client discovery and the actual MCP subprocess using an offline Salesforce transport. No live Salesforce credentials or calls are involved.
- B10 remains in progress: the manifest is not authorization. Authenticated worker dispatch, result recording, controlled recovery and live verification are still required. No pause/reconciliation flag is cleared and no promotion is enabled by this foundation.
- Validation: 81 local tests passed; JavaScript syntax and whitespace checks passed. Local runtime was Node 24.19.0 (package declares Node 22.x); required remote checks must pass separately.


## Checkpoint 6 — authenticated read-only reconciliation, 2026-10-19

- Added reviewer-only status-check dispatch, durable request snapshots before dispatch, original-run completion checks and request-bound GitHub OIDC callbacks. Recovery identity cannot be used as delivery identity.
- Added a protected-environment GitHub workflow and a one-observation-per-ID worker using the restricted MCP mode. No deployment, tests, repair or promotion are invoked by this worker.
- Server recording validates the complete observation batch before mutating journals, rejects conflicting/duplicate/stale outcomes and keeps the pipeline stopped and paused. Generic reconciliation notes cannot unlock these requests.
- CI/CD now offers **Check saved Salesforce status** and displays request state/results. README and recovery instructions describe setup, 24-hour expiry, lost dispatch responses and stale-lock limitations.
- B10 remains in progress: controlled recovery decisions, stale lease/request handling and live Salesforce rehearsal are outstanding. No live Salesforce workflow was dispatched in this checkpoint.

Publishing verification — 2026-10-20: all 93 local tests passed; JavaScript syntax and whitespace checks passed, and the new workflow YAML parsed successfully. Tests use simulated transport and synthetic signed OIDC identities; no live recovery dispatch or Salesforce call was performed. Local Node was 24.19.0; the package declares 22.x. Remote checks are tracked on the publishing PR.


## Checkpoint 7 — interrupted reconciliation request retirement, 2026-10-20

- Owners/reviewers can retire an interrupted read request with an audited reason. Claimed requests require server-confirmed completion of the exact GitHub run, trusted commit and request title; unclaimed requests must reach their 24-hour callback expiry.
- Retired callbacks are rejected. A new read request receives a fresh ID and snapshot; prior requests remain in history. Operation journals, paused state and unresolved recovery requirements are preserved.
- Added retirement controls, escaped reviewer-note rendering and regression coverage for active/wrong runs, expiry boundaries, stale callbacks, replacement history and developer-role rejection.
- Validation: 97 local tests passed; JavaScript syntax and whitespace checks passed. Local Node was 24.19.0 (package declares 22.x). Remote checks are tracked on the publishing PR.
- B10 remains in progress: stale locks, controlled recovery decisions and live Salesforce rehearsal remain outstanding. No Salesforce operation or production promotion was performed.


## Checkpoint 8 — B05–B08 reviewed quality adapters, 2026-10-20

- B05: expanded static policy to constrained private objects and permission sets; runtime security requires exact pinned Apex methods covering allow/deny CRUD, FLS and sharing. Unsupported metadata remains blocked and is documented under B16/B17/B22 dependencies.
- B06: added approved workload/budget policies and measured Apex runtime, instrumented CPU/query/DML/record-volume, plus browser elapsed-time checks. Missing, duplicated, malformed or mismatched measurements block.
- B07: added destination-specific sourced edition, license capacity, runner-user assignment/license, object access and limit rules. The signed runner must persist a fresh passing preflight before each metadata intent; old/foreign/partial evidence cannot authorize a write.
- B08: added independent reviewed Apex/browser baselines, exact-method outcomes, pre-deployment and before/after-test source checks, and source-hash protection against generated/repair changes.
- Policy snapshots are retrieved from `quality/policies/<planHash>.json` at the reviewed runner commit, bound to all target orgs, and retained with release evidence. No AI pass files or category waivers are accepted. Added an intentionally incomplete setup template generator and detailed setup documentation.
- CI/CD now displays category results and actual measurements; UAT reports include the policy review/hash. Recovery MCP mode retains exactly its two read-only tools.
- Local validation: 112 tests passed, including signed preflight API tests, a real MCP subprocess using offline Salesforce/CLI transport, schema rejection, numeric telemetry, browser duration, source drift, metadata security and UI escaping tests. Syntax/whitespace checks passed. Node 24.19.0 was used locally; remote checks are recorded on the publishing PR.
- B05–B08 move to **Verification**, not Done. Required live evidence and project-specific approved workloads/license requirements/baselines are still outstanding. Expanded metadata/security support, dedicated Flow testing, package-version dependency resolution and full persona/session support remain in B15–B18/B21–B22.
- Board: 23 backlog, 2 in progress (B10/B11), 9 verification (B01–B09), 2 live-setup blocked (B32/B33), 0 declared fully verified. No Salesforce org changes or production promotion were performed.

- Remote scanner correction: plugin 5.16.0 reports analyzer core 0.53.0 and PMD adapter 0.46.0. These are independent version namespaces; a mistaken equality check was removed and the actual observed combination added to regression coverage. Installation pins and version-presence checks remain enforced.
- Newly discovered B36: real CLI installation reported 64 dependency vulnerabilities (16 moderate, 47 high, 1 critical); application-only install reported zero. Toolchain advisory triage and reviewed pin remediation remain outstanding. This is recorded separately from generated Salesforce security findings.


## Checkpoint 9 — October 21, 2026

Implemented production continuation (B12), Git ownership/removal checks (B30), and documented current architecture contracts (B34). Added assertion-level evidence, redacted browser diagnostics, constrained repair classification, consistent manual-test wording, owner setup preflight and CLI credential compatibility fixes (B19/B20/B25–B27/B31). The CLI dependency audit reproduces 64 findings; B36 remains unresolved with documented high/critical dispositions.

126 local tests and syntax checks passed before documentation updates. Live pilot/rehearsal excluded per request. Remaining board: 13 backlog, 9 in progress, 12 verification, 2 live-blocked, 0 fully accepted Done. No new skill was created; the existing agent-building skill guided runtime boundaries. More implementation remains; this checkpoint does not claim the entire backlog is finished.


## Checkpoint 10 — October 22, 2026

PR #11 publishes checkpoint 9. Added global org locks (migration 004) across pipeline and direct sandbox writes, with no expiry takeover and verified-terminal release. Reviewer recovery now accepts observed terminal results from a stopped exact runner, preserves pause and forces a new pipeline for missing tests. 127 application tests plus credential-free SQL checks and syntax checks passed locally. No live migration or Salesforce call was performed.

Board: 12 backlog, 8 in progress, 14 verification, 2 live-blocked, 0 Done. Remaining implementation is not complete. No new skill created.

## Checkpoint 11 — browser resource policy

B21 now has reviewed exact HTTPS Salesforce resource origins, blocked-request evidence, and disabled service workers. Network failures cannot appear as passing business scenarios. Live Lightning compatibility remains outstanding. Board: 11 backlog, 9 in progress, 14 verification, 2 live-blocked.

Verification: 129 local tests, JavaScript syntax checks and whitespace checks passed. No live browser/Salesforce test or database migration was executed. Official MCP constraints and local DX MCP retirement are documented in DELIVERY-CONTROLS.md.

## Checkpoint 12 — production identity and repair evidence

Signed RSA/OIDC tests confirm the production continuation accepts only its exact workflow, protected environment, pinned commit and continuation run title. Old delivery workers, other continuations, re-runs and expired identities are rejected. Repair now also requires terminal deployment results matching durable operation IDs and exactly one result for every approved scenario with all mapped assertions present. 131 local application tests, syntax and whitespace checks passed. No new skill was created. Live checks remain excluded.
