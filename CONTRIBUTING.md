# Contributing

Read README.md, docs/ARCHITECTURE.md and docs/PIPELINE.md before changing connectors or release behavior. Contributions are licensed under this repository's MIT license. Follow CODE_OF_CONDUCT.md.

## Development and pull requests

Use Node.js 22. The web app has no runtime npm dependencies. Run `npm test` and `npm run build`. The separate runner needs reviewed exact Salesforce CLI and Playwright versions and authorized test orgs; do not use production credentials for contribution tests.

Create a focused branch and explain the problem, behavior change, validation and remaining limits. Include reproducible synthetic fixtures. Request review before merging, especially for authentication, generated metadata, OIDC, MCP tools, environment gates, automatic repairs or dependency updates. Do not modify trusted runner files on generated feature branches.

## Required controls

- Preserve server-side tenant/role checks, encrypted secrets and exact artifact/org binding.
- Treat BRDs, metadata, logs, tool results and model output as untrusted data.
- Never mark generated tests as executed or fabricate success evidence.
- Do not weaken assertions, remove tests or alter business requirements to make a repair pass.
- Preserve production reviewers, frozen tests, repair budgets and unknown-write stops.
- Add regression coverage for changed security and workflow behavior.
- Never commit credentials, private BRDs, browser storage state or customer data.
- Keep documentation aligned with actual capabilities and clearly identify unverified live behavior.

Report security issues privately as described in SECURITY.md. General bugs and feature requests can use repository issues with secrets removed. Maintainers may request changes or decline contributions that weaken release controls.
