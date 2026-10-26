# Environment readiness — October 26, 2026

## What was verified live

The City of Plano delivery workspace preflight at `2026-10-26T14:08:06.083Z` passed database, target locks, Salesforce, Jira and the configured Groq model. The earlier October 23 evening report was captured before database migrations 003 and 004 were applied. Do not rerun the full schema to fix a stale report: select the intended workspace and run preflight again.

The private Salesforce source repository contains delivery, production and reconciliation workflows. Installing workflows is separate from enabling the application pipeline. Its saved configuration is still disabled. There are no live Salesforce deployment or end-to-end promotion results to claim.

## Required before the first runner authentication

1. Protect source `main`, require the `verify` status check and code review, enforce for administrators, disable force pushes and deletion.
2. Create GitHub environments `dev`, `qa`, `uat`, `production`, restricted to protected branches. UAT and production additionally require independent reviewers and prevention of self-review. The observed private-repository settings do not expose required reviewers. Resolve plan/organization support before enabling the full pipeline. Do not make private source public or remove gates as a workaround.
3. Have an org administrator configure a JWT external client app and dedicated integration identity in each target org. Put `SF_CLIENT_ID`, `SF_USERNAME`, `SF_JWT_PRIVATE_KEY` in that GitHub environment's secrets. The web app's OAuth login does not supply these.
4. Set exact reviewed tool variables `SALESFORCE_CLI_VERSION`, `PLAYWRIGHT_VERSION`, `CODE_ANALYZER_VERSION`. Existing CLI audit findings in [TOOLCHAIN-AUDIT.md](TOOLCHAIN-AUDIT.md) remain unresolved; no replacement version has been certified by this change.
5. Set repository variable `DELIVERY_SETUP_TARGETS` to a JSON object keyed by `dev`, `qa`, `uat`. Include only provisioned targets, for example:

```json
{
  "dev": {
    "name": "dev",
    "kind": "sandbox",
    "orgId": "REPLACE_WITH_EXPECTED_ORG_ID",
    "url": "https://YOUR-DEV.sandbox.my.salesforce.com"
  }
}
```

Use exact My Domain origins without trailing slashes. Each setup target must be non-production. Missing QA/UAT cannot be substituted with the development org for promotion.

## Read-only runner check

In the source repository choose **Actions → Salesforce setup verification → Run workflow → main → dev**. Repeat for QA/UAT after provisioning. This workflow does not accept a production target, deploy a package, execute Apex, or change business records. It checks protected main, required configuration, reviewed tooling installation, JWT authentication, restricted MCP discovery and the actual org ID/type/origin. Its MCP mode exposes only `inspect_org` and rejects all other tools on both client and server.

Review the GitHub job summary. Authentication/provider output is suppressed; temporary key/auth files are removed. A skipped job is not a pass. Installation and configuration failures must be corrected before proceeding. The app's `runner_environment` remains `unknown` because it does not yet ingest authenticated setup evidence; do not manually convert it to passed based on a screenshot or uploaded JSON.

A successful setup probe does **not** certify browser sessions, metadata deployment permissions, test policies, business requirements, or production readiness.

## Required before deployment testing

- Four actual distinct org identities and approved target URLs; only Dev is currently verified through the web connection.
- Independent UAT/production reviewers and enforced GitHub environment protections.
- Reviewed toolchain advisory disposition and exact pins.
- `DELIVERY_APP_ORIGIN`, `DELIVERY_ENVIRONMENTS`, complete pipeline JSON and reviewed current source `main` SHA.
- Approved synthetic BRD, mockup, architecture, implementation, requirement-linked executable tests and Jira stories.
- Project-specific quality policy at `quality/policies/<planHash>.json`, approved performance budgets, license requirements and independently maintained regression baseline.
- Dedicated browser test users/sessions where UI tests are required; approved test data and cleanup.

Only then run Dev → QA → UAT, review the release report, and obtain explicit business approval for production. Exercise failure/repair, pause/reconciliation, rejection and stale-approval cases before declaring the environment operational.

## Remaining crucial backlog

| Items | Remaining evidence/work |
|---|---|
| B01–B13, B30 | Live runner/OIDC, deployment, quality, interruption/recovery and lock-concurrency rehearsal; local tests alone are insufficient |
| B14–B18 | Existing metadata inventory, drift/dependency coverage, supported metadata expansion, Flow tests and license rule depth |
| B19, B21–B24 | Official hosted MCP adapter, Lightning/session compatibility, persona tests, test-data cleanup and separate production smoke coverage |
| B28–B29 | Post-deployment recovery and release activation/setup procedures tested against a real release |
| B31 | Setup probe added; authenticated evidence ingestion and full setup orchestration remain |
| B32–B33 | Synthetic development pilot and four-org promotion rehearsal blocked on the prerequisites above |
| B35–B36 | Keep docs synchronized; resolve and retest runner tooling advisories |

This readiness checkpoint does not close the full backlog. See [BACKLOG.md](BACKLOG.md) for acceptance criteria and [QUALITY-POLICIES.md](QUALITY-POLICIES.md) for the quality contract.
