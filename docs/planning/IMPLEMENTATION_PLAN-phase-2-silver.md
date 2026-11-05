# Phase 2 — Silver Implementation Plan

## Objective

Produce trusted transactions and quarantine records from released
Bronze data, with every input row accounted for exactly once.

## Confirmed Databricks Results (`2019-01-01` Batch & Synthetic Suite v1)

- **Bronze Schema & Amount Precision**:
  - Bronze (`workspace.sentinel_bronze.transactions`) contains 2,414 transactions for `2019-01-01`.
  - Source business fields are `STRING`.
  - `replay_batch` is `DATE` and `_ingestion_timestamp` is `TIMESTAMP`.
  - All 2,414 `amt` values convert to `DECIMAL(18,2)` with 0 unparseable/out-of-range rows and 0 values changed at two decimal places.
  - `is_fraud` is absent from Bronze.
- **Bronze Rescued Data Inspection (`2019-01-01` Batch)**:
  - Input rows: `2,414`
  - Non-null `_rescued_data` rows: `0`
  - Non-blank `_rescued_data` rows: `0`
- **Silver Classification & Reconciliation (`2019-01-01` Batch)**:
  - Bronze input: `2,414`
  - Accepted: `2,414`
  - Quarantined: `0`
  - Identical duplicate extras: `0`
  - Distinct accepted IDs: `2,414`
  - Disposition summary: all `accepted` / `unique_id`
  - Validation-reason summary: no rows
- **Synthetic Verification Suite (23-Row Baseline)**:
  - Confirmed in Databricks that all 23 synthetic rows matched the documented classifications (including rows 22 and 23 accepting populated and malformed `_rescued_data` prior to the rescued-data quarantine rule).

## Architecture & Transformation Decisions

1. **Normalize Blank Identifiers**: Normalize blank or whitespace-only required identifiers (`trans_num`, `cc_num`, `merchant`) to `NULL` via `NULLIF(TRIM(...), '')`.
2. **Parse Event Time**: Parse `trans_date_trans_time` as `TIMESTAMP_NTZ` (`event_time`) using `TRY_CAST`, preserving written clock time without assuming a source timezone. Distinguish missing strings from unparseable timestamps.
3. **Validate Monetary Amounts**: Convert `amt` to `DECIMAL(18,2)` (`amount`) alongside `DECIMAL(38,18)` (`_wide_amount`), explicitly detecting missing values, unparseable/out-of-range strings, non-positive values (`<= 0`), and precision-changing values (`_wide_amount != amount`).
4. **Preserve Traceability and Raw Values**: Retain source lineage (`source_file`, `source_row_index`, `replay_batch`, `_ingested_file_path`, `_ingestion_timestamp`, `_rescued_data`) and raw input strings (`raw_trans_num`, `raw_cc_num`, `raw_merchant`, `raw_amt`, `raw_trans_date_trans_time`, `unix_time`) needed to investigate rejected or duplicate records.
5. **Quarantine Non-Blank Rescued Data**:
   - The known original CSV index (`_c0`) was already extracted into `source_row_index` during replay preparation before Parquet ingestion, and Bronze inspection confirmed 0 non-null/non-blank `_rescued_data` rows for `2019-01-01`.
   - For this replay feed, any non-blank `_rescued_data` (`_rescued_data IS NOT NULL AND TRIM(_rescued_data) != ''`)—whether valid JSON or malformed text—must append `unexpected_rescued_data` to `validation_reasons` (preserving all other applicable reasons) and quarantine the row.
   - Preserve the raw `_rescued_data` payload on the record for investigation.
   - `NULL` and whitespace-only `_rescued_data` do not trigger `unexpected_rescued_data`.
6. **Whole-Input Duplicate Classification**:
   - Evaluate `trans_num` multiplicity across the entire Bronze input (`workspace.sentinel_bronze.transactions`), not just within a single batch.
   - Compare a canonical signature of all business columns across every row sharing a non-null `trans_num`—including rows that fail field validation—so invalid rows cannot hide conflicting records.
   - Distinguish **identical duplicates** (all occurrences share identical business values) from **conflicting duplicates** (occurrences share `trans_num` but differ in one or more business values).
   - Never arbitrarily pick a winner among conflicting duplicates: mark all rows of a conflicting `trans_num` with `conflicting_duplicate_transaction_id` and route all of them to quarantine.
   - For valid identical duplicates, retain one deterministic copy as `accepted` (ordered by `_ingestion_timestamp`, `_ingested_file_path`, `source_row_index`) and classify the remaining copies as `duplicate_identical` with reason `duplicate_identical_transaction_id`.
7. **Exact Row Accounting**: Assign every Bronze input row to exactly one mutually exclusive disposition (`accepted`, `quarantined`, or `duplicate_identical`) and verify that disposition counts sum to the exact Bronze input count and that accepted `trans_num` values are strictly unique.

## Steps

1. Inspect Bronze schema and amount precision (Verified in Databricks for `2019-01-01`).
2. Inspect Bronze `_rescued_data` contents (Verified in Databricks for `2019-01-01`: 0 non-null, 0 non-blank rows).
3. Normalize required fields, convert types (`TIMESTAMP_NTZ`, `DECIMAL(18,2)`), and preserve raw values and lineage references (Verified on `2019-01-01` batch).
4. Assign explicit field-level validation reasons, including `unexpected_rescued_data` for non-blank `_rescued_data` (Updated locally in `pipelines/02_silver_transactions.ipynb`; pending Databricks execution of the `unexpected_rescued_data` rule).
5. Classify duplicate transaction IDs across the full Bronze table without arbitrary winner selection (Verified on `2019-01-01` batch and 23-row synthetic baseline).
6. Produce row-level dispositions and a reconciliation summary accounting for every input row exactly once (Verified on `2019-01-01` batch: 2,414 accepted, 0 quarantined, 0 duplicate extras).
7. Test invalid inputs, duplicate scenarios, missing IDs, and rescued-data quarantine/acceptance behavior using the 24-row synthetic fixture exercising the reusable transformation functions (Updated locally in `pipelines/02_silver_transactions.ipynb`; pending Databricks execution).
8. Persist Silver accepted and quarantine tables and verify rerun behavior (Deferred until 24-row synthetic fixture execution is confirmed in Databricks).

## Constraints

- Read only ingested Bronze transactions (`workspace.sentinel_bronze.transactions`).
- Exclude evaluation labels (`is_fraud`).
- Preserve source references and raw values (including `_rescued_data`) for investigation.
- Use the written transaction timestamp as `TIMESTAMP_NTZ`.
- Do not silently round amounts, drop invalid records, or arbitrarily resolve conflicting duplicate IDs.
- Keep synthetic test fixtures in memory and separate from production tables.
- Do not write Silver or quarantine tables until the updated `unexpected_rescued_data` validation and 24-row synthetic tests are confirmed in Databricks.

## Status

- Steps 1–3, 5–6: Executed and confirmed in Databricks for the `2019-01-01` Bronze batch (2,414 rows) and the initial 23-row synthetic suite.
- Steps 4 & 7 (`unexpected_rescued_data` validation rule and 24-row synthetic fixture verification): Implemented and reviewed locally in `pipelines/02_silver_transactions.ipynb`; pending Databricks execution.
- Step 8 (Table persistence): Pending.
