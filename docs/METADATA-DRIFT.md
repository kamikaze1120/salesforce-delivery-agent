# Bounded Salesforce metadata drift contract

This document describes the first implementation slice for backlog item B15. It compares the bounded metadata inventory created during BRD analysis. It does not claim full Salesforce dependency discovery or a live deployment gate.

## Compared evidence

The comparator canonicalizes and fingerprints:

- the returned object catalog, including labels and custom-object flags;
- selected object schemas, field types, required flags and reference targets;
- Apex class names and namespaces;
- configured retrieval limits;
- observed, partial and unknown evidence states;
- selected and omitted BRD matches; and
- the explicit list of metadata that was not retrieved.

Observation timestamps, provider-generated hashes and array ordering do not count as drift. Namespaced Apex classes remain separate even when their class names match.

## Fail-closed behavior

A comparison blocks when:

- any canonical bounded evidence changes;
- object, Apex or selected-schema evidence is unknown;
- the inventory version or limits are unsupported or malformed; or
- duplicate evidence makes the baseline ambiguous.

The result includes bounded added, removed and changed entries, the total difference count, omitted difference count, unverifiable paths and known retrieval limitations. It never turns an inaccessible result into evidence that a component is absent.

## Current limitations

This foundation is not yet invoked by validation, deployment or the GitHub runner. A later B15 slice must re-read the target immediately before a write, compare it with the approved baseline, persist signed evidence, invalidate affected approvals and require reanalysis after material drift.

The current inventory still excludes Apex source, Flow definitions, permission sets, sharing rules and metadata dependency discovery. Those B14 gaps prevent this comparator from being considered a complete Salesforce release baseline.

## Required evidence before B15 is complete

B15 remains open until the platform demonstrates:

1. live pre-write retrieval from the exact target org;
2. blocking behavior for changed fields, Flows and dependencies;
3. an approved policy for unrelated differences;
4. readable component-level drift reports;
5. approval invalidation and re-review; and
6. non-production rehearsal through the protected runner.
