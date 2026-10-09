# Specialized agents and platform stack

This is the target product architecture. It does not claim that nine independent agents or the proposed framework migration are already running. The current Node API combines several roles; deterministic orchestration enforces deployment authority. Machine-readable target contracts: `config/agent-contracts.json`.

## Coordinated agents

| Agent | Responsibility | Boundary |
| --- | --- | --- |
| BRD Reader | BRD/process evidence, epics, stories, acceptance, requirement tests, gaps and risk | Cannot invent business decisions or execute changes |
| Salesforce Architect | Choose custom objects/metadata, Flow, Apex, triggers, events, Queueable, LWC and validation patterns | Must cite inspected metadata and explain tradeoffs |
| License Analyst | Edition, enabled features, user/permission-set licenses, packages, API/storage constraints | Unknown is distinct from denied; never infer absence from failed API access |
| Solution Designer | Relationships, diagrams, mockups, sharing, permissions, deployment/recovery plan | Human design approval before build |
| Code Generator | Allowed metadata, implementation and meaningful tests | No credentials, arbitrary shell, approvals or unchecked file paths |
| Salesforce MCP | Discover approved tools; retrieve/validate/deploy metadata; collect results | Org-bound allowlists and immutable artifact; no model-selected destination |
| Testing | Apex, Flow, UI and regression execution | Actual tool evidence only; isolated test identities and data |
| Business Testing | Execute original business cases and compare observable results | Frozen expected outcomes; no marking unexecuted cases passed |
| Deployment | Dev/QA/UAT/production promotion and release reports | Deterministic gates and human business approval for exact artifact |

One durable coordinator owns state. Agent messages are proposals or evidence, never authority to bypass gates. Separate agent identities do not make model results independent test evidence. Each step records model/prompt version, inputs, output schema, evidence references, artifact identity, duration and cost where available. Workers use leases, idempotency keys and durable outbox records; an uncertain external write requires reconciliation rather than blind retry.

## Technology decisions and migration

| Layer | Current repo | Target / migration decision |
| --- | --- | --- |
| Frontend | Static escaped HTML/JS | React + Next.js on Vercel; migrate views without losing current auth and approval rules |
| API | Node API on Vercel | FastAPI control API; separate authenticated worker service for long tasks |
| Reasoning workflow | Model calls plus persisted job state | LangGraph with PostgreSQL checkpoints; deterministic promotion remains outside model discretion |
| Durable execution | Supabase state/leases + GitHub Actions | Durable worker queue/outbox; choose Temporal only if LangGraph plus queue cannot meet recovery/SLA requirements; do not run two competing workflow authorities |
| Models | OpenAI / Azure OpenAI | Provider interface for GPT and Claude with capability checks, structured-output validation, timeouts and budget limits; Anthropic adapter not implemented yet |
| State/storage | Supabase PostgreSQL and encrypted connection records | Retain PostgreSQL, tenant isolation and encrypted secret references; object storage for large evidence |
| Retrieval | Supplied BRD and limited live metadata | Optional pgvector for versioned BRD/design/official-reference retrieval; vectors are not a source of entitlement truth |
| Salesforce | Project-owned MCP bridge over CLI/API | Capability-discovered official Hosted MCP where suitable; supported CLI/Metadata API adapter for operations not exposed; retirement-aware local DX MCP compatibility only |
| Test execution | Apex + declarative Playwright runner | Add Flow, security, performance, regression and business evidence adapters with reviewable policy |
| CI/CD | GitHub Actions | Retain protected branches/environments, signed runner identity and immutable releases |

The framework migration is not included in the current draft implementation. It should preserve tested contracts and run side-by-side compatibility tests before replacing the control API. Long-running browser/test/orchestration workers must not depend on one Vercel HTTP request remaining open. Never put Salesforce integration secrets in browser bundles or vector indexes.

## Salesforce MCP selection

As checked on 2026-10-09, the official Salesforce repository announces end of life for the local `@salesforce/mcp` package on 2026-11-02. Do not make a new long-lived deployment depend on that retiring package. Current project MCP code is explicitly project-owned, not Salesforce's official Hosted or DX server.

Official DX documentation describes metadata retrieval/deployment, Apex testing and org tasks. Hosted MCP is a separate server surface: inspect the actual authenticated tool list, scopes, org eligibility and tool schemas before selecting it. Do not claim every hosted server can deploy metadata or create scratch orgs. Add a versioned adapter contract and record capability discovery; deny tools absent from the approved allowlist. Scratch-org provisioning additionally needs a configured Dev Hub, entitlement/quota checks, expiry, test data policy and cleanup.

Primary references:
- https://github.com/forcedotcom/mcp/issues/46
- https://github.com/salesforcecli/mcp
- https://developer.salesforce.com/docs/platform/sfdx-dev/guide/sfdx-dev-mcp-use-core-tools.html
- https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/end-of-life.html

## License reasoning and alternatives

Treat feature examples such as Opportunity Splits as hypothetical until verified. A missing CPQ, Knowledge, Field Service or Revenue Intelligence license does not, by itself, prove an unrelated feature is unavailable. Store each feature rule with official source, retrieved date, applicable release/edition, prerequisites and required user assignments. Compare it with the target org's observed configuration. Distinguish unsupported, supported with prerequisites, and unknown. Quote evidence for each conclusion and rerun checks per environment.

A proposed custom-object workaround is not automatically equivalent or license-compliant. Review functional differences, user-license object restrictions, storage/limits, security, maintenance and commercial terms. Do not recommend purchasing a specific SKU without current authoritative entitlement evidence.

## Missing technical controls to implement

- Requirement and design versioning with impact analysis and explicit approval invalidation.
- Full metadata dependency graph, drift detection, namespace/package versions and destructive-change exclusion.
- Test accounts per persona; synthetic data factories, cleanup, email sink and controlled external integrations. UI tests cannot verify email delivery without a test mailbox/sink connector.
- Criterion-level test traceability, observed results, baseline regression selection, Flow activation/test strategy and security/performance thresholds.
- Organization-wide deployment locks across separate deliveries; current per-delivery locks alone do not prevent concurrent changes to one org.
- Durable outbox, webhook signature validation, replay defense, cancellation and reconciliation UI.
- Secret vault/rotation, tenant-scoped retrieval, audit retention, redacted telemetry, backup/restore and recovery drills.
- Deployment backup/rollback planning and post-deploy smoke checks. Salesforce data changes are not automatically reversed by metadata rollback.
- Cost/token/API/storage budgets, concurrency caps, rate limiting and explicit retry policies.
- Provider/adapter contract tests, prompt-injection evaluations and a representative BRD benchmark before autonomous rollout.
