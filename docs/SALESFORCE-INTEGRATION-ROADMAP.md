# Immediate Salesforce integration roadmap — B37–B43

This roadmap restores the seven Salesforce capabilities identified during connection setup. The IDs are stable repository backlog IDs that continue after B36. They are implementation stories, not proof that selecting an OAuth scope enabled a product, granted a Salesforce license or completed an integration.

## Status summary

| ID | Priority | Story | Status | Related parent work |
|---|---|---|---|---|
| B37 | P1 — immediate | Configurable Salesforce API authorization | In progress | B18, B31 |
| B38 | P1 — immediate | Refresh-token lifecycle and reauthorization | In progress | Existing OAuth rotation controls |
| B39 | P1 — immediate | Salesforce Hosted MCP integration | Backlog | B19 |
| B40 | P1 — immediate | Salesforce Einstein AI provider | Backlog | B18, B31 |
| B41 | P1 — immediate | Visualforce development and UI verification | Backlog | B16, B20–B23 |
| B42 | P1 — immediate | Lightning UI development and verification | In progress | B16, B20–B23 |
| B43 | P1 — immediate | Controlled Salesforce web-session access | Backlog | B21–B23, B31 |

Recommended sequence: **B37 → B38 → B39/B40 → B41/B42 → B43**. Live verification remains part of B32/B33. Parent and child stories share evidence and must not double-count completion.

---

## B37 — Configurable Salesforce API authorization

**Scope mapping:** `api`

**User story:** As a workspace owner, I want reviewed connection capabilities so each workspace requests only the Salesforce API access required by its enabled features.

**Current evidence / gap:** The application already uses Salesforce REST, Tooling and Metadata APIs through a connected web session. Requested and granted scopes are not separately persisted or evaluated against enabled features.

**Implementation tasks:**

- Add a server-owned capability-to-scope allowlist.
- Let owners select supported capabilities without entering arbitrary scopes.
- Persist requested scopes and Salesforce-granted scopes separately.
- Reverify authorization when capability settings or client configuration change.
- Block only the affected feature when a required grant is missing.

**Acceptance criteria:**

- [ ] Unknown or unapproved scopes are rejected.
- [ ] Missing grants block the affected feature with a readable remediation.
- [ ] A saved selection cannot bypass org identity, release approvals or least-privilege policies.
- [ ] Scope evidence is redacted and bound to workspace, org and observation time.

**Dependencies:** B18 license/capability rules and B31 setup preflight.

**Verification evidence:** Positive and negative OAuth integration tests, redacted sandbox grant evidence and current provider documentation.

---

## B38 — Refresh-token lifecycle and reauthorization

**Scope mapping:** `refresh_token` / `offline_access`

**User story:** As a delivery user, I want durable authorization and clear renewal controls so an expired or revoked Salesforce connection cannot silently interrupt or weaken delivery.

**Current evidence / gap:** The application already claims a persisted connection revision before exchanging a refresh token and does not replay an ambiguous exchange. It still needs granted-scope evidence, explicit revoked/expired states, disconnect behavior and feature-specific reauthorization guidance.

**Implementation tasks:**

- Bind refresh results to org identity and granted scopes.
- Detect revoked, expired and administratively restricted connections.
- Add explicit disconnect and reauthorize controls.
- Invalidate affected setup evidence when grants change.
- Preserve compare-and-swap rotation and never replay an exchange with an unknown outcome.

**Acceptance criteria:**

- [ ] Concurrent refresh attempts cannot reuse a rotated token.
- [ ] Revocation, expiry and scope loss require reauthorization.
- [ ] Credentials stay encrypted and excluded from logs, reports and model inputs.
- [ ] Reauthorization cannot silently change the target org.

**Dependencies:** B37 and the existing OAuth rotation controls.

**Verification evidence:** Rotation races, revocation, expiry, disconnect, scope-change and wrong-org integration tests.

---

## B39 — Salesforce Hosted MCP integration

**Scope mapping:** `mcp_api`

**User story:** As a delivery user, I want supported Salesforce Hosted MCP tools connected through a constrained adapter so official capabilities can be used without allowing arbitrary model-selected actions.

**Current evidence / gap:** The repository contains a project-owned restricted MCP bridge for setup and reconciliation. It is not Salesforce Hosted MCP and must not be represented as such.

**Implementation tasks:**

- Implement the official Hosted MCP client under B19.
- Use supported External Client App and PKCE authentication.
- Discover enabled servers and validate advertised tool schemas.
- Map allowlisted tools to internal typed contracts.
- Separate read-only grounding from deploy-capable tools.
- Keep every write behind existing artifact, target, policy and human-approval gates.

**Acceptance criteria:**

- [ ] Disabled servers, missing entitlement/scopes and unknown tools fail closed.
- [ ] Read-only discovery works against a non-production org.
- [ ] Tool inputs are bound to workspace, org, artifact and approved operation.
- [ ] Reconciliation identities cannot invoke writes.
- [ ] The model cannot execute an arbitrary advertised tool.

**Dependencies:** B19, B14, B18 and B37–B38.

**Verification evidence:** Contract fixtures, auth failures, entitlement failures, tool-list changes and redacted non-production calls.

---

## B40 — Salesforce Einstein AI provider

**Scope mapping:** `einstein_gpt_api`

**User story:** As a workspace owner, I want Salesforce-hosted Einstein services available as an optional governed model provider when the org is entitled and the approved data policy permits it.

**Current evidence / gap:** Groq, OpenAI and Azure OpenAI provider paths exist. Salesforce Einstein is not implemented, and selecting an OAuth scope does not establish entitlement, model availability or approved data handling.

**Implementation tasks:**

- Discover actual Einstein/Models API entitlement and supported models.
- Add a provider adapter with the same structured-output, timeout, size and error contracts as existing providers.
- Record model identity, provider, region where available and usage evidence.
- Apply workspace data-classification and prompt-redaction policy.
- Keep provider selection separate from Salesforce deployment authorization.

**Acceptance criteria:**

- [ ] Missing entitlement, model or grant remains unknown/blocked rather than inferred.
- [ ] Structured JSON validation and response-size limits match existing planning controls.
- [ ] Credentials and Salesforce business data are not logged.
- [ ] Provider changes invalidate affected generated approvals.
- [ ] A non-Einstein alternative is documented with verified tradeoffs.

**Dependencies:** B18, B31 and B37–B38.

**Verification evidence:** Supported, unsupported, revoked, malformed-response and provider-switch scenarios with current authoritative documentation.

---

## B41 — Visualforce development and UI verification

**User story:** As a Salesforce developer, I want explicitly supported Visualforce generation and testing so legacy UI requirements can be delivered without treating unvalidated markup as deployable metadata.

**Current evidence / gap:** The generator does not currently support Visualforce pages or components. Browser policy and assertion-level evidence exist but have not been exercised for Visualforce.

**Implementation tasks:**

- Add schema-aware writers for approved Visualforce page/component metadata.
- Validate controllers, extensions, CRUD/FLS, sharing and output encoding.
- Add positive, negative, access and navigation fixtures.
- Define supported browser routes and resource origins.
- Include Visualforce in package ownership, security scanning and regression evidence.

**Acceptance criteria:**

- [ ] Unsupported tags, controllers and unsafe output fail closed.
- [ ] Generated packages contain only approved Visualforce components and dependencies.
- [ ] Access-denied and output-encoding cases are executable.
- [ ] Browser evidence identifies the exact page, persona and assertions.
- [ ] Visualforce is not selected when a reviewed Lightning alternative better satisfies the requirement.

**Dependencies:** B16, B20–B23, B30 and an approved component matrix.

**Verification evidence:** Positive/negative fixtures, disposable-org validation and persona-based browser execution.

---

## B42 — Lightning UI development and verification

**User story:** As a Salesforce developer, I want supported Lightning metadata and live UI verification so generated Lightning experiences are secure, accessible and traceable to approved requirements.

**Current evidence / gap:** The generator supports a constrained LWC file set, and the browser policy uses reviewed Salesforce origins with blocked-request evidence. Broader Lightning metadata, accessibility, persona sessions and live representative page execution remain incomplete.

**Implementation tasks:**

- Define a supported Lightning/LWC metadata matrix and schema-aware validation.
- Add target, exposure, form-factor and permission checks.
- Verify navigation, data access, errors, accessibility and responsive behavior.
- Bind browser assertions to stable acceptance-criterion IDs.
- Keep service workers disabled and resource origins narrowly reviewed.

**Acceptance criteria:**

- [ ] Unsupported Lightning metadata blocks explicitly.
- [ ] Exposed components have reviewed targets and least-privilege access.
- [ ] Representative pages load under allowed and denied personas.
- [ ] Required accessibility and error-state assertions execute.
- [ ] Missing resources or sessions produce blocked evidence, never a pass.

**Dependencies:** B16, B20–B23, B31 and B37–B38.

**Verification evidence:** Component fixtures, metadata validation, accessibility results and live non-production browser scenarios.

---

## B43 — Controlled Salesforce web-session access

**Scope mapping:** `web`

**User story:** As a test owner, I want isolated Salesforce web sessions so browser verification can represent real personas without exposing reusable credentials or broad interactive access.

**Current evidence / gap:** Browser tests and a narrow resource-origin policy exist. The platform does not yet provide the complete persona/session provisioning, isolation, refresh, revocation and cleanup lifecycle required for controlled live execution.

**Implementation tasks:**

- Provision approved test personas with least privilege.
- Establish isolated, short-lived browser contexts through a supported authentication flow.
- Bind every session to workspace, target org, persona, test run and expiry.
- Redact cookies, tokens, screenshots and traces.
- Revoke sessions and clean owned test data after execution.
- Prevent session use for unapproved interactive administration.

**Acceptance criteria:**

- [ ] Sessions cannot cross workspaces, orgs, users or test runs.
- [ ] Expired, revoked or wrong-persona sessions block with a clear reason.
- [ ] Cookies and tokens never appear in source, reports, artifacts or model prompts.
- [ ] Allowed and denied persona scenarios are both exercised.
- [ ] Cleanup failures are visible and cannot delete unrelated records.

**Dependencies:** B21–B23, B31, B37–B38 and approved test identities.

**Verification evidence:** Session-isolation, expiry, revocation, cross-workspace denial, redaction and live permission scenarios.

## Completion rule

No B37–B43 item moves to Done based only on selected scopes, local unit tests or a successful connection check. Completion requires accepted implementation, protected CI evidence, redacted non-production results, current documentation and reviewer approval of the remaining limitations.
