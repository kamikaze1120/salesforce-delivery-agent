# Architecture — v0.4

The dependency-free Node API and static UI run on Vercel. Supabase Auth identifies users. The server enforces workspace membership; server-only Supabase tables have RLS enabled with no browser read policies. Connection credentials are encrypted with AES-256-GCM and workspace/type associated data.

BRD input is immutable within a delivery. A model proposes exact-source requirements, questions and Jira stories. Blocking questions prevent plan approval. The model then proposes structured mockup screens; the UI renders escaped text and fixed controls instead of running generated HTML. Approval binds the screen hash, plan hash and connection version.

Code generation uses the approved plan and mockup plus the original BRD and inspected org context. Strict metadata path and XML checks build the package manifest server-side. Generated Flows stay Draft. Code review and test-expectation review precede CI/CD. Test plans use existing Apex test class names and declarative Playwright actions; manual or uncertain scenarios cannot be silently marked passed.

## Release execution and identity

A configured private GitHub repository contains the reviewed runner. The application dispatches only a pinned protected branch. GitHub issues short-lived OIDC identities. The API verifies signature against GitHub's fixed JWKS endpoint, issuer, audience, expiry, repository, workflow path, workflow SHA, branch, environment, run attempt and the delivery-specific run title. There is no shared callback API key in workflow inputs.

The pipeline snapshots approved artifact/test/BRD/plan/mockup hashes and environment policy. A stage claim is durably recorded before the runner receives the package. Earlier stages must have passed on that exact artifact. A completed or already claimed stage cannot be replayed. Account changes are blocked while the pipeline is active by the database migration.

Each GitHub job has isolated environment credentials. The private MCP bridge binds the authenticated Salesforce org to the expected ID/type/URL before validation, deployment, polling and Apex testing. It exposes no arbitrary shell or query interface. A deterministic runner controls tool calls; model output cannot invoke tools directly or approve a release.

GitHub environment reviewers gate UAT/production before their secrets become accessible. Production remains unavailable through the legacy direct web deployment API. The gated runner is the only implemented production path. Trusted maintainers with repository administration can change these controls; protect their accounts and review changes.

## Repair loop

Known non-production validation or test failures can request a repair. The budget is persisted before calling the model. The model sees the original BRD, approved answers and design, implementation, frozen tests and actual failure. Server validation forbids added/deleted implementation paths or modifications to frozen Apex tests and permission sets. A no-op repair stops. A successful repair commits to the isolated delivery branch, changes the artifact hash and restarts all stages; old evidence is retained in history.

Requirements, test expectations, credentials, policies and production approvals are outside the repair authority. Unknown external write outcomes stop and require reconciliation. Production failures do not trigger automatic changes. A pause blocks new API stage claims and repair requests; an already submitted Salesforce operation may still complete. Stop the GitHub workflow and inspect the org if immediate operational intervention is needed.

## Limits

This is not formal verification or a guarantee of correct business behavior. Existing full Salesforce source and Flow logic are not exhaustively retrieved. Semantic compliance, UI selectors, sufficient test coverage, org-specific limits, browser sessions and business acceptance need validation. Browser tests use the same approved suite at each stage and allow writes only outside production. Hosted Salesforce MCP is not yet an adapter. Test evidence is trusted only from the pinned authenticated runner; protect its repository and dependency supply chain.
