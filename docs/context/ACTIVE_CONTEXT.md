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

Complete verification of Phase 2 Silver typing, validation (including
`unexpected_rescued_data`), duplicate classification, and row reconciliation
before persisting Silver and quarantine tables.

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

### Executed and Confirmed in Databricks
- **Bronze Schema, Amount Precision & Rescued Data (`2019-01-01` Batch)**:
  - Bronze (`workspace.sentinel_bronze.transactions`) contains `2,414` transactions for `2019-01-01`.
  - Source business fields are `STRING`; `replay_batch` is `DATE`; `_ingestion_timestamp` is `TIMESTAMP`.
  - All `2,414` amounts convert to `DECIMAL(18,2)` with `0` unparseable/out-of-range values and `0` amounts changed at two decimal places.
  - `is_fraud` is absent from Bronze.
  - Non-null `_rescued_data` rows: `0`; non-blank `_rescued_data` rows: `0`.
- **Silver Classification & Row Reconciliation (`2019-01-01` Batch)**:
  - Bronze input: `2,414`
  - Accepted: `2,414`
  - Quarantined: `0`
  - Identical duplicate extras: `0`
  - Distinct accepted IDs: `2,414`
  - Disposition summary: all `2,414` rows classified as `accepted` / `unique_id`.
  - Validation-reason summary: `0` rows.
- **Synthetic Fixture Baseline (23-Row Suite)**:
  - Executed in Databricks and matched the documented 23-row classifications prior to enabling the `_rescued_data` quarantine rule.

### Local Checks vs. Pending Databricks Execution (`unexpected_rescued_data` Update)
- **Implemented & Reviewed Locally**:
  - Updated `docs/planning/IMPLEMENTATION_PLAN-phase-2-silver.md` and `pipelines/02_silver_transactions.ipynb` so any non-blank `_rescued_data` (`_rescued_data IS NOT NULL AND TRIM(_rescued_data) != ''`) appends `unexpected_rescued_data` to `field_validation_reasons` and quarantines the record while preserving `_rescued_data` for investigation. `NULL` and whitespace-only `_rescued_data` do not trigger this reason.
  - Updated synthetic rows `22` (valid JSON `_rescued_data`) and `23` (malformed `_rescued_data`) to expect `quarantined` with `["unexpected_rescued_data"]`, and added synthetic row `24` (`_rescued_data = "   "`) expecting `accepted` with `[]`.
  - Updated expected synthetic reconciliation counts to `24` input (`4` accepted, `19` quarantined, `1` duplicate_identical, `4` distinct accepted IDs, `2` rows with non-blank rescued data).
  - **Local Check**: Notebook JSON structure and Python AST syntax across all 16 cells in `pipelines/02_silver_transactions.ipynb` validated locally.
- **Pending Databricks Execution**:
  - Runtime execution of the updated `assign_field_validation_reasons` (`unexpected_rescued_data`) and the 24-row synthetic verification suite (`#b8f6d265`, `#d0b8f487`, `#f2d0b609`, `#b2c3d4e5`, `#c3d4e5f6`) in Databricks is **pending**.

### Remaining Planned Work
1. Run the updated cells in `pipelines/02_silver_transactions.ipynb` in Databricks and confirm the 24-row synthetic verification suite passes.
2. Persist Silver accepted and quarantine tables and verify rerun behavior.
3. Implement historical features using strictly earlier events.
4. Implement three versioned monitoring rules.
5. Implement Gold alerts and supporting evidence.

## Established Decisions

- Use trans_num as the transaction identifier.
- Preserve cc_num as a string.
- Normalize blank required identifiers (`trans_num`, `cc_num`, `merchant`) to `NULL`.
- Use trans_date_trans_time parsed as TIMESTAMP_NTZ for event ordering.
- Convert `amt` to `DECIMAL(18,2)`, detecting missing, unparseable/out-of-range, non-positive, and precision-changing values.
- Preserve source references and raw values (including `_rescued_data`) needed for investigation.
- Quarantine any row with non-blank `_rescued_data` using validation reason `unexpected_rescued_data`; `NULL` and whitespace-only `_rescued_data` do not trigger this reason.
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
2. Run `pipelines/02_silver_transactions.ipynb` in Databricks and confirm the `2,414` Bronze batch reconciliation and the `24`-row synthetic fixture assertions pass.
3. Proceed to Silver and quarantine table persistence.

## Verification Limitations

ACE's generated test command has not been configured for Sentinel.
Local checks do not establish that Databricks execution succeeded.
The automated ACE loop is not configured for this project.
