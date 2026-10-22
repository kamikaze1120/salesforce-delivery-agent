# Delivery platform backlog — story board

Updated: **2026-10-22 (America/Chicago)**. Scope: the original **35 audit backlog items**, preserving B01–B35, plus B36 discovered during quality-adapter CI. Source: independent audit of main `a064749` (2026-10-12), updated through recovery release `947e4a7` and the B05–B08 quality-adapter implementation checkpoint.

This is a repository-maintained Kanban summary and Jira-style story catalog, not a connected Jira or GitHub Projects board. Story IDs are stable repository IDs, not Jira issue keys. Each card can be copied into an issue. Assignees, sprint commitments and estimates are **unassigned / not estimated**; dependencies below are proposed delivery sequencing, not proof that prerequisite work is complete.

## Board

| Backlog — 11 | In progress — 9 | Verification — 14 | Blocked: live setup — 2 | Done — 0 |
|---|---|---|---|---|
| B14–B19, B22–B24, B28–B29 | B11, B20–B21, B25–B27, B31, B35–B36 | B01–B10, B12–B13, B30, B34 | B32, B33 | No story declared fully verified |

**Status policy:** Backlog = implementation remains; In progress = partial implementation exists; Verification = implementation/local regression evidence exists but remaining acceptance evidence must be checked; Blocked = external setup prevents end-to-end execution; Done = all story criteria and linked evidence accepted. The verification column does not erase completed fixes. P0 = critical correctness/promotion blockers; P1 = reliable delivery and operational readiness; P2 = platform alignment and ongoing documentation. Missing quality evidence always blocks the relevant gate.

## Story index

| ID | Priority | Story | Status | Epic |
|---|---|---|---|---|
| [B01](#b01) | P0 | CI runner routing | Verification | E1 Quality and security |
| [B02](#b02) | P0 | Deployment XML parsing | Verification | E1 Quality and security |
| [B03](#b03) | P0 | Permission XML policy | Verification | E1 Quality and security |
| [B04](#b04) | P0 | Critical regression tests | Verification | E1 Quality and security |
| [B05](#b05) | P0 | Security quality adapter | Verification | E1 Quality and security |
| [B06](#b06) | P0 | Performance quality adapter | Verification | E1 Quality and security |
| [B07](#b07) | P0 | Destination license gate | Verification | E1 Quality and security |
| [B08](#b08) | P0 | Baseline regression adapter | Verification | E1 Quality and security |
| [B09](#b09) | P1 | Durable Salesforce operation IDs | Verification | E2 Durable delivery and recovery |
| [B10](#b10) | P1 | Recovery and reconciliation | Verification | E2 Durable delivery and recovery |
| [B11](#b11) | P1 | Pause and cancellation | In progress | E2 Durable delivery and recovery |
| [B12](#b12) | P1 | Business approval continuation | Verification | E2 Durable delivery and recovery |
| [B13](#b13) | P1 | Org-wide deployment locks | Verification | E2 Durable delivery and recovery |
| [B14](#b14) | P1 | Existing metadata retrieval | Backlog | E3 Salesforce architecture and capabilities |
| [B15](#b15) | P1 | Dependency and drift checks | Backlog | E3 Salesforce architecture and capabilities |
| [B16](#b16) | P1 | Expanded metadata support | Backlog | E3 Salesforce architecture and capabilities |
| [B17](#b17) | P1 | Flow testing and activation | Backlog | E3 Salesforce architecture and capabilities |
| [B18](#b18) | P1 | License analysis engine | Backlog | E3 Salesforce architecture and capabilities |
| [B19](#b19) | P1 | Official Salesforce MCP adapter | Backlog | E3 Salesforce architecture and capabilities |
| [B20](#b20) | P1 | Assertion-level traceability | In progress | E4 Testing and repair |
| [B21](#b21) | P1 | Browser compatibility | In progress | E4 Testing and repair |
| [B22](#b22) | P1 | Personas and sessions | Backlog | E4 Testing and repair |
| [B23](#b23) | P1 | Test data and cleanup | Backlog | E4 Testing and repair |
| [B24](#b24) | P1 | Production smoke suite | Backlog | E4 Testing and repair |
| [B25](#b25) | P1 | Detailed test evidence | In progress | E4 Testing and repair |
| [B26](#b26) | P1 | Repair classification | In progress | E4 Testing and repair |
| [B27](#b27) | P1 | Manual-test policy | In progress | E4 Testing and repair |
| [B28](#b28) | P1 | Post-deployment recovery | Backlog | E5 Release readiness |
| [B29](#b29) | P1 | Release activation/setup | Backlog | E5 Release readiness |
| [B30](#b30) | P1 | Git/package consistency | Verification | E5 Release readiness |
| [B31](#b31) | P1 | Setup preflight | In progress | E5 Release readiness |
| [B32](#b32) | P1 | Development pilot | Blocked — live setup | E5 Release readiness |
| [B33](#b33) | P1 | Full promotion rehearsal | Blocked — live setup | E5 Release readiness |
| [B34](#b34) | P2 | Agent/stack implementation alignment | Verification | E6 Platform and documentation |
| [B35](#b35) | P2 | Documentation/onboarding | In progress | E6 Platform and documentation |
| [B36](#b36) | P1 | Runner tooling dependency security | In progress | E1 Quality and security |

## Working agreements and definition of done

- Select work by risk and dependencies. Finish B10 recovery visibility/worker separation while keeping B05–B08 promotion gates closed until implemented and evidenced.
- Attach a PR/commit, targeted test results and relevant non-production/live evidence to each completed criterion. A unit-test pass is not a Salesforce deployment result.
- Preserve approved BRD, acceptance criteria, mockup/design, artifact, test and approval identities. Repairs may fix implementation; they may not weaken expectations to manufacture a pass.
- Use protected short-lived branches, required checks and merge into main; delete merged branches. Vercel webapp deployment is separate from Salesforce production approval.
- Use explicit org identities and synthetic test data. Never fabricate evidence or expose credentials. Do not automatically retry a write with an unknown outcome.
- Update this board and [WORK-STATUS.md](WORK-STATUS.md) together when acceptance evidence changes. These checkboxes represent remaining acceptance verification, not automatically synchronized CI results.
- A story is Done only when every applicable criterion below is evidenced, required checks pass, documentation is current and the reviewer accepts remaining limitations. Any non-applicable criterion needs a recorded rationale.

## Recommended delivery sequence

1. Keep critical fixes under regression coverage (B01–B04); complete quality contracts/adapters (B05–B08) and setup diagnostics (B31).
2. Complete durable operation recovery, pause, approval continuation and target locks (B09–B13).
3. Establish org baseline, supported metadata, license rules and verified MCP capabilities (B14–B19).
4. Complete traceability, persona-based execution, evidence, repair and manual policy (B20–B27).
5. Exercise recovery, setup/package consistency and the live Dev pilot before full promotion rehearsal (B28–B33).
6. Maintain architecture and onboarding throughout (B34–B35).

Dependencies can be designed together (for example B10/B13, B17/B29 and B20/B25); this sequence does not require circular implementation waits.

## Detailed story cards

<a id="b01"></a>

### B01 — CI runner routing

**Type:** Story · **Priority:** P0 · **Status:** Verification · **Epic:** E1 Quality and security

**User story:** As a CI maintainer, I want authenticated runner callbacks to reach the correct handler so legitimate jobs can execute without weakening identity checks.

**Current evidence / gap:** Implemented; local tests pass. Original audit outcome: POST reaches runner authentication; invalid identities remain blocked; HTTP regression tests pass.

**Implementation tasks:** Keep runner routes ahead of generic API fallbacks; preserve method validation and OIDC authentication.

**Acceptance criteria:**

- [ ] A runner POST reaches identity verification instead of a generic 404.
- [ ] Missing, invalid and wrong-audience identities fail.
- [ ] Unrelated endpoints retain their existing behavior.

**Dependencies / inputs:** None.

**Verification evidence required:** HTTP route tests and an authenticated non-production callback.

**Expected result:** POST reaches runner authentication; invalid identities remain blocked; HTTP regression tests pass.

<a id="b02"></a>

### B02 — Deployment XML parsing

**Type:** Story · **Priority:** P0 · **Status:** Verification · **Epic:** E1 Quality and security

**User story:** As a release reviewer, I want unambiguous deployment outcomes so component-level success cannot hide an overall failure.

**Current evidence / gap:** Implemented; local tests pass. Original audit outcome: Parse overall result independently of component outcomes; inconsistent success is rejected.

**Implementation tasks:** Use structural XML parsing; validate the overall result and normalize supported response shapes without searching for arbitrary success text.

**Acceptance criteria:**

- [ ] Nested component success cannot override overall failure.
- [ ] Malformed XML and contradictory or missing outcome values block promotion.
- [ ] Valid supported success and failure fixtures parse correctly.

**Dependencies / inputs:** None.

**Verification evidence required:** Parser fixtures and a redacted real Salesforce response.

**Expected result:** Parse overall result independently of component outcomes; inconsistent success is rejected.

<a id="b03"></a>

### B03 — Permission XML policy

**Type:** Story · **Priority:** P0 · **Status:** Verification · **Epic:** E1 Quality and security

**User story:** As a security reviewer, I want consistent permission validation so XML formatting cannot bypass policy.

**Current evidence / gap:** Implemented; local tests pass. Original audit outcome: Namespace-equivalent permissions receive identical structural checks; forbidden access is rejected.

**Implementation tasks:** Parse namespaces and boolean representations structurally; apply explicit forbidden-permission and broad-access policies to every supported permission element.

**Acceptance criteria:**

- [ ] Equivalent namespace/entity/boolean encodings get the same decision.
- [ ] Forbidden administrative access is rejected.
- [ ] Benign least-privilege fixtures remain accepted.

**Dependencies / inputs:** B02.

**Verification evidence required:** Positive and bypass regression fixtures with policy decisions.

**Expected result:** Namespace-equivalent permissions receive identical structural checks; forbidden access is rejected.

<a id="b04"></a>

### B04 — Critical regression tests

**Type:** Story · **Priority:** P0 · **Status:** Verification · **Epic:** E1 Quality and security

**User story:** As a maintainer, I want repeatable critical regressions so future changes cannot reopen audited defects.

**Current evidence / gap:** Implemented; local tests pass. Original audit outcome: Reproduce B01–B03 and verify their corrected behavior.

**Implementation tasks:** Keep targeted routing, XML outcome and permission tests in required CI; cover negative behavior as well as expected success.

**Acceptance criteria:**

- [ ] Tests reproduce the original B01–B03 failure conditions.
- [ ] Corrected code passes all cases.
- [ ] Required CI fails when the unsafe behavior is reintroduced in a controlled test.

**Dependencies / inputs:** B01, B02, B03.

**Verification evidence required:** Required CI run and documented regression scenarios.

**Expected result:** Reproduce B01–B03 and verify their corrected behavior.

<a id="b05"></a>

### B05 — Security quality adapter

**Type:** Story · **Priority:** P0 · **Status:** Verification · **Epic:** E1 Quality and security

**User story:** As a security reviewer, I want artifact-bound security evidence so unsafe generated changes cannot reach another environment.

**Current evidence / gap:** Implemented for documented supported scope: isolated Apex scan, structural private-object/permission policies and mandatory pinned CRUD/FLS/sharing allow/deny test cases. Unsupported metadata blocks explicitly. Expanded metadata/persona support remains B16/B22; live runtime verification pending. Original audit outcome: Reviewed static analysis and permission policy produce artifact-bound evidence before promotion.

**Implementation tasks:** Extend the existing isolated Apex scan with reviewed policies for supported metadata and runtime authorization scenarios; version scanner/rules and preserve fail-closed unsupported handling.

**Acceptance criteria:**

- [ ] Evidence identifies artifact, tool and policy versions.
- [ ] Missing scanner output or unsupported metadata blocks.
- [ ] Permission, sharing and CRUD/FLS scenarios include denied-access cases.
- [ ] Scanner processes receive no deployment credentials.

**Dependencies / inputs:** B03; B16 and B22 for broader metadata/runtime coverage.

**Verification evidence required:** Clean and vulnerable fixtures, real scanner CI, and non-production runtime access results.

**Expected result:** Reviewed static analysis and permission policy produce artifact-bound evidence before promotion.

<a id="b06"></a>

### B06 — Performance quality adapter

**Type:** Story · **Priority:** P0 · **Status:** Verification · **Epic:** E1 Quality and security

**User story:** As a release owner, I want measured performance budgets so a functional release does not breach operational limits.

**Current evidence / gap:** Implemented configurable Apex runtime, instrumented CPU/query/DML/record-volume and browser elapsed-time adapters. Approved per-plan workloads and budgets are immutable across repairs; missing measurements block. Live workload verification pending. Original audit outcome: Representative bulk, limit and UI scenarios meet explicit approved thresholds.

**Implementation tasks:** Agree representative volumes and explicit thresholds; implement bulk Apex/Flow and UI performance checks; capture CPU, queries, DML and elapsed-time evidence where available.

**Acceptance criteria:**

- [ ] Approved workload and thresholds are versioned.
- [ ] Every required metric has an observed result.
- [ ] A threshold breach fails.
- [ ] Missing measurements block instead of passing.

**Dependencies / inputs:** B17, B22, B23; approved business volumes.

**Verification evidence required:** Repeatable non-production runs with per-metric actual, threshold and outcome.

**Expected result:** Representative bulk, limit and UI scenarios meet explicit approved thresholds.

<a id="b07"></a>

### B07 — Destination license gate

**Type:** Story · **Priority:** P0 · **Status:** Verification · **Epic:** E1 Quality and security

**User story:** As a release owner, I want destination-specific entitlement checks so a Dev-compatible release is not promoted into an incompatible org.

**Current evidence / gap:** Implemented fresh per-destination edition/license/package-license/assignment/object-access/limit rules, with authenticated server preflight before each metadata intent. Unknown, stale, truncated and wrong-target evidence block. Broader license planning and package-version dependencies remain B18/B15; live verification pending. Original audit outcome: Every target provides applicable feature, permission, limit and dependency evidence; unknown blocks.

**Implementation tasks:** Inspect each target immediately before promotion; evaluate required features, packages, permission set licenses, assignments and relevant capacity against release requirements.

**Acceptance criteria:**

- [ ] Evidence identifies destination org and observation time.
- [ ] Missing or unknown required capabilities block.
- [ ] Changing target configuration invalidates stale evidence.
- [ ] Dev evidence cannot satisfy QA/UAT/production checks.

**Dependencies / inputs:** B18, B31.

**Verification evidence required:** Compatible, incompatible and unavailable-capability destination fixtures plus live read evidence.

**Expected result:** Every target provides applicable feature, permission, limit and dependency evidence; unknown blocks.

<a id="b08"></a>

### B08 — Baseline regression adapter

**Type:** Story · **Priority:** P0 · **Status:** Verification · **Epic:** E1 Quality and security

**User story:** As a business owner, I want existing behavior protected during delivery so a new requirement does not silently break current processes.

**Current evidence / gap:** Implemented independent reviewed Apex/browser baselines, pre-deployment source verification, method-level results, source drift checks and missing/skipped-case blocking. Generation and repairs cannot alter pinned test sources. Live regression demonstration pending. Original audit outcome: Approved existing-behavior tests run and retain results for each applicable stage.

**Implementation tasks:** Version an approved regression baseline separately from generated tests; run applicable cases at each stage and retain baseline/result bindings.

**Acceptance criteria:**

- [ ] A previously working scenario fails the gate when regressed.
- [ ] Baseline changes require review.
- [ ] Skipped or unexecuted required scenarios block.
- [ ] Repair cannot delete failing baseline cases to pass.

**Dependencies / inputs:** B20, B22, B23, B25; approved baseline.

**Verification evidence required:** Baseline version, stage results and deliberate regression demonstration.

**Expected result:** Approved existing-behavior tests run and retain results for each applicable stage.

<a id="b09"></a>

### B09 — Durable Salesforce operation IDs

**Type:** Story · **Priority:** P1 · **Status:** Verification · **Epic:** E2 Durable delivery and recovery

**User story:** As a operator, I want durable Salesforce operation identifiers so an interrupted response never causes duplicate submission.

**Current evidence / gap:** Implemented; interruption regression tests pass; live fault injection pending. Original audit outcome: IDs persist immediately after submission; interrupted writes are never blindly retried.

**Implementation tasks:** Persist intent before a write, record the returned ID immediately, then checkpoint terminal outcomes; maintain idempotent authenticated journal updates.

**Acceptance criteria:**

- [ ] Interruptions before and after ID persistence leave a recoverable record.
- [ ] Duplicate submissions are not attempted.
- [ ] Completion must match recorded kind, ID, run and artifact.
- [ ] Unknown outcomes block new dispatch.

**Dependencies / inputs:** B01.

**Verification evidence required:** Existing interruption tests plus live fault injection in a disposable org.

**Expected result:** IDs persist immediately after submission; interrupted writes are never blindly retried.

<a id="b10"></a>

### B10 — Recovery and reconciliation

**Type:** Story · **Priority:** P1 · **Status:** Verification · **Epic:** E2 Durable delivery and recovery

**User story:** As a operator, I want read-only reconciliation of interrupted operations so recovery uses actual Salesforce status.

**Current evidence / gap:** Controlled reviewer acceptance now checks terminal observations, exact artifact/journal and a stopped original runner. It preserves pause, clears stale approval, marks tests incomplete and permits only a new pipeline. No-ID intents remain blocked. Live fault injection remains.

**Implementation tasks:** Add an authenticated reconciliation worker bound to the original org, operation, artifact and run; query saved IDs without deployment tools; implement audited recovery transitions. The journal UI already exists.

**Acceptance criteria:**

- [ ] Saved IDs are polled in the exact target org.
- [ ] No reconciliation path submits metadata.
- [ ] Unknown or missing IDs remain blocked.
- [ ] Terminal results cannot bypass quality or approval gates.
- [ ] Concurrent or repeated reconciliation is idempotent.

**Dependencies / inputs:** B09, B13, B31.

**Verification evidence required:** Forged-ID/identity tests, interruption replay tests and live read-only recovery evidence.

**Expected result:** CI/CD shows saved operation IDs, run/artifact identity and timestamps; unresolved starts are disabled. Authenticated status checks are implemented; controlled recovery transition and live rehearsal remain pending.

<a id="b11"></a>

### B11 — Pause and cancellation

**Type:** Story · **Priority:** P1 · **Status:** In progress · **Epic:** E2 Durable delivery and recovery

**User story:** As a operator, I want honest pause and cancellation controls so subsequent writes stop while accepted operations remain accounted for.

**Current evidence / gap:** In progress: action-boundary pause and paused outcome reporting implemented; in-flight cancellation pending. Original audit outcome: Pause stops subsequent writes; authenticated outcome reporting remains available.

**Implementation tasks:** Retain action-boundary pause checks; add supported cancellation requests and status polling with explicit UI distinctions between requested, accepted and confirmed cancellation.

**Acceptance criteria:**

- [ ] Pause prevents subsequent write/test boundaries.
- [ ] Already accepted operations may finish and still report outcomes.
- [ ] Cancel failure or uncertainty remains unresolved.
- [ ] Resume cannot bypass reconciliation.

**Dependencies / inputs:** B09, B10; verified Salesforce cancellation capability.

**Verification evidence required:** Pause race tests, accepted-operation outcomes and supported cancellation rehearsal.

**Expected result:** Pause stops subsequent writes; authenticated outcome reporting remains available.

<a id="b12"></a>

### B12 — Business approval continuation

**Type:** Story · **Priority:** P1 · **Status:** Verification · **Epic:** E2 Durable delivery and recovery

**User story:** As a business approver, I want safe continuation of the exact UAT release so approval timing does not strand or replace the release.

**Current evidence / gap:** Production continuation is now independent of the original worker: exact report approval, durable dispatch correlation, new OIDC workflow identity and duplicate-dispatch blocking. Local negative tests pass; live rehearsal remains outstanding.

**Implementation tasks:** Persist a resumable approval checkpoint independent of a short-lived runner; bind approval to artifact, requirements, tests and UAT evidence; dispatch continuation idempotently.

**Acceptance criteria:**

- [ ] Approval before or after worker exit resumes exactly once.
- [ ] Rejection prevents production.
- [ ] Any relevant release change invalidates approval.
- [ ] Expired credentials are refreshed through trusted authentication without widening scope.

**Dependencies / inputs:** B09, B10, B13, B25.

**Verification evidence required:** Approval/rejection/duplicate/late-approval tests and a non-production continuation rehearsal.

**Expected result:** Exact UAT release resumes safely after business approval regardless of approval timing.

<a id="b13"></a>

### B13 — Org-wide deployment locks

**Type:** Story · **Priority:** P1 · **Status:** Verification · **Epic:** E2 Durable delivery and recovery

**User story:** As a platform operator, I want exclusive target-org mutation so separate deliveries cannot collide.

**Current evidence / gap:** Global org-ID locks now cover pipeline and direct sandbox mutations across workspaces. Atomic SQL acquisition, ownership/heartbeat history and terminal-state release are implemented. Expired leases do not unlock uncertain writes. PostgreSQL-compatible SQL verification passes; real concurrent/live verification remains.

**Implementation tasks:** Implement durable org-ID locks with atomic acquisition, ownership, lease/heartbeat and audit history; prevent expiry from freeing an org with an unresolved write.

**Acceptance criteria:**

- [ ] Two workspaces targeting the same org cannot both mutate it.
- [ ] Lost workers do not silently release uncertain operations.
- [ ] Unrelated orgs can proceed.
- [ ] Unlock requires verified safe state.

**Dependencies / inputs:** B09; lock design must support B10.

**Verification evidence required:** Concurrency, worker-loss, lease-expiry and controlled recovery tests.

**Expected result:** Concurrent deliveries cannot mutate the same target through this platform.

<a id="b14"></a>

### B14 — Existing metadata retrieval

**Type:** Story · **Priority:** P1 · **Status:** Backlog · **Epic:** E3 Salesforce architecture and capabilities

**User story:** As a Salesforce architect, I want an accurate existing-org baseline so generated changes fit the current solution.

**Current evidence / gap:** Backlog. Original audit outcome: Relevant source, Flows, permissions, sharing and dependencies are retrieved with explicit limits.

**Implementation tasks:** Retrieve relevant metadata and dependencies with explicit type, size and API limits; preserve source hashes and access failures; provide redacted structured context to design/generation.

**Acceptance criteria:**

- [ ] Requested objects, fields, Flows, Apex, permissions and sharing are inventoried where accessible.
- [ ] Partial retrieval is visible.
- [ ] Inaccessible dependencies block affected work.
- [ ] Credentials and business records do not leak into prompts.

**Dependencies / inputs:** B19, B31.

**Verification evidence required:** Representative baseline snapshot, retrieval limits and partial-access tests.

**Expected result:** Relevant source, Flows, permissions, sharing and dependencies are retrieved with explicit limits.

<a id="b15"></a>

### B15 — Dependency and drift checks

**Type:** Story · **Priority:** P1 · **Status:** Backlog · **Epic:** E3 Salesforce architecture and capabilities

**User story:** As a release owner, I want dependency and drift detection so approved changes are not applied to a changed baseline.

**Current evidence / gap:** Backlog. Original audit outcome: Baseline differences and missing dependencies block stale deployments.

**Implementation tasks:** Compare approved baseline and current target metadata before execution; resolve package/metadata dependencies; require revalidation or redesign when material differences appear.

**Acceptance criteria:**

- [ ] A changed field/Flow/dependency blocks a stale plan.
- [ ] Unrelated differences follow explicit reviewed policy.
- [ ] Missing dependencies identify the affected components.
- [ ] Refreshing a baseline invalidates affected approvals.

**Dependencies / inputs:** B14, B30.

**Verification evidence required:** Deliberate drift and missing-dependency scenarios with readable diffs.

**Expected result:** Baseline differences and missing dependencies block stale deployments.

<a id="b16"></a>

### B16 — Expanded metadata support

**Type:** Story · **Priority:** P1 · **Status:** Backlog · **Epic:** E3 Salesforce architecture and capabilities

**User story:** As a Salesforce developer, I want validated metadata writers so architecture choices can be implemented safely.

**Current evidence / gap:** Backlog. Original audit outcome: Standard-object changes, triggers, justified profiles, UI metadata and custom metadata have validated writers.

**Implementation tasks:** Create a supported-type matrix and schema-aware writers for standard-object extensions, triggers, profiles when justified, UI and custom metadata; keep permission sets preferred where appropriate.

**Acceptance criteria:**

- [ ] Each supported type has positive/negative fixtures and target validation.
- [ ] Unsupported types are blocked explicitly.
- [ ] Profiles require reviewed justification and least privilege.
- [ ] Generated packages contain only approved components.

**Dependencies / inputs:** B03, B05, B14.

**Verification evidence required:** Per-type generated fixtures, policy checks and disposable-org validation.

**Expected result:** Standard-object changes, triggers, justified profiles, UI metadata and custom metadata have validated writers.

<a id="b17"></a>

### B17 — Flow testing and activation

**Type:** Story · **Priority:** P1 · **Status:** Backlog · **Epic:** E3 Salesforce architecture and capabilities

**User story:** As a process owner, I want tested Flow versions with deliberate activation so business automation behaves as approved.

**Current evidence / gap:** Backlog. Original audit outcome: Reviewed versions execute tests, activate deliberately and have recovery evidence.

**Implementation tasks:** Define supported Flow types and execution checks; track exact versions and activation separately; exercise positive, negative and fault paths and version restoration.

**Acceptance criteria:**

- [ ] Tests identify Flow/version and assert business effects.
- [ ] Failed required Flow tests block.
- [ ] Activation is explicit and destination-aware.
- [ ] Prior-version restoration is rehearsed.
- [ ] Untestable required paths are not marked passed.

**Dependencies / inputs:** B16, B20, B23, B29.

**Verification evidence required:** Flow scenario outcomes and activation/restoration rehearsal.

**Expected result:** Reviewed versions execute tests, activate deliberately and have recovery evidence.

<a id="b18"></a>

### B18 — License analysis engine

**Type:** Story · **Priority:** P1 · **Status:** Backlog · **Epic:** E3 Salesforce architecture and capabilities

**User story:** As a solution owner, I want evidence-based license analysis so feasibility and alternatives reflect the actual org.

**Current evidence / gap:** Backlog. Original audit outcome: Source-backed rules separate entitlements, assignments, effective access and limits; alternatives are verified.

**Implementation tasks:** Build versioned rules with authoritative sources; separate org edition, enabled features, user licenses, permission set licenses, effective permissions, package dependencies and limits.

**Acceptance criteria:**

- [ ] Every conclusion has observed facts and rule/source date.
- [ ] Unknown entitlement is shown as unknown.
- [ ] Assignments are not confused with entitlement.
- [ ] Alternatives state tradeoffs and are checked against the same constraints.

**Dependencies / inputs:** B14, B19; approved source/rule review process.

**Verification evidence required:** Rule fixtures for supported/unsupported/unknown cases and redacted org analysis.

**Expected result:** Source-backed rules separate entitlements, assignments, effective access and limits; alternatives are verified.

<a id="b19"></a>

### B19 — Official Salesforce MCP adapter

**Type:** Story · **Priority:** P1 · **Status:** Backlog · **Epic:** E3 Salesforce architecture and capabilities

**User story:** As a integration owner, I want a verified Salesforce MCP adapter so supported official tools can be used with constrained access.

**Current evidence / gap:** Backlog. Original audit outcome: Auth and discovery identify supported Hosted/DX tools; custom fallback is labeled accurately.

**Implementation tasks:** Implement capability discovery and authentication for supported Hosted/DX deployments; map tool schemas to internal contracts; label the existing project-owned bridge accurately.

**Acceptance criteria:**

- [ ] Unsupported/missing tools block the affected action.
- [ ] Tool inputs enforce target and artifact identity.
- [ ] Read-only reconciliation cannot call writes.
- [ ] No arbitrary tool from model output executes.
- [ ] Custom fallback is clearly identified.

**Dependencies / inputs:** B31; official tool and entitlement verification.

**Verification evidence required:** Capability contract tests, auth failures and observed non-production tool calls.

**Expected result:** Auth and discovery identify supported Hosted/DX tools; custom fallback is labeled accurately.

<a id="b20"></a>

### B20 — Assertion-level traceability

**Type:** Story · **Priority:** P1 · **Status:** In progress · **Epic:** E4 Testing and repair

**User story:** As a business analyst, I want assertion-level requirement traceability so green test counts demonstrate business acceptance.

**Current evidence / gap:** Exact Apex-method and browser-step evidence now gates business cases. Class-only and skipped/duplicate evidence block. Stable criterion identifiers and broader semantic coverage review remain.

**Implementation tasks:** Give acceptance criteria stable IDs; map each to executed assertions/Apex methods and expected results; freeze reviewed expectations across repair attempts.

**Acceptance criteria:**

- [ ] Every required criterion has meaningful executed evidence.
- [ ] An empty test or name-only mapping is insufficient.
- [ ] Skipped and manual cases are explicit.
- [ ] Changes to expected outcomes require review.

**Dependencies / inputs:** B25; reviewed BRD and acceptance criteria.

**Verification evidence required:** Traceability matrix including positive, negative, unmapped and skipped cases.

**Expected result:** Each acceptance criterion maps to meaningful executed assertions or test methods.

<a id="b21"></a>

### B21 — Browser compatibility

**Type:** Story · **Priority:** P1 · **Status:** In progress · **Epic:** E4 Testing and repair

**User story:** As a test engineer, I want compatible Salesforce browser access so required UI resources load without broad network access.

**Current evidence / gap:** Exact reviewed Salesforce resource origins are now configurable in the immutable pipeline policy; wildcard origins, credentials and unrelated domains are rejected. Blocked requests produce redacted evidence and block the scenario. Service workers are disabled so network interception cannot be bypassed by their requests. Actual Lightning resource compatibility remains unverified.

**Implementation tasks:** Observe supported Salesforce UI resource needs; maintain a narrow reviewed host policy and redirect handling; diagnose blocked resources without permitting arbitrary destinations.

**Acceptance criteria:**

- [ ] Representative Lightning pages load.
- [ ] Unexpected third-party hosts remain blocked.
- [ ] Auth redirects follow approved domains.
- [ ] Diagnostics redact secrets.
- [ ] Missing required resources produce a blocked test with reason.

**Dependencies / inputs:** B22, B31.

**Verification evidence required:** Browser network-policy tests and live representative page execution.

**Expected result:** Observed required Salesforce resources load through a reviewed narrow allowlist.

<a id="b22"></a>

### B22 — Personas and sessions

**Type:** Story · **Priority:** P1 · **Status:** Backlog · **Epic:** E4 Testing and repair

**User story:** As a security tester, I want separate representative user sessions so role-sensitive behavior is tested accurately.

**Current evidence / gap:** Backlog. Original audit outcome: Representative users and secure session lifecycle support permission-sensitive tests.

**Implementation tasks:** Configure test personas with approved entitlements and least privilege; isolate browser contexts; securely create, refresh and revoke sessions with redacted storage.

**Acceptance criteria:**

- [ ] Allowed and denied actions are tested for each relevant persona.
- [ ] Sessions cannot cross users/workspaces.
- [ ] Expiry produces an explicit blocked result.
- [ ] Cookies/tokens never appear in reports or source.

**Dependencies / inputs:** B18, B31.

**Verification evidence required:** Persona access matrix, session-isolation tests and live permission scenarios.

**Expected result:** Representative users and secure session lifecycle support permission-sensitive tests.

<a id="b23"></a>

### B23 — Test data and cleanup

**Type:** Story · **Priority:** P1 · **Status:** Backlog · **Epic:** E4 Testing and repair

**User story:** As a test engineer, I want repeatable synthetic data and cleanup so testing does not pollute environments or contact real customers.

**Current evidence / gap:** Backlog. Original audit outcome: Synthetic fixtures, record tracking, cleanup and controlled email checks are repeatable.

**Implementation tasks:** Create scoped fixtures and a record ledger; isolate delivery/test-run ownership; cleanup only owned data; use controlled email recipients or a test mailbox with explicit verification.

**Acceptance criteria:**

- [ ] Each created record has run ownership.
- [ ] Cleanup is repeatable and cannot delete unrelated records.
- [ ] Failed cleanup is reported.
- [ ] Email assertions verify controlled destinations and expected content without real-customer delivery.

**Dependencies / inputs:** B22, B31.

**Verification evidence required:** Fixture/cleanup runs including interruption and controlled email evidence.

**Expected result:** Synthetic fixtures, record tracking, cleanup and controlled email checks are repeatable.

<a id="b24"></a>

### B24 — Production smoke suite

**Type:** Story · **Priority:** P1 · **Status:** Backlog · **Epic:** E4 Testing and repair

**User story:** As a release owner, I want a separately approved production smoke suite so release health is checked without running unsafe test writes.

**Current evidence / gap:** Backlog. Original audit outcome: Separately approved non-destructive production tests replace inappropriate write scenarios.

**Implementation tasks:** Define a narrow production policy using read-only checks and explicitly reviewed safe operations; isolate it from non-production business scenarios and capture post-release health.

**Acceptance criteria:**

- [ ] Non-production write scenarios cannot run as production smoke by default.
- [ ] Smoke scope is approved with release.
- [ ] Failures alert and trigger the recovery decision.
- [ ] Production credentials remain scoped and redacted.

**Dependencies / inputs:** B12, B25, B28; explicit production test authorization.

**Verification evidence required:** Policy rejection tests and approved smoke rehearsal before live execution.

**Expected result:** Separately approved non-destructive production tests replace inappropriate write scenarios.

<a id="b25"></a>

### B25 — Detailed test evidence

**Type:** Story · **Priority:** P1 · **Status:** In progress · **Epic:** E4 Testing and repair

**User story:** As a business approver, I want detailed trustworthy evidence so release decisions are based on what actually ran.

**Current evidence / gap:** Browser step hashes, durations and explicit outcomes plus Apex method/run IDs are retained. Full diagnostics retention, report counts and export policy remain.

**Implementation tasks:** Persist per-assertion and per-Apex-method outcomes, durations, expected/actual summaries and redacted browser diagnostics; bind reports to stage, org, artifact, test and requirement versions.

**Acceptance criteria:**

- [ ] Pass/fail/blocked/skipped/manual are distinct.
- [ ] Counts reconcile with detailed records.
- [ ] Missing evidence blocks relevant gates.
- [ ] Exports contain no secrets.
- [ ] Approval report lists scope, risks and unresolved items.

**Dependencies / inputs:** B09, B20 contract design together.

**Verification evidence required:** Report fixtures, redaction checks and full sample stage evidence.

**Expected result:** Assertions, Apex methods and redacted browser diagnostics persist for review and repair.

<a id="b26"></a>

### B26 — Repair classification

**Type:** Story · **Priority:** P1 · **Status:** In progress · **Epic:** E4 Testing and repair

**User story:** As a delivery owner, I want bounded defect repair so automation fixes code without rewriting requirements or retrying uncertain writes.

**Current evidence / gap:** Deterministic repair classification now permits only evidenced non-production Apex defects. Unknown writes, setup/browser ambiguity, changed expectations and exhausted budgets block. Broader safe defect classes remain.

**Implementation tasks:** Classify code defects versus missing setup, policy failures, entitlement restrictions and ambiguous operations; reread frozen requirements and use capped repair attempts with evidence.

**Acceptance criteria:**

- [ ] Only classified repairable defects trigger generation.
- [ ] Unknown writes require reconciliation.
- [ ] Missing credentials/licenses require a clear action.
- [ ] Tests and acceptance criteria cannot be weakened.
- [ ] Exhausted attempts stop with diagnosis.

**Dependencies / inputs:** B10, B20, B25.

**Verification evidence required:** Repairable/nonrepairable fixtures and bounded repair of a deliberate defect.

**Expected result:** Repairable defects are distinguished from missing configuration/evidence and ambiguous writes; frozen expectations remain protected.

<a id="b27"></a>

### B27 — Manual-test policy

**Type:** Story · **Priority:** P1 · **Status:** In progress · **Epic:** E4 Testing and repair

**User story:** As a reviewer, I want consistent manual-test rules so human evidence is neither ignored nor treated as automation.

**Current evidence / gap:** UI and model instructions now consistently label manual notes supplemental; automation-required gates cannot accept them. Configurable exemption/expiry policy remains.

**Implementation tasks:** Define which criteria permit manual evidence, who may attest, required proof, expiry and review; enforce the same policy in UI, readiness and promotion.

**Acceptance criteria:**

- [ ] Automation-required criteria cannot pass on a note.
- [ ] Approved manual cases include reviewer, time and release binding.
- [ ] Changed artifacts invalidate affected evidence.
- [ ] Report clearly labels manual verification.

**Dependencies / inputs:** B20, B25; business-approved manual-test policy.

**Verification evidence required:** UI/API parity tests and reviewed manual-evidence example.

**Expected result:** UI and readiness consistently distinguish acceptable reviewed evidence from automation requirements.

<a id="b28"></a>

### B28 — Post-deployment recovery

**Type:** Story · **Priority:** P1 · **Status:** Backlog · **Epic:** E5 Release readiness

**User story:** As a release owner, I want an exercised recovery plan so failed releases can be restored or corrected deliberately.

**Current evidence / gap:** Backlog. Original audit outcome: Restoration/forward-fix and data recovery procedures are exercised outside production.

**Implementation tasks:** Define metadata backup, previous artifact, data impact, forward-fix and restore procedures; test recovery in non-production with explicit irreversible-change handling.

**Acceptance criteria:**

- [ ] A simulated failed release follows the documented decision path.
- [ ] Restored metadata and affected behavior are verified.
- [ ] Data recovery is separate from metadata rollback.
- [ ] Destructive/irreversible actions require explicit review.

**Dependencies / inputs:** B14, B15, B23, B29.

**Verification evidence required:** Non-production recovery drill and reviewed release-specific runbook.

**Expected result:** Restoration/forward-fix and data recovery procedures are exercised outside production.

<a id="b29"></a>

### B29 — Release activation/setup

**Type:** Story · **Priority:** P1 · **Status:** Backlog · **Epic:** E5 Release readiness

**User story:** As a Salesforce administrator, I want reviewed activation and setup steps so deployed metadata becomes a usable release.

**Current evidence / gap:** Backlog. Original audit outcome: Assignments, navigation, configuration data and environment-specific activation are reviewed and verified.

**Implementation tasks:** Model permission assignments, navigation, configuration records, scheduled jobs and feature activation as versioned destination-specific steps with dependencies and evidence.

**Acceptance criteria:**

- [ ] Setup steps have explicit scope and authorized actor.
- [ ] Retries are idempotent.
- [ ] Environment-specific values do not leak across orgs.
- [ ] Missing setup blocks readiness.
- [ ] Post-setup usability checks pass.

**Dependencies / inputs:** B16, B17 design together, B18, B23.

**Verification evidence required:** Setup plan, duplicate-execution tests and usability evidence.

**Expected result:** Assignments, navigation, configuration data and environment-specific activation are reviewed and verified.

<a id="b30"></a>

### B30 — Git/package consistency

**Type:** Story · **Priority:** P1 · **Status:** Verification · **Epic:** E5 Release readiness

**User story:** As a repository maintainer, I want consistent delivery-owned packages so removed generated files do not linger or delete unrelated work.

**Current evidence / gap:** Owned source paths and blob hashes now drive explicit Git removals; collisions, drift, truncated inventory and legacy ownership gaps block before mutation. Salesforce destructive deletion remains separate.

**Implementation tasks:** Track file ownership and approved artifact contents; compute additions/updates/removals; handle any Salesforce destructive change as a separately reviewed deployment action.

**Acceptance criteria:**

- [ ] Removing an owned file removes it from the next generated package as intended.
- [ ] Unrelated files remain unchanged.
- [ ] Deletions are visible in review.
- [ ] Source tree, manifest and artifact hash agree.

**Dependencies / inputs:** B14; approved ownership/deletion policy.

**Verification evidence required:** Add/update/remove fixtures and package/source comparison.

**Expected result:** Removed delivery-owned files are handled explicitly without removing unrelated work.

<a id="b31"></a>

### B31 — Setup preflight

**Type:** Story · **Priority:** P1 · **Status:** In progress · **Epic:** E5 Release readiness

**User story:** As a workspace administrator, I want actionable setup preflight so missing prerequisites are discovered before a delivery starts.

**Current evidence / gap:** Owner-only setup preflight reports database/connector/model/pipeline checks with redacted remediation and connection version. Runner credentials and target verification remain explicitly unknown.

**Implementation tasks:** Check database migrations, workspace isolation, Jira project access, LLM availability, repository/checks, MCP/CLI tooling and Dev/QA/UAT/production identities and credentials.

**Acceptance criteria:**

- [ ] Each prerequisite is passed, failed or unknown with remediation.
- [ ] Secrets are never echoed.
- [ ] Wrong org kinds/duplicate target identities block.
- [ ] Missing migration or connector access blocks relevant stages.
- [ ] Recheck detects changed settings.

**Dependencies / inputs:** None; B18/B19 extend capability checks.

**Verification evidence required:** Configured and deliberately misconfigured preflight runs.

**Expected result:** Migrations, connections, tooling, environments and credentials are verified before execution.

<a id="b32"></a>

### B32 — Development pilot

**Type:** Story · **Priority:** P1 · **Status:** Blocked — live setup · **Epic:** E5 Release readiness

**User story:** As a product owner, I want one complete disposable-org pilot so core delivery is proven beyond unit tests.

**Current evidence / gap:** Needs live setup. Original audit outcome: One BRD completes in a disposable org, including deliberate failure, bounded repair and recorded outcomes.

**Implementation tasks:** Choose a small approved BRD; configure test Jira/LLM and a disposable development org; exercise clarification, design/mockup approval, generation, tests, deliberate failure and bounded repair.

**Acceptance criteria:**

- [ ] BRD maps to stories, criteria and observed test results.
- [ ] Generated changes exist in the approved Dev org.
- [ ] A deliberate code failure is repaired without changing expectations.
- [ ] Unresolved outcomes stop safely.
- [ ] Cleanup and a limitations report are recorded.

**Dependencies / inputs:** B05–B10, B14–B23, B25–B27, B29–B31; live credentials and approved pilot scope.

**Verification evidence required:** End-to-end pilot report with actual Jira links, artifact, org and test evidence.

**Expected result:** One BRD completes in a disposable org, including deliberate failure, bounded repair and recorded outcomes.

<a id="b33"></a>

### B33 — Full promotion rehearsal

**Type:** Story · **Priority:** P1 · **Status:** Blocked — live setup · **Epic:** E5 Release readiness

**User story:** As a release owner, I want a complete promotion rehearsal so the approval and recovery controls are proven across environments.

**Current evidence / gap:** Needs live setup. Original audit outcome: Dev → QA → UAT → business approval → production includes rejection, interruption, recovery and smoke evidence.

**Implementation tasks:** After the Dev pilot, rehearse Dev → QA → UAT → business approval → production using distinct approved targets; first rehearse production behavior in a disposable production-like target.

**Acceptance criteria:**

- [ ] Same reviewed artifact is tracked through all stages.
- [ ] Rejection and late approval behave correctly.
- [ ] Interruption and recovery do not duplicate writes.
- [ ] Production requires explicit business approval.
- [ ] Smoke and recovery evidence are retained.

**Dependencies / inputs:** B06–B13, B15, B24–B29, B32; four target configurations and separate live production authorization.

**Verification evidence required:** Promotion/rejection/interruption rehearsal dossier; live production evidence only when authorized.

**Expected result:** Dev → QA → UAT → business approval → production includes rejection, interruption, recovery and smoke evidence.

<a id="b34"></a>

### B34 — Agent/stack implementation alignment

**Type:** Story · **Priority:** P2 · **Status:** Verification · **Epic:** E6 Platform and documentation

**User story:** As a platform architect, I want an honest component and agent architecture so implementation decisions match the delivery vision.

**Current evidence / gap:** ADR 001 documents the current runtime, responsibility contracts, trust boundaries and deferred framework migration. Owner architecture acceptance remains.

**Implementation tasks:** Document current Node application and project-owned orchestration; define contracts for requirements, license, architecture, code, test and deployment responsibilities; decide framework changes with migration cost and acceptance criteria.

**Acceptance criteria:**

- [ ] Current versus target stack is explicit.
- [ ] Proposed Next.js/FastAPI/LangGraph/Temporal or vector storage is not described as implemented.
- [ ] Agent inputs/outputs and trust boundaries are defined.
- [ ] Durable execution and tenant isolation have an approved design.

**Dependencies / inputs:** B19, B26; architecture decision review.

**Verification evidence required:** Architecture decision records, component map and contract examples.

**Expected result:** Approved architecture separates implemented orchestration from target frameworks and specialized agents.

<a id="b35"></a>

### B35 — Documentation/onboarding

**Type:** Story · **Priority:** P2 · **Status:** In progress · **Epic:** E6 Platform and documentation

**User story:** As a new contributor, I want accurate onboarding and operational documentation so the system can be configured and supported without guesswork.

**Current evidence / gap:** README, architecture and new control/audit guides document this checkpoint; clean-environment onboarding and live setup validation remain.

**Implementation tasks:** Maintain README, setup, supported-scope matrix, architecture, backlog, recovery and contribution guidance; audit license/code-of-conduct links and remove active Copado deployment instructions while labeling historical material.

**Acceptance criteria:**

- [ ] A new setup walkthrough identifies every required variable, migration and external account.
- [ ] Implemented and planned capabilities are distinct.
- [ ] Links work.
- [ ] Backlog and status evidence agree.
- [ ] Docs explain webapp deployment versus Salesforce promotion.

**Dependencies / inputs:** Continuous; B31, B32, B33 provide final onboarding evidence.

**Verification evidence required:** Documentation/link review and a clean-environment onboarding walkthrough.

**Expected result:** README, supported scope, setup, architecture and recovery instructions match verified behavior.

<a id="b36"></a>

### B36 — Runner tooling dependency security

**Type:** Story · **Priority:** P1 · **Status:** In progress · **Epic:** E1 Quality and security

**User story:** As a platform operator, I want reviewed runner dependencies so the deployment toolchain has a documented vulnerability posture.

**Current evidence / gap:** Clean lockfile audit reproduced all 64 findings. High/critical package dispositions are recorded in TOOLCHAIN-AUDIT.md. Critical Handlebars advisories identified; no unsafe override or risk acceptance applied. Remediation and plugin-tree audit remain.

**Implementation tasks:** Capture advisory details for the pinned CLI and plugin trees; determine affected execution paths; choose compatible patched pins or documented mitigations; run real scanner and non-production CLI compatibility checks. Do not run an unreviewed `npm audit fix --force` in deployment jobs.

**Acceptance criteria:**

- [ ] Each relevant high/critical advisory has documented disposition and owner.
- [ ] Approved pins or mitigations are reflected in workflow/setup configuration.
- [ ] Scanner and CLI compatibility checks pass after changes.
- [ ] Isolation and credential boundaries remain enforced.

**Dependencies / inputs:** B05, B19, B31; upstream vendor fixes and advisory details.

**Verification evidence required:** Dependency audit report, reviewed remediation decision and compatibility results.

**Expected result:** Toolchain dependency risks are resolved or explicitly reviewed before rollout.

## Evidence checkpoint

- Through `ec5e04d`: 76 local tests and syntax checks passed; PR #5 had three passing checks. These are historical checkpoint results, not fresh results from this documentation edit.
- B05–B08 now have policy-driven adapters, deterministic negative tests, an offline MCP subprocess and signed preflight callback regression coverage. See [quality policy setup](QUALITY-POLICIES.md). These are implementation results, not live Salesforce acceptance. B05 retains real-scanner CI fixtures; runtime and expanded metadata/persona verification remain bounded by the documented support matrix.
- B09 has durable journal and interruption regression coverage; live fault injection is outstanding.
- B10 now has a restricted read-only MCP mode with offline subprocess tests, displays saved operation evidence and blocks unresolved starts. The display is not a live Salesforce query; authenticated status workflow and result recording are implemented with local transport tests; controlled recovery and live verification remain outstanding.
- B11 has action-boundary pause and outcome reporting; it does not guarantee cancellation of an already accepted Salesforce operation.
- No live end-to-end Salesforce delivery, full promotion rehearsal, or production readiness is claimed by this board.

## Scope traceability

The audit stories support the requested BRD → requirements/Jira → design/mockup approval → Salesforce architecture → MCP → Dev → tests/repair → quality gate → QA → UAT → business approval → production flow. B32 validates the upstream BRD/Jira/mockup path; B33 validates promotion. B18/B07 cover license analysis and destination enforcement; B19 covers MCP; B26 covers bounded autonomous repair. B34 keeps the target multi-agent stack distinct from the implemented system. Copado is not the target deployment mechanism.

Additional gaps found during implementation should receive a new stable ID (starting B37), a clear story and acceptance evidence rather than silently expanding a completed story. This catalog covers the original 35-item audit plus the newly observed tooling issue; it is not a guarantee that no further gaps will be found.

## October 21 implementation checkpoint

See [delivery controls](DELIVERY-CONTROLS.md) and [toolchain audit](TOOLCHAIN-AUDIT.md). 126 local tests and syntax checks passed before final documentation updates. No live Salesforce calls or production promotion were performed. The CLI credential command was corrected using official vendor documentation; Hosted/DX integration remains unimplemented.

October 22: B10/B13 implementation now has controlled terminal recovery and global org locks. 127 local tests and syntax checks passed, plus the target-lock SQL verification script. Migration 004 is required; no live database changes were made.
