# Active Context: Sentinel

## Session Metadata

- Last updated: 2026-11-06
- Active role: QA Engineer
- Mode: VERIFICATION

## Project

Sentinel is a learning prototype combining Databricks skills with a polished React UI for fintech transaction monitoring and investigation.

Transactions are validated, enriched with earlier activity, and assessed
using monitoring rules. Alerts provide evidence for analyst review.
An alert does not automatically establish fraud or block a transaction.
Prioritize understandable implementation and small steps.

## Current Objective

Summarize rule-development evaluation results (`2019-01-15` through `2019-01-28`) in `pipelines/04_monitoring_rules.ipynb` after the 14-day initial-history warm-up.

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
- tests/04_monitoring_rules_tests.ipynb

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
- **Historical Features, Monitoring Rules & Gold Persistence (`2019-01-01` through `2019-01-28` & Synthetic Suites)**:
  - Confirmed in Databricks on the initial `2019-01-01` batch (`2,414` transactions): `21` flagged alerts (`1` velocity, `20` unusual amount, `0` repeated similar) and all synthetic historical-feature and monitoring-rule tests passed.
  - Confirmed in Databricks across the released `2019-01-01` through `2019-01-28` batches (`28` batches, `47,875` transactions): `2,719` saved alerts verified in `workspace.sentinel_gold.alerts`.

### Local Checks vs. Pending Databricks Execution (Rule-Development Summary Cell)
- **Implemented & Reviewed Locally**:
  - Added cell `#a9b0c1d2` to `pipelines/04_monitoring_rules.ipynb` to filter `evaluated_df` to `2019-01-15` through `2019-01-28` (`rule_development` period) and display evaluated transaction count, flagged count and percentage, matches per rule, and transactions matching multiple rules (excluding fraud labels and preserving all existing rules and Gold outputs).
  - **Local Structural & Syntax Check (Passed)**: Validated `.ipynb` JSON structure, unique cell IDs, empty outputs, and Python AST compilation across `pipelines/04_monitoring_rules.ipynb`.
- **Pending Databricks Execution**:
  - Execution of the new January 15–28 summary cell (`#a9b0c1d2`) in `pipelines/04_monitoring_rules.ipynb` is **pending**.

### Remaining Planned Work
1. Run cell `#a9b0c1d2` in `pipelines/04_monitoring_rules.ipynb` in Databricks and inspect the January 15–28 summary metrics.

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

- Prefer straightforward SQL/PySpark that a learner can explain.
- Use short cells with one clear purpose; Markdown explains purpose, reasoning, and a small example.
- Keep basic count and uniqueness checks in pipeline notebooks; keep synthetic tests and detailed verification in `tests/`.
- Avoid unnecessary abstractions, repeated computation, and checks; do not simplify by hiding large code blocks in helper modules.
- Preserve essential validation, earlier-only history, one row per transaction ID, and alert evidence.
- Distinguish proposed checks from executed checks.

## Next Steps

1. Simplify `pipelines/04_monitoring_rules.ipynb` to follow the updated learning-prototype standards.
2. Run and verify `workspace.sentinel_gold.alerts` in Databricks.

## Verification Limitations

ACE's generated test command has not been configured for Sentinel.
Local checks do not establish that Databricks execution succeeded.
The automated ACE loop is not configured for this project.
