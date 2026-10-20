# Reviewed quality policies: B05–B08

The built-in security, performance, destination-license and baseline-regression adapters execute trusted checks. The LLM cannot submit a pass file, waive a gate, change the approved workload, remove a baseline case or lower a threshold during repair. Live Salesforce interoperability remains to be verified.

## Set up a policy for a delivery

1. Approve the requirements, architecture, implementation and generated acceptance tests. Download the release bundle and extract `handoff.json`.
2. Run `node scripts/quality-template.mjs /path/to/handoff.json > quality-policy.json`. This creates an **incomplete template**, not an approval. Complete all placeholders; no org, approval or threshold is fabricated.
3. Add existing regression tests, reviewed CRUD/FLS/sharing tests (both allow and deny for every destination), and representative performance scenarios. Include expected assertions, exact class/method names, actual source hashes and approved budgets. A source hash is SHA-256 of the exact Salesforce Tooling API `ApexClass.Body` string, not the JSON encoding or an assumed local newline representation. New security/performance classes may be part of the approved artifact. Regression baseline classes must already exist in the destination.
4. Set `targets` to the exact configured Dev, QA, UAT and production org IDs. Add sourced license rules covering the release's actual requirements and account assignments. A reviewer must assess completeness; the system cannot infer contractual entitlement from an object name or edition alone.
5. Store the policy at `quality/policies/<planHash>.json` in the **trusted runner repository**. Review it through the protected branch process with a meaningful `reviewReference`. Pin that reviewed commit in the workspace pipeline configuration. The application retrieves the file at that exact commit before dispatch and snapshots it in the pipeline. There is no unreviewed policy upload endpoint.
6. Configure existing CLI/scanner/Playwright pins, JWT credentials and test-user browser state in each environment. Ensure the runner can read the relevant Tooling test results, Apex source and license inventories. If a rule is unreadable, fix access or review the requirement; do not mark it passed manually.
7. For instrumented Apex performance cases, configure an appropriate debug trace for the test-running user so `ApexTestResult.ApexLogId` is available and the marker below is retained. Missing, truncated or duplicate telemetry blocks the case. The app does not create or expand debug permissions automatically.
8. Start a new reviewed pipeline. Existing pipelines without a policy cannot use the new execution path; they must not be edited in storage to bypass the policy.

Changing the requirements changes the plan hash and requires a new policy. Repairs use the same reviewed plan policy; any generated modification of a pinned quality-test source is rejected. Review a new runner commit when intentionally changing baseline expectations, not to conceal a regression.

## Case contracts

Every case has a unique `id` within its category, `stages`, and a meaningful `expected` description. Every stage needs at least one performance and regression case and an allow/deny pair for each security dimension: `crud`, `fls`, `sharing`. Empty categories do not pass and these four gates cannot be marked not applicable.

### Apex cases

Use `kind: "apex"`, `className`, `method`, and `sourceHash`. Only unnamespaced Apex classes are currently supported. The worker verifies source hashes before and after execution. It checks exact method outcomes rather than trusting the class-level success summary. Missing, duplicate, skipped or mismatched method evidence blocks; a failed required method fails the gate.

Security cases also declare `dimension` and `access`. Reviewers must check real assertions for the intended user and access level. **`System.runAs` alone does not prove CRUD/FLS enforcement.** Tests must exercise the actual application path with explicit assertions about allowed and denied outcomes. These tests complement static analysis; full browser persona/session support remains B22.

Performance cases declare `workload`, positive integer `records` and `budgets`. Supported numeric budgets are `runtimeMs`, `cpuMs`, `queries`, `dml` and `records`. `budgets.records` must equal the approved record volume. The measured record count must match exactly; other measurements must be at or below their thresholds. Every requested metric must exist.

- `runtimeMs` comes from the observed Salesforce `ApexTestResult.RunTime`.
- CPU, query, DML and volume measurements come from the exact test method's Apex log, retrieved through its observed `ApexLogId` and bound to the CLI test-run ID.
- The pinned, reviewed test source must calculate these values from actual execution. Do not emit constants as supposed measurements. Capture counters around the intended workload and define whether the budget covers synchronous or asynchronous work. A synchronous measurement cannot establish asynchronous performance.
- Emit exactly one `USER_DEBUG` marker per observed method, for example:

```apex
// Within a reviewed @IsTest method, after recording starting counters and
// executing the real workload. Each variable below must come from that test.
System.debug(LoggingLevel.ERROR, 'DELIVERY_QUALITY_V1:' + JSON.serialize(
    new Map<String, Object>{
        'method' => 'bulkScenario',
        'cpuMs' => Limits.getCpuTime() - cpuBefore,
        'queries' => Limits.getQueries() - queriesBefore,
        'dml' => Limits.getDmlStatements() - dmlBefore,
        'records' => actualRecordsProcessed
    }
));
```

This is an instrumentation fragment, not a runnable test or an assertion of a universal safe threshold. Reviewers supply business-representative workloads and budgets. Existing Flow behavior can be measured through reviewed Apex business scenarios that actually trigger it; dedicated Flow-version testing and activation remain B17.

### Browser cases

Performance and regression may use `kind: "browser"`, the same approved declarative `steps` supported by the application, and `expected`. Performance additionally requires `workload` and exactly one `budgets.elapsedMs` value. The runner measures elapsed time from browser-context creation through the final assertion, including navigation/locator waits; this is scenario duration, not a browser Core Web Vital or server CPU metric.

A browser case must contain an assertion. It requires a dedicated test-user session. Production cases permit only `goto`, `assertVisible` and `assertText`; no arbitrary JavaScript, external URLs or write steps. Existing narrow Salesforce host restrictions apply. CDN/SSO compatibility and multiple personas remain B21/B22. A missing session or blocked resource cannot become a pass.

## Destination-license rules

Each rule has `id`, `kind`, `reason`, an official Salesforce documentation `source` URL, and `reviewedOn` date. The same release requirements are evaluated independently in every destination. Multiple allowed editions can cover differing development and production editions. A source link is review provenance, not automatic validation of the author's interpretation.

| Kind | Fields | Meaning |
|---|---|---|
| `edition` | `allowed: [string]` | Observed org edition is in the reviewed list. |
| `userLicense` | `key`, `minAvailable` | Active named org user-license capacity. |
| `featureLicense` | `key`, `minAvailable` | Active permission-set-license capacity by label. |
| `packageLicense` | `key`, `minAvailable` | Active package-license capacity by namespace. This does not establish installed package version compatibility. |
| `assignedFeature` | `key` | Connected runner user has the named permission-set-license assignment. |
| `assignedPermissionSet` | `key` | Connected runner user has the named permission-set assignment. |
| `connectedUserLicense` | `key` | The runner user's observed profile license matches. |
| `objectAccess` | `key`, `permissions` | Actual API-user `queryable`, `createable`, `updateable` or `deletable` flags. These do not imply metadata deployment permission or every end user's access. |
| `limit` | `key`, `minRemaining` | Observed remaining org capacity satisfies the reviewed minimum. |

The worker reads the destination immediately before **each** check-only validation/deployment intent and again for final quality evidence. The authenticated API independently evaluates and persists preflight inventory; it refuses a metadata intent without a matching passing preflight less than five minutes old. Evidence is bound to org, stage, policy and artifact. Configuration changes invalidate the existing pipeline.

Unreadable/truncated inventories, missing capabilities, unsupported unlimited-license encodings and ambiguous/inactive license states block. Missing inventory is not proof of a missing commercial entitlement. Expired capacity cannot pass. Salesforce `/limits` values may lag consumption; preflight is a snapshot, not a capacity reservation. Org-wide concurrency control remains B13. The wider planning license/alternative engine and package-version dependency checks remain B18/B15.

## Security scope

See [SECURITY-GATE.md](SECURITY-GATE.md). Current policy covers PMD Security analysis of all Apex source, restricted private custom objects with simple fields, and constrained permission sets. More complex metadata remains blocked. Static checks happen before Salesforce authentication; runtime access tests happen after deployment. Both must pass for the security quality category.

## Evidence and failure behavior

CI/CD displays per-category status and the full redacted evidence, including measured values versus thresholds, case IDs, source/policy hashes, license rules and destination identity. The UAT release report includes these records and the policy review reference. Raw Apex logs, source excerpts, tokens and cookies are not returned as quality evidence.

Missing setup or baseline/quality evidence stops the stage; it is not sent to the AI as permission to change the policy. No automatic retry of an unknown metadata write is introduced. Live rehearsals, generalized Flow/LWC security policies, complete persona tests, and post-release recovery remain separately tracked work.

## Authoritative API references

- [ApexTestResult fields](https://developer.salesforce.com/docs/platform/field-reference/references/field-reference/salesforce-field-reference-apextestresult.html)
- [Apex test CLI](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_apex_run_test.html)
- [PermissionSetLicenseAssign](https://developer.salesforce.com/docs/platform/field-reference/references/field-reference/salesforce-field-reference-permissionsetlicenseassign.html)
- [PermissionSetAssignment](https://developer.salesforce.com/docs/platform/field-reference/references/field-reference/salesforce-field-reference-permissionsetassignment.html)
- [sObject describe](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-sobject-describe.html)
- [Limits API and observation lag](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-limits.html)
