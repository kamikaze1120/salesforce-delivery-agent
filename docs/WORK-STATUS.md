# Work status — 2026-10-12

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
