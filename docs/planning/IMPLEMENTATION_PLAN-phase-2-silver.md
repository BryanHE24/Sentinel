# Phase 2 — Silver Implementation Plan

## Objective

Produce trusted transactions and quarantine records from released
Bronze data, with every input row accounted for exactly once.

## Confirmed Bronze Inspection Findings

- Bronze (`workspace.sentinel_bronze.transactions`) contains 2,414 transactions for `2019-01-01`.
- Source business fields are `STRING`.
- `replay_batch` is `DATE` and `_ingestion_timestamp` is `TIMESTAMP`.
- All 2,414 `amt` values convert to `DECIMAL(18,2)` with 0 unparseable/out-of-range rows and 0 values changed at two decimal places.
- `is_fraud` is absent from Bronze.
- `_rescued_data` exists in the Bronze schema; its contents in Bronze have not yet been inspected.

## Architecture & Transformation Decisions

1. **Normalize Blank Identifiers**: Normalize blank or whitespace-only required identifiers (`trans_num`, `cc_num`, `merchant`) to `NULL` via `NULLIF(TRIM(...), '')`.
2. **Parse Event Time**: Parse `trans_date_trans_time` as `TIMESTAMP_NTZ` (`event_time`) using `TRY_CAST`, preserving written clock time without assuming a source timezone. Distinguish missing strings from unparseable timestamps.
3. **Validate Monetary Amounts**: Convert `amt` to `DECIMAL(18,2)` (`amount`) alongside `DECIMAL(38,18)` (`_wide_amount`), explicitly detecting missing values, unparseable/out-of-range strings, non-positive values (`<= 0`), and precision-changing values (`_wide_amount != amount`).
4. **Preserve Traceability and Raw Values**: Retain source lineage (`source_file`, `source_row_index`, `replay_batch`, `_ingested_file_path`, `_ingestion_timestamp`, `_rescued_data`) and raw input strings (`raw_trans_num`, `raw_cc_num`, `raw_merchant`, `raw_amt`, `raw_trans_date_trans_time`, `unix_time`) needed to investigate rejected or duplicate records.
5. **Inspect Rescued Data Before Classification**: Inspect non-null `_rescued_data` row counts and JSON keys in Bronze before deciding whether populated `_rescued_data` should add a validation failure reason.
6. **Whole-Input Duplicate Classification**:
   - Evaluate `trans_num` multiplicity across the entire Bronze input (`workspace.sentinel_bronze.transactions`), not just within a single batch.
   - Compare a canonical signature of all business columns across every row sharing a non-null `trans_num`—including rows that fail field validation—so invalid rows cannot hide conflicting records.
   - Distinguish **identical duplicates** (all occurrences share identical business values) from **conflicting duplicates** (occurrences share `trans_num` but differ in one or more business values).
   - Never arbitrarily pick a winner among conflicting duplicates: mark all rows of a conflicting `trans_num` with `conflicting_duplicate_transaction_id` and route all of them to quarantine.
   - For valid identical duplicates, retain one deterministic copy as `accepted` (ordered by `_ingestion_timestamp`, `_ingested_file_path`, `source_row_index`) and classify the remaining copies as `duplicate_identical` with reason `duplicate_identical_transaction_id`.
7. **Exact Row Accounting**: Assign every Bronze input row to exactly one mutually exclusive disposition (`accepted`, `quarantined`, or `duplicate_identical`) and verify that disposition counts sum to the exact Bronze input count and that accepted `trans_num` values are strictly unique.

## Steps

1. Inspect Bronze schema and amount precision (Verified in Databricks for `2019-01-01`).
2. Inspect Bronze `_rescued_data` contents.
3. Normalize required fields, convert types (`TIMESTAMP_NTZ`, `DECIMAL(18,2)`), and preserve raw values and lineage references.
4. Assign explicit field-level validation reasons.
5. Classify duplicate transaction IDs across the full Bronze table (identical vs. conflicting) without arbitrary winner selection.
6. Produce row-level dispositions and a reconciliation summary accounting for every input row exactly once.
7. Persist Silver accepted and quarantine tables and verify rerun behavior (Deferred until current step is verified in Databricks).
8. Test invalid inputs and duplicate scenarios with controlled fixtures (Pending).

## Constraints

- Read only ingested Bronze transactions (`workspace.sentinel_bronze.transactions`).
- Exclude evaluation labels (`is_fraud`).
- Preserve source references and raw values for investigation.
- Use the written transaction timestamp as `TIMESTAMP_NTZ`.
- Do not silently round amounts, drop invalid records, or arbitrarily resolve conflicting duplicate IDs.
- Do not write Silver or quarantine tables until typing, validation, and duplicate classification outputs are inspected in Databricks.

## Status

- Step 1 (Bronze schema and amount precision inspection): Verified in Databricks (2,414 rows for `2019-01-01`).
- Steps 2–6 (Rescued data inspection, typing, validation reasons, duplicate classification, and row reconciliation): Implemented in `pipelines/02_silver_transactions.ipynb`; pending Databricks execution and verification.
- Steps 7–8 (Table persistence and fixture tests): Pending.
