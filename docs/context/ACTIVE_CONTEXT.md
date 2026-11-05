# Active Context: Sentinel

## Session Metadata

- Last updated: 2026-11-05
- Active role: Developer
- Mode: EXECUTION

## Project

Sentinel is a fintech transaction monitoring and investigation platform.

Transactions are validated, enriched with earlier activity, and assessed
using monitoring rules. Alerts provide evidence for analyst review.
An alert does not automatically establish fraud or block a transaction.

## Current Objective

Implement Phase 2 (Silver trusted transactions, historical features,
monitoring rules, and Gold evidence) one verified step at a time.

## Development Workflow

- Edit code and documentation in VS Code.
- Preserve existing notebooks in .ipynb format.
- Commit and push to GitHub.
- Pull the same branch in the Databricks Git folder.
- Execute notebooks using Serverless notebook compute.
- Inspect actual results before recording verification as passed.
- Pull locally before editing if changes were committed in Databricks.

Work one step at a time:
explain → implement → run → inspect → document → commit.

## Phase 1: Completed and Verified

- Assessed 1,852,394 records across fraudTrain.csv and fraudTest.csv.
- Selected 71,934 transactions across 42 dates.
- Initial history: January 1–14, 2019; 24,144 transactions.
- Rule development: January 15–28; 23,731 transactions.
- Evaluation: January 29–February 11; 24,059 transactions.
- Prepared daily Parquet batches and a count manifest.
- Stored fraud labels separately from operational replay inputs.
- Released January 1: 2,414 transactions.
- Ingested the released batch into Bronze using Auto Loader.
- Verified 2,414 unique transaction IDs.
- Reran ingestion with the same checkpoint; no rows were added.
- Phase 1 final commit: a81ba70.

## Existing Notebooks

- explorations/01_source_assesment.ipynb
- scripts/02_prepare_replay.ipynb
- scripts/03_release_replay.ipynb
- pipelines/01_bronze_transactions.ipynb
- pipelines/02_silver_transactions.ipynb

The assessment filename above reflects the existing repository spelling.

## Phase 2 Status

### Confirmed Databricks Inspection Results (Silver Step 1)
- Bronze (`workspace.sentinel_bronze.transactions`) contains 2,414 transactions for `2019-01-01`.
- Source business fields are `STRING`.
- `replay_batch` is `DATE` and `_ingestion_timestamp` is `TIMESTAMP`.
- All 2,414 amounts convert to `DECIMAL(18,2)` with 0 unparseable/out-of-range values and 0 amounts changed at two decimal places.
- `is_fraud` is absent from Bronze.
- `_rescued_data` exists in Bronze; its contents in Bronze have not yet been inspected.

### Implemented Locally — Pending Databricks Execution (Silver Step 2)
- Updated `docs/planning/IMPLEMENTATION_PLAN-phase-2-silver.md` with the 7 Silver typing, validation, rescued-data inspection, duplicate classification, and row-accounting decisions.
- Updated `pipelines/02_silver_transactions.ipynb` (preserving the existing inspection cells) to:
  1. Inspect `_rescued_data` counts and JSON keys in Bronze.
  2. Normalize blank required identifiers (`trans_num`, `cc_num`, `merchant`) to `NULL`, parse `trans_date_trans_time` as `TIMESTAMP_NTZ`, convert `amt` to `DECIMAL(18,2)` alongside `DECIMAL(38,18)`, and preserve raw values and lineage columns.
  3. Assign explicit field validation reasons.
  4. Classify duplicate `trans_num` occurrences across the entire Bronze input—comparing full business record signatures across all rows (including invalid rows) to distinguish identical duplicates from conflicting duplicates without arbitrary winner selection.
  5. Reconcile every Bronze input row into a mutually exclusive disposition (`accepted`, `quarantined`, or `duplicate_identical`) and verify accepted key uniqueness.
- No Silver or quarantine tables are written yet.
- Databricks runtime execution of the new cells in `pipelines/02_silver_transactions.ipynb` is **pending**.

### Remaining Planned Work
1. Execute and inspect the new Silver typing, validation, rescued-data, and reconciliation cells in Databricks.
2. Persist Silver accepted and quarantine tables and verify rerun behavior.
3. Test invalid inputs and duplicate scenarios using controlled fixtures.
4. Implement historical features using strictly earlier events.
5. Implement three versioned monitoring rules.
6. Implement Gold alerts and supporting evidence.

## Established Decisions

- Use trans_num as the transaction identifier.
- Preserve cc_num as a string.
- Normalize blank required identifiers (`trans_num`, `cc_num`, `merchant`) to `NULL`.
- Use trans_date_trans_time parsed as TIMESTAMP_NTZ for event ordering.
- Convert `amt` to `DECIMAL(18,2)`, detecting missing, unparseable/out-of-range, non-positive, and precision-changing values.
- Preserve source references and raw values needed for investigation.
- Inspect `_rescued_data` in Bronze before deciding how to classify it in Silver.
- Classify duplicate `trans_num` values across the entire Bronze input, distinguishing identical business records from conflicting records without letting invalid rows hide conflicts or arbitrarily selecting a winner.
- Account for every input row exactly once.
- The source timezone is unspecified.
- Preserve unix_time in Bronze; its discrepancy remains unexplained.
- Exclude fraud labels from monitoring features, rules, and AI inputs.
- Keep evaluation batches unreleased until thresholds are frozen.

## Implementation Requirements

- Use descriptive names and focused notebook cells.
- Explain purpose and important decisions in comments.
- Account for every input row.
- Preserve one accepted row per transaction ID.
- Prevent future events from entering historical features.
- Preserve intended row counts when joining data.
- Distinguish proposed checks from executed checks.

## Next Steps

1. Commit and push the updated plan, notebook, and active context when ready, then pull in Databricks.
2. Run all cells in `pipelines/02_silver_transactions.ipynb` on Databricks Serverless compute and inspect the `_rescued_data` and reconciliation outputs.
3. Decide how Silver should classify `_rescued_data` based on the Bronze inspection results.
4. Proceed to curated column selection, Silver/quarantine table persistence, and fixture verification tests.

## Verification Limitations

ACE's generated test command has not been configured for Sentinel.
Local checks do not establish that Databricks execution succeeded.
The automated ACE loop is not configured for this project.
