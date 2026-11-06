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

Verify Silver persistence (`pipelines/02_silver_transactions.ipynb`) and point-in-time historical feature calculation (`pipelines/03_historical_features.ipynb`) in Databricks.

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

## Existing Notebooks & Shared Modules

- explorations/01_source_assesment.ipynb
- scripts/02_prepare_replay.ipynb
- scripts/03_release_replay.ipynb
- pipelines/01_bronze_transactions.ipynb
- pipelines/02_silver_transactions.ipynb
- pipelines/03_historical_features.ipynb
- pipelines/04_monitoring_rules.ipynb
- pipelines/historical_features.py

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
- **Silver Synthetic Fixture Verification Suite (24-Row Suite)**:
  - Confirmed in Databricks that all `24` synthetic fixture rows passed classification and reconciliation checks (`4` accepted, `19` quarantined, `1` identical duplicate extra, `4` distinct accepted IDs, `2` non-blank `_rescued_data` rows quarantined with `unexpected_rescued_data`, and `1` whitespace-only `_rescued_data` row accepted).
- **Historical Features Synthetic Verification Suite**:
  - Confirmed in Databricks that all synthetic historical-feature tests in `pipelines/03_historical_features.ipynb` passed (lower boundaries `-1h`/`-14d` included, `-1h-1s`/`-14d-1s` excluded, equal timestamps excluded, no-history `NULL` average, and future-event exclusion).
  - Real-data feature row counts have not yet been supplied.

### Local Checks vs. Pending Databricks Execution (Historical Features & Monitoring Rules)
- **Implemented & Reviewed Locally**:
  - Extracted shared historical feature transformation (`compute_historical_features` and `assert_feature_grain_and_null_semantics`) into `pipelines/historical_features.py` so both `pipelines/03_historical_features.ipynb` and `pipelines/04_monitoring_rules.ipynb` use the same implementation without code duplication.
  - Added `card_merchant_similar_amount_count_1h` (count of prior payments for the same `(cc_num, merchant)` in `[event_time - 1 hour, event_time)` within `±10%` of the current `amount`) alongside `card_merchant_txn_count_1h`.
  - Created `pipelines/04_monitoring_rules.ipynb` implementing three versioned rules with named provisional thresholds:
    - `RULE_01_CARD_VELOCITY_1H` (`v1.0-provisional`): `card_txn_count_1h >= 3`.
    - `RULE_02_UNUSUAL_AMOUNT_14D` (`v1.0-provisional`): `card_txn_count_14d >= 5` and `amount >= 3.00 * card_avg_amount_14d`.
    - `RULE_03_REPEATED_SIMILAR_MERCHANT_1H` (`v1.0-provisional`): `card_merchant_similar_amount_count_1h >= 2` (within `±10%` of current `amount`; merchant count alone does not establish similar amounts).
  - Preserved one output row per transaction (`trans_num`) with `matched_rule_ids`, `matched_rule_versions`, `matched_rule_count`, `is_flagged`, and structured `rule_evidence`, plus synthetic verification tests covering matches, non-matches, exact boundaries, and insufficient history.
  - **Local Structural Check (Passed)**: Validated `.ipynb` JSON structure, unique cell IDs, empty cell outputs, and Python AST compilation across `pipelines/historical_features.py`, `pipelines/03_historical_features.ipynb`, and `pipelines/04_monitoring_rules.ipynb`.
- **Pending Databricks Execution**:
  - Reporting of real-data feature row counts and execution of `pipelines/04_monitoring_rules.ipynb` (`#b2c3d4e5`, `#d4e5f6a7`, `#f6a7b8c9`) in Databricks are **pending**.

### Remaining Planned Work
1. Run `pipelines/04_monitoring_rules.ipynb` in Databricks and supply real-data feature counts and rule evaluation outcomes.
2. Implement Gold alerts and supporting evidence.

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
- Persist accepted transactions to `workspace.sentinel_silver.transactions` (excluding personal attributes) and all non-accepted records (`quarantined` and `duplicate_identical`) to `workspace.sentinel_silver.quarantine` using full-snapshot `overwrite` mode.
- The source timezone is unspecified.
- Preserve unix_time in Bronze and quarantine; its discrepancy remains unexplained.
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
2. Execute `pipelines/02_silver_transactions.ipynb` through Cell 22 (`#d0e1f2a3`) in Databricks, then re-execute Cells 20 (`#b8c9d0e1`) and 22 (`#d0e1f2a3`) to verify rerun idempotency.
3. Record confirmed persistence and rerun verification results before starting historical feature engineering.

## Verification Limitations

ACE's generated test command has not been configured for Sentinel.
Local checks do not establish that Databricks execution succeeded.
The automated ACE loop is not configured for this project.
