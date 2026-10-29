# Salesforce Delivery Tool recovery status — October 29, 2026

This checkpoint replaces assumptions from the interrupted chat session with repository and live-preflight evidence. It is a status record, not a declaration that the platform is production-ready.

## Confirmed before this recovery session

- The configured workspace preflight on October 26 passed the database, migration 004 target locks, Salesforce, Jira and Groq checks. Earlier database failures were stale reports captured before migrations 003 and 004.
- The application repository contained the major safety, quality, reconciliation, continuation and locking foundations described in `WORK-STATUS.md`.
- The private Salesforce source repository contained delivery, production, reconciliation and read-only setup workflows; its latest recorded runner-source workflow passed.
- The application pipeline remained disabled. There was no accepted live Salesforce deployment, four-org promotion rehearsal or production release.
- Full activation still required protected source branches, GitHub environments and reviewers, per-org JWT credentials, four distinct org identities, reviewed tool pins, approved release inputs and project-specific quality baselines.

## Recovered and merged in this session

### PR #15 — bounded Salesforce metadata inventory

Merged as `e804abf` after App checks and Vercel passed.

- Added explicit limits for object, selected-schema, field and Apex-name retrieval.
- Records observed, partial and unknown evidence instead of treating inaccessible metadata as absent.
- Redacts provider errors and unused response fields.
- Preserves current Groq support.
- Added regression coverage for truncation, redaction, access failures and stable hashes.

**Backlog effect:** B14 moved from untouched backlog to partial implementation. Apex source, Flow definitions, permission sets, sharing rules and dependency discovery remain missing.

### PR #16 — bounded metadata drift foundation

Merged as `3b68bcb` after App checks and Vercel passed.

- Added deterministic canonicalization that ignores timestamps and response ordering.
- Detects meaningful object, schema, field, reference, retrieval-limit and namespaced Apex differences.
- Fails closed on unknown, unsupported, malformed or duplicate evidence.
- Returns readable, bounded differences and explicit unverifiable paths.
- Added six regression scenarios and a limitations contract.

**Backlog effect:** B15 now has a tested comparison foundation. It is not yet connected to validation, deployment or the protected runner.

### Stale work retired safely

- PR #12 was closed without merging its stale code.
- Its metadata implementation was rebuilt on current `main` in PR #15.
- Its live-setup guidance and B37–B43 roadmap were recovered separately so newer Groq and readiness work was not overwritten.

## Documentation merged in PR #17

The recovery documentation PR #17, merged as `2aa6ead`, contains:

- `LIVE-SALESFORCE-SETUP.md` aligned with the current read-only setup workflow and separate runner JWT credentials;
- `SALESFORCE-INTEGRATION-ROADMAP.md` with stable stories B37–B43 for API authorization, token lifecycle, Hosted MCP, Einstein, Visualforce, Lightning and controlled web sessions; and
- this recovery checkpoint.

These documents do not enable scopes, licenses, environments or deployments by themselves.

## Pending implementation backlog

| Area | Current state | Next executable work |
|---|---|---|
| B14 metadata retrieval | Partial | Retrieve reviewed Apex/Flow/permission/sharing/dependency evidence with explicit limits and hashes. |
| B15 drift gate | Direct sandbox gate merged in PR #18 | Add full metadata/dependency coverage, pre-write verification in protected CI, and complete affected-approval invalidation. |
| B16 expanded writers | Backlog | Add schema-aware writers and fixtures for approved metadata types. |
| B17 Flow testing | Backlog | Implement version-specific Flow execution, activation and restoration evidence. |
| B18 license engine | Backlog | Add versioned, source-backed entitlement rules and alternatives. |
| B19 official MCP | Backlog | Implement and verify the official Salesforce Hosted/DX adapter; keep the custom bridge labeled accurately. |
| B20–B27 testing/repair | Mixed implementation and verification | Finish stable criterion IDs, personas, sessions, data cleanup, browser/live evidence and repair coverage. |
| B28–B29 release recovery | Backlog | Implement and rehearse post-deployment recovery and activation/setup plans. |
| B31 setup orchestration | In progress | Ingest authenticated setup evidence and complete owner-facing setup orchestration. |
| B32 synthetic pilot | Live blocked | Requires a reviewed synthetic release and functioning Dev runner setup. |
| B33 four-org rehearsal | Live blocked | Requires distinct Dev, QA, UAT and Production identities plus protected reviewers. |
| B36 toolchain advisories | In progress | Resolve and retest the recorded Salesforce CLI dependency findings before enabling secret-bearing runners. |
| B37–B38 Salesforce OAuth | Partial implementation merged in PRs #19–#20 | Complete feature-specific permissions, live grant, revocation and refresh verification. |
| B39–B43 Salesforce upgrades | Roadmap | Implement Hosted MCP, Einstein, Visualforce, Lightning and controlled sessions after required adapters and evidence. |

## External setup still required

The following cannot be closed by repository-only changes:

1. Protect source `main`, require review and the `verify` check, enforce restrictions and block force pushes/deletion.
2. Create `dev`, `qa`, `uat` and `production` GitHub environments. UAT and Production require independent reviewers and prevention of self-review.
3. Configure a dedicated JWT external client app and integration user in each target org, then store credentials only in the matching protected environment.
4. Provision distinct QA, UAT and Production org identities; the development connection cannot substitute for promotion targets.
5. Approve exact Salesforce CLI, Playwright and Code Analyzer versions after the B36 advisory review.
6. Approve a synthetic BRD/release, quality policy, performance budgets, license requirements, test personas and cleanup data.

## Recommended execution order

1. Extend B15 from the merged direct sandbox gate to the protected runner, with full dependency checks and stale-approval invalidation.
2. Expand B14 enough to cover the metadata that B15 must protect.
3. Finish B37–B38 configuration, scope and revocation tests on top of the merged OAuth foundations.
4. Complete protected source/environment/JWT setup and ingest authenticated setup evidence.
5. Run the B32 synthetic Dev pilot, including failure and recovery paths.
6. Continue B16–B24 and B39–B43 according to the approved pilot requirements.
7. Run B33 only after four distinct targets and independent reviewers are in place.

No production deployment was performed during this recovery session.

## Continuation in this session — October 29

- **PR #18 / `b2c0ce7`:** pre-validation/pre-deployment direct sandbox metadata drift gate, including fail-closed truncated/unknown evidence. GitHub App checks run 95 and Vercel preview succeeded. Protected CI promotion is separate and still requires its own gate.
- **PR #19 / `56113ca`:** a server-owned core OAuth scope allowlist, PKCE state binding and redacted provider grant evidence (including explicit unknown if omitted). GitHub App checks run 97 and Vercel preview succeeded. Optional Hosted MCP/Einstein/web access is not requested before implementation.
- **PR #20 / `eb6aec1`:** connection expiry safeguards, refresh-scope evidence re-evaluation, owner-only disconnect and UI authorization status. GitHub App checks run 99 and Vercel preview succeeded. No connection was actually disconnected by the code change.
- The B01–B43 board was brought up to date without marking any story Done. No non-production Salesforce deployment or production release occurred.
