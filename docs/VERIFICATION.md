# Verification — v0.4

## Automated evidence

`npm test` and `npm run build` run locally. Tests cover authentication/origin checks, workspace isolation, encryption, optimistic concurrency, production blocking in direct API calls, metadata restrictions, Jira preflight, Git branch handling, release binding, UI escaping, and the new controls below:

- Developer Edition requires explicit configuration and expected-org matching.
- Refresh-token rotation uses a persisted revision claim; ambiguous exchanges are not replayed.
- Mockups and tests must cite existing requirement IDs and cover requirements.
- Browser plans reject arbitrary URLs and executable JavaScript actions.
- Pipeline configuration requires five distinct targets, bounded repair attempts and production last.
- Stage advancement binds prior evidence to the current artifact and rejects replay.
- Repairs cannot edit frozen Apex test files.
- Signed OIDC verification rejects wrong repositories, workflow commits, environments, expired tokens and reruns.

Mocked API responses and generated RSA test identities are unit-test fixtures. They do not prove an actual GitHub OIDC exchange, Salesforce deployment, model response, browser session or production approval has succeeded.

## Live status and required verification

The v0.3 Vercel application and Supabase pilot workspace were previously verified. A Developer Edition External Client App exists. v0.4's full multi-org pipeline, JWT credentials, MCP bridge against a real org, browser acceptance sessions, AI mockup generation, AI test generation and repair loop still require live end-to-end verification. Jira and the LLM must be configured before a BRD-to-release pilot can complete.

Before enabling production, use synthetic data to verify: correct and wrong target IDs; negative authorization; successful and failing validation; real assertion failures; frozen tests during repair; budget exhaustion; interrupted writes; pause behavior; changed artifact/branch; UAT rejection; production reviewer enforcement; and secret-free logs. Retain real deployment IDs and test results. Never relabel synthetic fixtures or merely generated scripts as executed tests.
