# Active Context: Sentinel

## Session Metadata

- Last updated: 2026-11-05
- Active role: QA Engineer
- Mode: VERIFICATION

## Project

Sentinel is a fintech transaction monitoring and investigation platform.

Transactions are validated, enriched with earlier activity, and assessed
using monitoring rules. Alerts provide evidence for analyst review.
An alert does not automatically establish fraud or block a transaction.

## Current Objective

Verify Phase 2 Silver typing, validation, duplicate classification, and row
reconciliation using controlled synthetic fixtures before persisting Silver
and quarantine tables.

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

### Executed and Confirmed in Databricks (`2019-01-01` Bronze Batch)
- **Bronze Schema & Amount Precision**:
  - Bronze (`workspace.sentinel_bronze.transactions`) contains 2,414 transactions for `2019-01-01`.
  - Source business fields are `STRING`; `replay_batch` is `DATE`; `_ingestion_timestamp` is `TIMESTAMP`.
  - All 2,414 amounts convert to `DECIMAL(18,2)` with 0 unparseable/out-of-range values and 0 amounts changed at two decimal places.
  - `is_fraud` is absent from Bronze.
- **Silver Classification & Row Reconciliation (`2019-01-01` Batch)**:
  - Bronze input: `2,414`
  - Accepted: `2,414`
  - Quarantined: `0`
  - Identical duplicate extras: `0`
  - Distinct accepted IDs: `2,414`
  - Disposition summary: all `2,414` rows classified as `accepted` / `unique_id`.
  - Validation-reason summary: `0` rows.

### Pending / Unconfirmed in Databricks
- **Bronze `_rescued_data` Inspection Result**: `_rescued_data` exists in the Bronze schema, and Cell 4 (`#d4b2e821`) is in `pipelines/02_silver_transactions.ipynb`, but its output for the `2019-01-01` Bronze batch has **not yet been supplied** and is not recorded as confirmed.
- **Synthetic Fixture Verification Suite**:
  - Extracted the Silver pipeline steps in `pipelines/02_silver_transactions.ipynb` into reusable functions (`summarize_rescued_data`, `normalize_and_type_transactions`, `assign_field_validation_reasons`, `classify_duplicate_transactions`, `classify_silver_transactions`, and `assert_and_summarize_reconciliation`) while preserving existing notebook behavior on `bronze`.
  - Added a 23-row in-memory synthetic test suite (`#a1b2c3d4`, `#b2c3d4e5`, `#c3d4e5f6`, `#d4e5f6a7`) exercising the actual transformation functions across valid inputs, whitespace trimming, `NULL`/blank required identifiers, missing/invalid timestamps, missing/malformed/zero/negative/precision-changing amounts, valid and invalid identical duplicate IDs, conflicting duplicate IDs (including valid+invalid pairs), multiple missing transaction IDs without row loss, and non-empty/malformed `_rescued_data`.
  - Execution of these synthetic test cells in Databricks is **pending**.

### Remaining Planned Work
1. Run the synthetic fixture test cells in `pipelines/02_silver_transactions.ipynb` in Databricks and confirm the Bronze `_rescued_data` inspection output from Cell 4 (`#d4b2e821`).
2. Decide how non-empty or malformed `_rescued_data` should be classified in Silver once Bronze inspection is confirmed.
3. Persist Silver accepted and quarantine tables and verify rerun behavior.
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

1. Commit and push the updated notebook, plan, and active context when ready, then pull in Databricks.
2. Execute the synthetic fixture test cells (`#b2c3d4e5`, `#c3d4e5f6`) and record the Bronze `_rescued_data` output from Cell 4 (`#d4b2e821`) in Databricks.
3. Finalize `_rescued_data` validation policy and proceed to Silver/quarantine table persistence.

## Verification Limitations

ACE's generated test command has not been configured for Sentinel.
Local checks do not establish that Databricks execution succeeded.
The automated ACE loop is not configured for this project.
