# Security preflight: Apex static policy v1

Status: B05 in progress. This is a deliberately limited static-analysis gate, not a security certification or production-readiness claim.

## Execution and trust

The GitHub runner verifies the immutable artifact hash and runs the scanner before authenticating to Salesforce or submitting validation/deployment. It scans all `.cls` files, including tests, in a fresh temporary workspace. Only fixed-path Apex files are copied there; model-generated configuration, scripts and dependency files cannot run. The scanner receives PATH, a separate tool HOME, optional JAVA_HOME and telemetry/update settings. Salesforce credentials and GitHub identity tokens are excluded.

Installation requires exact reviewed `SALESFORCE_CLI_VERSION`, `PLAYWRIGHT_VERSION` and `CODE_ANALYZER_VERSION` environment variables. Code Analyzer must be v5. Java 11+ and a fresh GitHub-hosted runner are prerequisites. The installed plugin lives under `RUNNER_TEMP/delivery-analyzer-home`; installation records the requested pin only after the command succeeds. No automatic version selection is performed by the application.

The fixed selector is `pmd:Security`, with Code Analyzer suppressions disabled. Native PMD and Code Analyzer suppression markers are also rejected in source. The runner does not execute auto-fixes. It captures the scanner JSON itself; users and models cannot submit this evidence through a new API.

## Outcomes

| Outcome | Meaning |
|---|---|
| Passed | Apex-only scope, successful scanner process, engine versions present, coherent counts, zero reported security findings. |
| Failed | At least one reported security finding, including Low and Info. No waivers. |
| Blocked | Missing installation/version, process failure/timeout, malformed/stale evidence, invalid source, suppressions, or unsupported metadata. |

Evidence includes artifact hash, policy ID, target paths, plugin/core/engine versions, aggregate counts, rule/severity identifiers and a report digest. Scanner messages and source excerpts are not returned to the application. Temporary source and reports are deleted on completion. The report digest is not a retained downloadable raw report.

At this stage, all non-passing security preflights stop with a blocked pipeline status. Automatic security repair and richer finding locations belong to the repair/evidence backlog; this change must not retry configuration failures as code defects.

## Deliberate limits and remaining verification

- Only Apex classes, their companion metadata and the server-generated package manifest are accepted by this policy. Objects, permission sets, profiles, Flows, triggers and LWC need additional reviewed policies and remain blocked.
- PMD static findings do not establish runtime CRUD/FLS, sharing, persona access, dependency safety, effective org permissions or absence of vulnerabilities.
- The reviewed plugin version must be exercised on known-good, known-bad and malformed Apex in the deployment runner before pilot activation. Local fixture tests alone do not establish scanner interoperability.
- Performance, license, regression and Flow quality gates retain their existing fail-closed behavior. No end-to-end Salesforce success is implied.

## Official references

- [Salesforce Code Analyzer CLI setup](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/analyze.html)
- [Run command and suppression flags](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_code-analyzer_run.html)
- [JSON output schema](https://developer.salesforce.com/docs/platform/salesforce-code-analyzer/guide/output-schemas-json.html)
