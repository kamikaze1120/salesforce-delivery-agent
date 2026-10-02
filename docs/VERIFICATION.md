# Verification evidence

Verified locally during source creation on 2026-10-01.

## Completed checks

- `npm run build`: JavaScript syntax checks pass across the source. No compilation or package download is required for this Node/static application.
- `npm test`: 31 automated tests pass.
- Local HTTP smoke test starts the real Node server and verifies the homepage, client asset delivery, CSP, health response, unauthenticated API rejection, and cross-origin write rejection.
- Unit tests exercise tenant-bound authenticated encryption, secret omission, host/path validation, manifest generation, source-format object conversion, ZIP CRC/directory output, plan traceability, and approval invalidation.
- API tests verify role restrictions, optimistic concurrency rejection, Salesforce production-org rejection, and the unconditional production-operation block.
- Adapter tests with mocked upstream services inspect the actual requests for isolated Git branch creation/revision, Salesforce check-only/test/rollback options, surfaced deployment failures, and Jira issue recovery.
- Client rendering tests load the real app script in a minimal DOM harness, render the sample workspace and key views, and verify escaping of untrusted model/BRD content. These are rendering-unit checks, not real browser interaction tests.

- v0.2 regression checks cover approval expiry and evidence substitution, failed/incomplete/stale validation, active leases, unknown-write recovery rejection, revision-checked credential writes, atomic completion request shape, and non-submit connection buttons. A mocked authenticated API flow verifies that the write checkpoint precedes Jira dispatch and an ambiguous result remains blocked.

## Not verified

| Boundary | Status | What remains |
| --- | --- | --- |
| Visual browser preview | Blocked | The cloud browser rejected access to the local preview (`ERR_BLOCKED_BY_CLIENT`). Layout, responsiveness, keyboard flow, and actual browser event behavior need verification in your local browser or a Vercel preview. |
| v0.2 SQL migration | Not executed against PostgreSQL | New RPC functions and transactional locking require staging-database verification; local tests mock the REST boundary and do not prove database transaction behavior. |
| Supabase live authentication and persistence | Not connected | Run the schema in your project, configure keys, and verify sign-in, account confirmation, saved connections, and workspace isolation. |
| Salesforce OAuth / org inspection | Not connected | Authorize your sandbox External Client App; verify callback policies and the integration user's permissions. |
| LLM analysis and generation | Not connected | Configure your approved model/deployment; verify JSON-mode compatibility, exact citations, and clarification quality. |
| Jira live story creation | Not connected | Verify project permissions, issue type, and mandatory custom fields in a pilot project. |
| GitHub live commits | Not connected | Verify token permissions, repository layout, branch policy, and Copado source-format conventions. |
| Salesforce validation and sandbox release | Not connected | Validate a small reviewed feature with real org metadata, retrieve actual tests, and record business acceptance evidence. |
| Copado automatic promotion | Not implemented | Current release exports a manual handoff. Implement and verify the edition-specific adapter before enabling automation. |
| Production release | Disabled | Backend blocks production. Production prechecks, UAT, release governance, and connector tests are prerequisites to a later release. |
| Vercel deployment | Not performed | Commit source, import the repository, set environment variables, and verify the deployed API route and OAuth callbacks. |

Do not interpret passing source-level tests as confirmation that your live accounts, generated Salesforce solution, or deployment pipeline are working. The app displays actual upstream outcomes when configured; it does not fabricate test or deployment success.
