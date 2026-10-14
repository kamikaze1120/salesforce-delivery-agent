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
