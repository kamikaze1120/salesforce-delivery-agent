# Security Policy

## Support status

Version 0.4 is a development release. Its gated production runner must not be enabled until live non-production verification and environment approvals are complete. There is no guaranteed security response SLA.

## Reporting a vulnerability

Contact the repository owner, @Mujtaba (mujtaba.mohammed720@gmail.com), through an established private channel. Do not put vulnerabilities, tokens, customer data, BRDs, or exploit details in public issues. If no private channel is available, ask the owner to arrange one without disclosing the vulnerability. Use GitHub private vulnerability reporting only if it is enabled for this repository.

Include the affected version, reproduction steps using synthetic data, likely impact, and a suggested fix if available. Remove secrets from screenshots and logs. Coordinate disclosure with the maintainer and avoid testing systems or accounts you do not own or have authorization to assess.

## Operating guidance

- Use distinct Salesforce orgs and least-privilege integration accounts. Keep production secrets behind required GitHub environment reviewers.
- Pin the trusted runner commit and dependency versions; protect runner branches and administrator accounts.
- Do not expose MCP transports publicly or allow arbitrary generated tool calls.
- Treat browser storage-state files as credentials. Never upload them as run artifacts.
- Keep Supabase service-role keys and the encryption key server-side.
- Use separate credentials and databases for trusted deployments and previews.
- Preserve the database and encryption key through a secure backup process.
- Review generated Salesforce code and permissions before validation or deployment.
- Keep unknown external writes paused until their outcome is independently verified.
- Review docs/SETUP.md, docs/UPGRADE.md, and docs/VERIFICATION.md before live use.

If a credential is exposed, revoke it at the provider and reconnect the affected integration. Deleting the current Git file does not remove secrets from repository history.
