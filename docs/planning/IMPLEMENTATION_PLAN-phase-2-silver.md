# Phase 2 — Silver Implementation Plan

## Objective

Produce trusted transactions and quarantine records from released
Bronze data, with every input row accounted for exactly once, and persist
curated Silver and quarantine Delta tables with verified schemas, counts,
and content equality.

## Confirmed Databricks Results (`2019-01-01` Batch & 24-Row Synthetic Suite)

- **Bronze Schema, Amount Precision & Rescued Data (`2019-01-01` Batch)**:
  - Bronze (`workspace.sentinel_bronze.transactions`) contains `2,414` transactions for `2019-01-01`.
  - Source business fields are `STRING`; `replay_batch` is `DATE`; `_ingestion_timestamp` is `TIMESTAMP`.
  - All `2,414` `amt` values convert to `DECIMAL(18,2)` with `0` unparseable/out-of-range rows and `0` values changed at two decimal places.
  - `is_fraud` is absent from Bronze.
  - Non-null `_rescued_data` rows: `0`; non-blank `_rescued_data` rows: `0`.
- **Silver Classification & Reconciliation (`2019-01-01` Batch)**:
  - Bronze input: `2,414`
  - Accepted: `2,414`
  - Quarantined: `0`
  - Identical duplicate extras: `0`
  - Distinct accepted IDs: `2,414`
  - Disposition summary: all `accepted` / `unique_id`
  - Validation-reason summary: `0` rows
- **Synthetic Verification Suite (24-Row Suite)**:
  - Confirmed in Databricks that all `24` synthetic fixture rows passed classification and reconciliation checks (`4` accepted, `19` quarantined, `1` identical duplicate extra, `4` distinct accepted IDs, `2` non-blank `_rescued_data` rows quarantined with `unexpected_rescued_data`, and `1` whitespace-only `_rescued_data` row accepted).

## Architecture & Transformation Decisions

1. **Normalize Blank Identifiers**: Normalize blank or whitespace-only required identifiers (`trans_num`, `cc_num`, `merchant`) to `NULL` via `NULLIF(TRIM(...), '')`.
2. **Parse Event Time**: Parse `trans_date_trans_time` as `TIMESTAMP_NTZ` (`event_time`) using `TRY_CAST`, preserving written clock time without assuming a source timezone. Distinguish missing strings from unparseable timestamps.
3. **Validate Monetary Amounts**: Convert `amt` to `DECIMAL(18,2)` (`amount`) using `try_cast` and `AMOUNT_PATTERN = r"^-?[0-9]+(\.[0-9]{1,2})?$"`, explicitly detecting missing values (`missing_amount`), malformed/out-of-range or `>2`-decimal values (`invalid_amount`), and non-positive values (`<= 0`, `non_positive_amount`).
4. **Preserve Traceability and Raw Values**: Retain source lineage (`source_file`, `source_row_index`, `replay_batch`, `_ingested_file_path`, `_ingestion_timestamp`, `_rescued_data`) and raw input strings (`raw_trans_num`, `raw_cc_num`, `raw_merchant`, `raw_amt`, `raw_trans_date_trans_time`, `unix_time`) needed to investigate rejected or duplicate records.
5. **Quarantine Non-Blank Rescued Data**: Quarantine any record with non-blank `_rescued_data` (`_rescued_data IS NOT NULL AND TRIM(_rescued_data) != ''`) using validation reason `unexpected_rescued_data`, preserving `_rescued_data` for investigation. `NULL` and whitespace-only `_rescued_data` do not trigger this reason.
6. **Whole-Input Duplicate Classification**:
   - Evaluate `trans_num` multiplicity across the entire Bronze input (`workspace.sentinel_bronze.transactions`).
   - Compare a canonical signature of all business columns across every row sharing a non-null `trans_num`—including rows that fail field validation—so invalid rows cannot hide conflicting records.
   - Distinguish **identical duplicates** from **conflicting duplicates**.
   - Never arbitrarily pick a winner among conflicting duplicates: mark all rows of a conflicting `trans_num` with `conflicting_duplicate_transaction_id` and route all of them to quarantine.
   - For valid identical duplicates, retain one deterministic copy as `accepted` and classify extra copies as `duplicate_identical` with reason `duplicate_identical_transaction_id`.
7. **Exact Row Accounting**: Assign every Bronze input row to exactly one mutually exclusive disposition (`accepted`, `quarantined`, or `duplicate_identical`) and verify reconciliation before writing.

## Persistence Decisions

1. **Target Tables**:
   - Schema: `workspace.sentinel_silver`
   - Accepted transactions table: `workspace.sentinel_silver.transactions`
     - Rows: `record_disposition == "accepted"`
     - Explicit column list (`ACCEPTED_SILVER_COLUMNS`):
       `trans_num`, `cc_num`, `merchant`, `category`, `amount`, `event_time`, `replay_batch`, `source_file`, `source_row_index`, `_ingested_file_path`, `_ingestion_timestamp`.
     - Excludes unnecessary personal cardholder attributes (`first`, `last`, `gender`, `street`, `city`, `state`, `zip`, `lat`, `long`, `city_pop`, `job`, `dob`), unused merchant coordinates (`merch_lat`, `merch_long`), unverified `unix_time`, and raw string columns.
   - Quarantine table: `workspace.sentinel_silver.quarantine`
     - Rows: `record_disposition != "accepted"` (includes both `quarantined` and `duplicate_identical` records so every non-accepted input row is persisted and auditable).
     - Explicit column list (`QUARANTINE_SILVER_COLUMNS`):
       `record_disposition`, `duplicate_status`, `duplicate_rank`, `validation_reasons`, `trans_num`, `cc_num`, `merchant`, `category`, `amount`, `event_time`, `raw_trans_num`, `raw_cc_num`, `raw_merchant`, `raw_amt`, `raw_trans_date_trans_time`, `unix_time`, `_rescued_data`, `replay_batch`, `source_file`, `source_row_index`, `_ingested_file_path`, `_ingestion_timestamp`.
2. **Full-Snapshot Recomputation (`overwrite` Mode)**:
   - Rebuild both `workspace.sentinel_silver.transactions` and `workspace.sentinel_silver.quarantine` from the complete current `workspace.sentinel_bronze.transactions` snapshot using `.mode("overwrite").option("overwriteSchema", "true")`.
   - This is a full recomputation rather than incremental Silver processing, ensuring that if a later batch introduces a conflicting duplicate `trans_num`, reclassifying the complete Bronze input removes the previously accepted record from `workspace.sentinel_silver.transactions` and routes all occurrences to `workspace.sentinel_silver.quarantine`.
3. **Isolation from Synthetic Fixtures**:
   - Persistence reads `workspace.sentinel_bronze.transactions` explicitly into dedicated Bronze persistence variables (`bronze_for_persistence`, `bronze_classified_for_persistence`), asserts no synthetic fixture rows are present, and validates reconciliation and accepted-key uniqueness before writing.
4. **Separate Table Transactions & Failure Handling**:
   - Writing `workspace.sentinel_silver.transactions` and `workspace.sentinel_silver.quarantine` are two separate Delta Lake transactions.
   - If a run fails or is interrupted after the first write, the two tables may reflect different executions. An incomplete or failed run must never be recorded as successful; recovery requires re-executing the persistence and post-write verification cells to completion.
5. **Post-Write Read-Back & Multiplicity-Preserving Verification**:
   - Read both persisted tables back via `spark.table(...)`.
   - Verify preserved schemas (including when `workspace.sentinel_silver.quarantine` has `0` rows), row counts (`saved_accepted + saved_quarantine == bronze_input`), accepted `trans_num` uniqueness, and multiplicity-preserving content equality (`exceptAll` in both directions) against the expected DataFrames.

## Steps

1. Inspect Bronze schema and amount precision (Verified in Databricks for `2019-01-01`).
2. Inspect Bronze `_rescued_data` contents (Verified in Databricks for `2019-01-01`: `0` non-null, `0` non-blank rows).
3. Normalize required fields, convert types (`TIMESTAMP_NTZ`, `DECIMAL(18,2)`), and preserve raw values and lineage references (Verified in Databricks).
4. Assign explicit field-level validation reasons, including `unexpected_rescued_data` (Verified in Databricks on 24-row synthetic suite).
5. Classify duplicate transaction IDs across the full Bronze table without arbitrary winner selection (Verified in Databricks).
6. Produce row-level dispositions and a reconciliation summary accounting for every input row exactly once (Verified in Databricks).
7. Test invalid inputs, duplicate scenarios, missing IDs, and rescued-data handling using the 24-row synthetic fixture (Verified in Databricks).
8. Persist `workspace.sentinel_silver.transactions` and `workspace.sentinel_silver.quarantine` in full-recomputation overwrite mode, read both tables back, and verify schemas, counts, key uniqueness, content equality (`exceptAll`), and rerun idempotency (Executed and confirmed in Databricks across all 42 batches).
9. Compute point-in-time historical features from `workspace.sentinel_silver.transactions` in `pipelines/03_historical_features.ipynb` and persist `workspace.sentinel_gold.transaction_features` (`overwrite` mode, 1 row per `trans_num`):
   - `card_txn_count_1h`: earlier payment count for the same `cc_num` in `[event_time - 1 hour, event_time)`.
   - `card_txn_count_14d`: earlier payment count for the same `cc_num` in `[event_time - 14 days, event_time)`.
   - `card_avg_amount_14d`: earlier average `amount` (`DECIMAL(18,2)`) for the same `cc_num` in `[event_time - 14 days, event_time)`, or `NULL` when `card_txn_count_14d == 0`.
   - `card_merchant_txn_count_1h`: earlier payment count for the same `(cc_num, merchant)` in `[event_time - 1 hour, event_time)`.
   - `card_merchant_similar_amount_count_1h`: earlier payment count for the same `(cc_num, merchant)` in `[event_time - 1 hour, event_time)` within `±10%` of the current `amount`.
   - Verify 1:1 `trans_num` grain, lower-boundary inclusion, equal-timestamp exclusion, no-history `NULL` average, and future-event exclusion via synthetic tests (Executed and confirmed in Databricks).
10. Evaluate three versioned frozen monitoring rules (`ruleset-v1.0-frozen`) in `pipelines/04_monitoring_rules.ipynb` reading `workspace.sentinel_gold.transaction_features`:
   - `RULE_01_CARD_VELOCITY_1H` (`v1.0-frozen`): `card_txn_count_1h >= 3`.
   - `RULE_02_UNUSUAL_AMOUNT_14D` (`v1.0-frozen`): `card_txn_count_14d >= 5` and `amount >= 3.00 * card_avg_amount_14d`.
   - `RULE_03_REPEATED_SIMILAR_MERCHANT_1H` (`v1.0-frozen`): `card_merchant_similar_amount_count_1h >= 2` (within `±10%` of current `amount`; merchant count alone does not establish similar amounts).
   - Preserve 1 row per `trans_num`, record matched rule IDs/versions and structured supporting evidence, verify real feature counts and unique IDs, and test matches, non-matches, exact boundaries, and insufficient history.
11. Persist flagged monitoring alerts to `workspace.sentinel_gold.alerts` in `pipelines/04_monitoring_rules.ipynb` using full-snapshot `overwrite` mode:
   - Keep one row per flagged transaction (`trans_num`) with a deterministic `alert_id` (`SHA-256(ruleset_version || '|' || trans_num)`), transaction details, matching rule IDs/versions, and structured `rule_evidence`.
   - Never persist synthetic test records; exclude fraud labels and analyst workflow fields.
   - Read back `workspace.sentinel_gold.alerts`, verify row count (`21` on Jan 1; `2,719` across Jan 1–28; `4,142` across all 42 batches), unique `alert_id` and `trans_num`, and retained evidence.

## Constraints

- Read only ingested Bronze transactions (`workspace.sentinel_bronze.transactions`) for Silver curation and `workspace.sentinel_silver.transactions` for historical features.
- Exclude evaluation labels (`is_fraud`) and unnecessary personal attributes from accepted Silver and Gold.
- Never persist synthetic fixtures into Silver, quarantine, or Gold tables.
- Preserve source references and raw values in quarantine for investigation.
- Use the written transaction timestamp as `TIMESTAMP_NTZ`.
- Do not silently round amounts, drop invalid records, or arbitrarily resolve conflicting duplicate IDs.
- Do not claim persistence or rerun checks passed until executed and inspected in Databricks.

## Status

- Steps 1–11: Executed and confirmed in Databricks across all 42 batches (`71,934` accepted Silver transactions, `0` quarantined rows, `4,142` total Gold alerts across Jan 1–Feb 11, and holdout evaluation verified in `pipelines/05_rule_evaluation.ipynb`).
- Refactored to Associate-level PySpark (`docs/REFACTOR_GUIDE.md`), verified via two-way `exceptAll == 0` equivalence (`tests/00_refactor_equivalence_check.ipynb`), and executed end-to-end via the 4-task Databricks Lakeflow Job (`01_bronze_transactions → 02_silver_transactions → 03_historical_features → 04_monitoring_rules`).
