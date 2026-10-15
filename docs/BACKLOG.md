# Delivery platform backlog

Baseline: independent audit of main `a064749`, 2026-10-12. Status is implementation status, not proof of live Salesforce execution. No item is complete until its acceptance criteria have evidence. Never turn a missing quality adapter into a pass.

| ID | Priority | Work | Status | Acceptance criteria / expected result |
|---|---|---|---|---|
| B01 | P0 | CI runner routing | Implemented; local tests pass | POST reaches runner authentication; invalid identities remain blocked; HTTP regression tests pass. |
| B02 | P0 | Deployment XML parsing | Implemented; local tests pass | Parse overall result independently of component outcomes; inconsistent success is rejected. |
| B03 | P0 | Permission XML policy | Implemented; local tests pass | Namespace-equivalent permissions receive identical structural checks; forbidden access is rejected. |
| B04 | P0 | Critical regression tests | Implemented; local tests pass | Reproduce B01–B03 and verify their corrected behavior. |
| B05 | P0 | Security quality adapter | In progress: Apex static preflight and real-scanner CI added; broader metadata and runtime policies pending | Reviewed static analysis and permission policy produce artifact-bound evidence before promotion. |
| B06 | P0 | Performance quality adapter | Backlog | Representative bulk, limit and UI scenarios meet explicit approved thresholds. |
| B07 | P0 | Destination license gate | Backlog | Every target provides applicable feature, permission, limit and dependency evidence; unknown blocks. |
| B08 | P0 | Baseline regression adapter | Backlog | Approved existing-behavior tests run and retain results for each applicable stage. |
| B09 | P1 | Durable Salesforce operation IDs | Implemented; interruption regression tests pass; live fault injection pending | IDs persist immediately after submission; interrupted writes are never blindly retried. |
| B10 | P1 | Recovery and reconciliation | Backlog | Worker and reviewer flow resolve actual Salesforce/GitHub outcomes after interruption. |
| B11 | P1 | Pause and cancellation | In progress: action-boundary pause and paused outcome reporting implemented; in-flight cancellation pending | Pause stops subsequent writes; authenticated outcome reporting remains available. |
| B12 | P1 | Business approval continuation | Backlog | Exact UAT release resumes safely after business approval regardless of approval timing. |
| B13 | P1 | Org-wide deployment locks | Backlog | Concurrent deliveries cannot mutate the same target through this platform. |
| B14 | P1 | Existing metadata retrieval | Backlog | Relevant source, Flows, permissions, sharing and dependencies are retrieved with explicit limits. |
| B15 | P1 | Dependency and drift checks | Backlog | Baseline differences and missing dependencies block stale deployments. |
| B16 | P1 | Expanded metadata support | Backlog | Standard-object changes, triggers, justified profiles, UI metadata and custom metadata have validated writers. |
| B17 | P1 | Flow testing and activation | Backlog | Reviewed versions execute tests, activate deliberately and have recovery evidence. |
| B18 | P1 | License analysis engine | Backlog | Source-backed rules separate entitlements, assignments, effective access and limits; alternatives are verified. |
| B19 | P1 | Official Salesforce MCP adapter | Backlog | Auth and discovery identify supported Hosted/DX tools; custom fallback is labeled accurately. |
| B20 | P1 | Assertion-level traceability | Backlog | Each acceptance criterion maps to meaningful executed assertions or test methods. |
| B21 | P1 | Browser compatibility | Backlog | Observed required Salesforce resources load through a reviewed narrow allowlist. |
| B22 | P1 | Personas and sessions | Backlog | Representative users and secure session lifecycle support permission-sensitive tests. |
| B23 | P1 | Test data and cleanup | Backlog | Synthetic fixtures, record tracking, cleanup and controlled email checks are repeatable. |
| B24 | P1 | Production smoke suite | Backlog | Separately approved non-destructive production tests replace inappropriate write scenarios. |
| B25 | P1 | Detailed test evidence | Backlog | Assertions, Apex methods and redacted browser diagnostics persist for review and repair. |
| B26 | P1 | Repair classification | Backlog | Repairable defects are distinguished from missing configuration/evidence and ambiguous writes; frozen expectations remain protected. |
| B27 | P1 | Manual-test policy | Backlog | UI and readiness consistently distinguish acceptable reviewed evidence from automation requirements. |
| B28 | P1 | Post-deployment recovery | Backlog | Restoration/forward-fix and data recovery procedures are exercised outside production. |
| B29 | P1 | Release activation/setup | Backlog | Assignments, navigation, configuration data and environment-specific activation are reviewed and verified. |
| B30 | P1 | Git/package consistency | Backlog | Removed delivery-owned files are handled explicitly without removing unrelated work. |
| B31 | P1 | Setup preflight | Backlog | Migrations, connections, tooling, environments and credentials are verified before execution. |
| B32 | P1 | Development pilot | Needs live setup | One BRD completes in a disposable org, including deliberate failure, bounded repair and recorded outcomes. |
| B33 | P1 | Full promotion rehearsal | Needs live setup | Dev → QA → UAT → business approval → production includes rejection, interruption, recovery and smoke evidence. |
| B34 | P2 | Agent/stack implementation alignment | Backlog | Approved architecture separates implemented orchestration from target frameworks and specialized agents. |
| B35 | P2 | Documentation/onboarding | Backlog | README, supported scope, setup, architecture and recovery instructions match verified behavior. |

## Execution rules

- Work in priority order and retain fail-closed quality gates.
- Use reviewed branches and checks before release; web deployment is not Salesforce production verification.
- Preserve exact artifact/test/approval bindings and immutable expectations during repairs.
- Live tests require explicitly identified orgs, credentials, personas and disposable data; never fabricate evidence.
- Record checkpoint results in `docs/WORK-STATUS.md`. Daily usage remaining is not observable by this application or coding session.
