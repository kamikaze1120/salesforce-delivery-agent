# Security Policy

## Support status

Version 0.2 is a sandbox pilot. Live integration behavior and database migrations require verification in your environment. There is no production-deployment capability or guaranteed security response SLA.

## Reporting a vulnerability

Contact the repository owner, @Mujtaba (mujtaba.mohammed720@gmail.com), through an established private channel. Do not put vulnerabilities, tokens, customer data, BRDs, or exploit details in public issues. If no private channel is available, ask the owner to arrange one without disclosing the vulnerability. Use GitHub private vulnerability reporting only if it is enabled for this repository.

Include the affected version, reproduction steps using synthetic data, likely impact, and a suggested fix if available. Remove secrets from screenshots and logs. Coordinate disclosure with the maintainer and avoid testing systems or accounts you do not own or have authorization to assess.

## Operating guidance

- Use Salesforce sandboxes and least-privilege integration accounts.
- Keep Supabase service-role keys and the encryption key server-side.
- Use separate credentials and databases for trusted deployments and previews.
- Preserve the database and encryption key through a secure backup process.
- Review generated Salesforce code and permissions before validation or deployment.
- Keep unknown external writes paused until their outcome is independently verified.
- Review docs/SETUP.md, docs/UPGRADE.md, and docs/VERIFICATION.md before live use.

If a credential is exposed, revoke it at the provider and reconnect the affected integration. Deleting the current Git file does not remove secrets from repository history.
