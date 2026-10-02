# Contributing

This project is a Salesforce sandbox delivery pilot. Read README.md and docs/ARCHITECTURE.md before changing the workflow or connectors.

## Development

Use Node.js 22. There are no runtime npm dependencies.

1. Create a branch for a focused change.
2. Run npm test and npm run build from the repository root.
3. Describe the problem, behavior change, validation evidence, and remaining limitations in your pull request.
4. Request review before merging.

Keep application files in their existing folders. Keep secrets out of Git; use .env.local locally and environment variables in Vercel. Commit only the example configuration.

## Safety requirements

- Enforce authentication, workspace membership, and role checks on the server.
- Preserve sandbox identity checks, human approvals, exact release binding, and production-deployment blocking.
- Do not automatically retry an external write with an unknown outcome.
- Treat BRDs and generated code as untrusted input.
- Use dedicated sandbox accounts and synthetic data for integration testing.
- Add meaningful regression coverage when changing security or workflow behavior.

Follow CODE_OF_CONDUCT.md. Report vulnerabilities privately as described in SECURITY.md. Contributions are provided under the repository's MIT license.
