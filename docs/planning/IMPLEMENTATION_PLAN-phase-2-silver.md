# Phase 2 — Silver Implementation Plan

## Objective

Produce trusted transactions and quarantine records from released
Bronze data, with every input row accounted for.

## Steps

1. Inspect Bronze schema and amount precision.
2. Normalize required fields and convert their types.
3. Assign explicit validation reasons.
4. Handle duplicate transaction IDs without arbitrary record selection.
5. Separate accepted and quarantined records.
6. Verify row reconciliation and accepted-key uniqueness.
7. Persist outputs and verify rerun behavior.
8. Test invalid inputs and duplicate scenarios.

## Constraints

- Read only ingested Bronze transactions.
- Exclude evaluation labels.
- Preserve source references.
- Use the written transaction timestamp as TIMESTAMP_NTZ.
- Do not silently round amounts or discard records.

## Status

Implementation and verification pending.