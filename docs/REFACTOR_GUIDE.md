# Sentinel: Simpler Associate-Level PySpark and How to Keep ACE Simple

Date: 2026-11-09

## 1. Why ACE Produced Code That Was Too Complex

The coding standard already said "prefer straightforward PySpark that a learner can explain".
The code still grew complex for five reasons:

| # | Cause | Where it shows |
| --- | --- | --- |
| 1 | **"Simple" was not concrete.** Without an explicit list of preferred Associate-level functions vs. constructs to avoid, the AI satisfied the general rule while using advanced patterns. | `.ace/standards/coding.md` sections 1 and 4 |
| 2 | **Strict requirements turned into clever code.** "Validate that rounding does not change the value" became a second `DECIMAL(38,18)` cast. "Keep all reasons" became `F.array` + `F.filter(lambda)`. "Strictly earlier events" became `rangeBetween(-3600, -1)` on epoch seconds. "Record evidence" became three `F.struct` blocks built with long `F.concat` chains. | `02_silver_transactions`, `historical_features.py`, `04_monitoring_rules` |
| 3 | **Generic skills loaded on common words.** `feature` loaded the ML feature-engineering skill. `state` loaded Redux state-management. `pipeline` loaded generic ETL retry/dead-letter patterns. Databricks projects use these words every day. | `.aceconfig` `skill_triggers` |
| 4 | **`PROJECT_CONTEXT.md` was still a blank template.** Nothing in the persistent project context told ACE the developer's target level or Databricks Associate exam alignment. | `docs/context/PROJECT_CONTEXT.md` |
| 5 | **Duplication from separate test copies and shared modules.** Test notebooks copied the Silver transformation logic, and `historical_features.py` required `sys.path` loops across notebooks. | `tests/`, `pipelines/historical_features.py` |

## 2. What Changed in ACE

| File | Change |
| --- | --- |
| `.ace/standards/pyspark-associate-level.md` (new) | Concrete contract: explain test, allowed Associate-level toolbox, constructs to avoid with simpler replacements, notebook layout (`read → transform → save`), and AI explain-check rules. Line, row, and check counts are treated as preferences for readability rather than rigid limits. |
| `.aceconfig`, `.aiconfig`, `.cursorrules` | Loads `.ace/standards/pyspark-associate-level.md` first. Keywords `pyspark`, `spark`, `notebook`, `databricks` trigger it. Removed noisy triggers (`feature`, `state`, `model`, `agent`, `a2a`, `mcp`, `packet`, `performance`, `accessibility`). RCA required for Medium-or-higher issues. |
| `.ace/standards/coding.md` | Points to `.ace/standards/pyspark-associate-level.md`, documents the simpler amount validation policy, and prohibits hiding complexity in large helper modules or copying pipeline transformation logic into separate test notebooks. |
| `docs/context/PROJECT_CONTEXT.md` | Populated with developer profile, Associate exam alignment, medallion table flow (including `workspace.sentinel_gold.transaction_features` and the existing Lakeflow Job), testing approach, and project decisions. |

### Prompts to Use From Now On

Start of a session:

```text
Read .aceconfig, .ace/roles/roles.md, docs/context/PROJECT_CONTEXT.md and
.ace/standards/pyspark-associate-level.md. Confirm in 3 lines what level of PySpark
you will write.
```

Planning a notebook (Architect, Discuss phase):

```text
Mode PLANNING, Architect role. Plan notebook <name>. Follow section 7 of the
Associate-level standard: at most 5 bullets covering reads/writes, steps, the tools you
will use, anything outside the allowed toolbox, and what you simplified.
Do not write code yet.
```

After code is written (QA Engineer, Verification):

```text
Explain-check: for every cell in <notebook>, give one sentence of explanation.
Flag any construct from section 3 of the Associate-level standard and any cell
I could not explain in two sentences. Rewrite those cells more simply.
```

When a requirement forces complexity:

```text
Requirement X seems to need <advanced construct>. Give me the simplest version that
meets the intent, say what it relaxes, and wait for my decision.
```

## 3. What Changed in the Pipeline Notebooks

Same Silver, quarantine, and Gold alert tables and schemas, same alert IDs, frozen thresholds preserved, fraud labels kept outside monitoring, plus one saved Gold feature table (`workspace.sentinel_gold.transaction_features`).

| Notebook | Before | After |
| --- | --- | --- |
| `02_silver_transactions` | JSON signature with `to_json(struct)`, a second `DECIMAL(38,18)` cast, `F.filter` with `lambda`, separate test notebook copying pipeline logic | `collect_set(struct(*BUSINESS_COLUMNS))` over a `trans_num` window, ordinary numeric text pattern (`rlike`) + `try_cast`, `array_compact`, three small step functions, and an in-notebook 19-row self-test calling `classify_transactions` directly |
| `03_historical_features` | `rangeBetween(-3600, -1)` on epoch seconds, `collect_list` + `F.filter(lambda)`, `sys.path` loop importing `historical_features.py`, display-only | Self-join on earlier payments (`prev_event_time < event_time` and `>= event_time - INTERVAL ...`) with `count(when(...))`, in-notebook self-test, and saves `workspace.sentinel_gold.transaction_features` |
| `04_monitoring_rules` | Recomputed features via `historical_features.py`, `F.filter(F.array(...), lambda)`, `F.transform(lambda)`, long `F.concat` chains | Reads `workspace.sentinel_gold.transaction_features`, `array_compact`, struct field projection (`rule_evidence.rule_id`), `format_string`, in-notebook threshold self-test, and preserves the Jan 15–28 summary cell |
| `tests/00_refactor_equivalence_check` | Separate test notebooks (`02_silver_transactions_tests`, `04_monitoring_rules_tests`) | Compares refactored outputs against `*_legacy` table snapshots; legacy test notebooks and `historical_features.py` are preserved until Databricks verification passes |

### Deliberate Behavior & Policy Changes

1. **Simpler Amount Policy (`invalid_amount`)**:
   - **Rule**: `amt` must match ordinary numeric text with an optional leading minus sign and at most two decimal places (`AMOUNT_PATTERN = r"^-?[0-9]+(\.[0-9]{1,2})?$"`) and succeed under `try_cast(amt AS DECIMAL(18, 2))`.
   - **Merged validation reasons**: The two legacy amount reasons—`unparseable_or_out_of_range_amount` and `amount_precision_changed` (e.g., `"19.999"` or `"-0.004"`)—are merged into a single reason: `invalid_amount`. Non-positive amounts (`<= 0`, including `"-0.004"` after rounding to `0.00`) still record `non_positive_amount`.
   - **Changed acceptance formats**: Unusual numeric strings that `TRY_CAST` previously accepted—such as a leading plus sign (`"+5.00"`), a leading decimal point without a leading digit (`".50"`), or scientific notation (`"1e3"`)—are now rejected with `invalid_amount`. All 71,934 real Bronze records use ordinary numeric text and are unaffected.
2. **Saved Historical Features Table (`workspace.sentinel_gold.transaction_features`)**:
   - Notebook `03_historical_features.ipynb` now writes `workspace.sentinel_gold.transaction_features` in `overwrite` mode, and notebook `04_monitoring_rules.ipynb` reads that table instead of importing `pipelines/historical_features.py`.
3. **In-Notebook Self-Tests Calling Actual Step Functions**:
   - Each pipeline notebook tests its own transformation function (`classify_transactions`, `add_history_features`, `add_rule_matches`) on a concise hand-made fixture before running on real tables.
   - In `02_silver_transactions.ipynb`, the 19-row self-test covers every required field (`missing_transaction_id`, `missing_card_id`, `missing_merchant`, `missing_event_time`, `missing_amount`), malformed/3-decimal/non-positive amounts, bad timestamps, rescued data, numeric row-index ordering (`9` before `10`), `NULL` handling in duplicate checks, multiple validation errors on a single row, and conflicting duplicates where one occurrence has an invalid field.
4. **Self-Join vs. Range Window Trade-Off**:
   - In `03_historical_features.ipynb`, the self-join on `cc_num` with `<` and `>=` timestamp bounds is much easier to read and explain than epoch-second `rangeBetween(-3600, -1)` windows and array lambdas, and runs comfortably on Sentinel's 71,934 transactions across a few hundred cards.

## 4. Safe Verification & Cutover Procedure

Do **not** delete `pipelines/historical_features.py`, `tests/02_silver_transactions_tests.ipynb`, `tests/04_monitoring_rules_tests.ipynb`, or the `*_legacy` snapshot tables, and do **not** modify the live Lakeflow Job until Databricks equivalence verification passes.

1. **Snapshot the current tables in Databricks SQL before running the refactored notebooks**:

   ```sql
   CREATE OR REPLACE TABLE workspace.sentinel_silver.transactions_legacy AS SELECT * FROM workspace.sentinel_silver.transactions;
   CREATE OR REPLACE TABLE workspace.sentinel_silver.quarantine_legacy   AS SELECT * FROM workspace.sentinel_silver.quarantine;
   CREATE OR REPLACE TABLE workspace.sentinel_gold.alerts_legacy         AS SELECT * FROM workspace.sentinel_gold.alerts;
   ```

2. **Push the branch, pull in the Databricks Git folder, and run on Serverless compute in order**:
   - `pipelines/02_silver_transactions.ipynb`
   - `pipelines/03_historical_features.ipynb`
   - `pipelines/04_monitoring_rules.ipynb`
   Each notebook runs its self-test before touching real tables.

3. **Run `tests/00_refactor_equivalence_check.ipynb` and understand what it compares**:
   - **`workspace.sentinel_silver.transactions`**: Full all-column two-way `exceptAll == 0` comparison against `transactions_legacy`.
   - **`workspace.sentinel_gold.alerts`**: Full all-column two-way `exceptAll == 0` comparison against `alerts_legacy`.
   - **`workspace.sentinel_silver.quarantine`**: Compares all non-reason columns (`record_disposition`, `duplicate_status`, `duplicate_rank`, `trans_num`, `cc_num`, `merchant`, `category`, `amount`, `event_time`, `raw_*`, `unix_time`, `_rescued_data`, and lineage columns) via two-way `exceptAll == 0`, and separately displays `validation_reasons` counts side-by-side because `unparseable_or_out_of_range_amount` and `amount_precision_changed` intentionally merge into `invalid_amount`.

4. **Re-run `pipelines/05_rule_evaluation.ipynb`**:
   - Confirm that the frozen-rule holdout evaluation metrics on January 29–February 11 (`24,059` evaluated, `1,423` alerts, `TP = 116`, `FP = 1,307`, `FN = 140`, `TN = 22,496`) remain unchanged.

5. **Update the Existing Lakeflow Job (After Validation Passes)**:
   - Our Lakeflow Job already exists in Databricks (`Bronze → Silver → Monitoring/Gold`).
   - Once steps 2–4 pass, insert task `03_historical_features` (`pipelines/03_historical_features.ipynb`) between `02_silver_transactions` and `04_monitoring_rules` so the task dependency chain is:
     `01_bronze_transactions → 02_silver_transactions → 03_historical_features → 04_monitoring_rules` (`Bronze → Silver → Historical features → Monitoring/Gold`).

6. **Optional Cleanup (Only After Validation Passes)**:
   - Only after equivalence checks and the updated Lakeflow Job succeed should you remove `pipelines/historical_features.py`, `tests/02_silver_transactions_tests.ipynb`, `tests/04_monitoring_rules_tests.ipynb`, and drop the `*_legacy` snapshot tables.

## 5. How to Explain Each Notebook (About 30 Seconds Each)

- **01 Bronze (`01_bronze_transactions.ipynb`)**: "Auto Loader reads new daily Parquet batches from a Unity Catalog volume and appends them to a Delta table. The checkpoint tracks processed files so reruns do not re-ingest the same file, and I reconcile batch counts against the replay manifest."
- **02 Silver (`02_silver_transactions.ipynb`)**: "I trim text, validate required fields, timestamps, and ordinary 2-decimal amounts using `try_cast` and `rlike`, and classify duplicate transaction IDs with window functions (`count` and `collect_set(struct)`). Every Bronze row is routed to `accepted`, `duplicate_identical`, or `quarantined`, and I verify that accepted plus quarantine equals Bronze."
- **03 Historical Features (`03_historical_features.ipynb`)**: "For each Silver transaction, I left-join earlier payments from the same card within 14 days (`prev_event_time < event_time`) so equal-time and future payments cannot leak in. Then `groupBy('trans_num')` with `count(when(...))` computes both the 14-day and 1-hour features and saves `workspace.sentinel_gold.transaction_features`."
- **04 Monitoring Rules (`04_monitoring_rules.ipynb`)**: "I read `transaction_features` and apply three frozen rule thresholds. A transaction matched by multiple rules produces a single alert row containing all matched rule evidence structs. `alert_id` is a deterministic SHA-256 hash of `ruleset_version | trans_num` that stably identifies the alert across reruns, while full-snapshot `overwrite` mode and uniqueness checks on `trans_num` and `alert_id` prevent duplicate output rows."
- **05 Rule Evaluation (`05_rule_evaluation.ipynb`)**: "I join Gold alerts against the separate fraud labels for the January 29–February 11 evaluation period only—keeping labels completely outside Bronze, Silver, features, and Gold alerts—and report TP, FP, FN, TN, precision, and recall."

## 6. Mapping to the Databricks Data Engineer Associate Exam

| Sentinel Component | Associate Exam Topic |
| --- | --- |
| Bronze: Auto Loader (`cloudFiles`), checkpoint, Unity Catalog Volume | Incremental data processing, Auto Loader |
| Bronze → Silver → Gold (`transaction_features`, `alerts`) | Medallion architecture |
| Silver: `try_cast`, `when`, `rlike`, `array_compact`, window functions, quarantine | Transformations with Spark SQL and PySpark, data quality |
| Features: left self-join, `groupBy().agg()`, conditional `count(when(...))` | Joins and aggregations |
| Delta writes: `append`, `overwrite`, `saveAsTable` | Delta Lake, table management |
| Unity Catalog catalog, schemas, tables, and volumes | Data governance |
| Existing Lakeflow Job (`01_bronze → 02_silver → 03_features → 04_rules`) | Production pipelines and task orchestration |
