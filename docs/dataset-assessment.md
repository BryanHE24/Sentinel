# Dataset Assessment & Replay Scope

## 1. Source Dataset

- **Dataset**: Credit Card Transactions Fraud Detection Dataset
- **Publisher**: `kartik2112` on Kaggle
- **URL**: https://www.kaggle.com/datasets/kartik2112/fraud-detection
- **License displayed on source page**: CC0: Public Domain
- **Original files**: `fraudTrain.csv` and `fraudTest.csv`
- **Databricks location**: `/Volumes/workspace/sentinel_sources/originals/` (created via [`resources/01_source_storage.sql`](../resources/01_source_storage.sql))
- **Assessment notebook**: [`explorations/01_source_assesment.ipynb`](../explorations/01_source_assesment.ipynb)

---

## 2. Confirmed Source Profiling Results

All source CSV columns were profiled as strings (`inferColumnTypes => false`) so card identifiers (`cc_num`) and monetary strings (`amt`) were inspected without silent type coercion:

| File | Total Rows | Rows with `_rescued_data` | Rescued Keys Present | Earliest `event_time` (`TIMESTAMP_NTZ`) | Latest `event_time` (`TIMESTAMP_NTZ`) |
| --- | --- | --- | --- | --- | --- |
| `fraudTrain.csv` | `1,296,675` | `1,296,675` | `["_c0", "_file_path"]` | `2019-01-01 00:00:18` | `2020-06-21 12:13:37` |
| `fraudTest.csv` | `555,719` | `555,719` | `["_c0", "_file_path"]` | `2020-06-21 12:14:25` | `2020-12-31 23:59:34` |
| **Combined Total** | **`1,852,394`** | **`1,852,394`** | `["_c0", "_file_path"]` | `2019-01-01 00:00:18` | `2020-12-31 23:59:34` |

### Key Data Quality & Schema Findings
- **Transaction Key (`trans_num`)**: Present and unique across all `1,852,394` rows (`0` missing, `0` duplicate IDs in raw CSVs).
- **Required Monitoring Fields**: `cc_num`, `merchant`, `amt`, and `trans_date_trans_time` have `0` missing or blank values across both files.
- **Monetary Amounts (`amt`)**: All `1,852,394` rows convert cleanly to `DECIMAL(18, 2)` and are strictly positive (`> 0`).
- **Rescued Data (`_rescued_data`)**: Every CSV row contains an unnamed leading index column captured by Spark as `_rescued_data._c0` (alongside `_file_path`). During replay preparation ([`scripts/02_prepare_replay.ipynb`](../scripts/02_prepare_replay.ipynb)), `$._c0` is extracted into `source_row_index` for row-level lineage before `_rescued_data` is dropped.
- **Event Time vs. `unix_time` Discrepancy**:
  - `trans_date_trans_time` parses cleanly as `TIMESTAMP_NTZ` (`0` unparseable rows). Its source timezone is unspecified, so timestamps are never labeled as `UTC`.
  - `unix_time` differs from `TIMESTAMP_NTZ` seconds since `1970-01-01 00:00:00` by two unexplained offsets: `220,838,400` seconds (`924,311` training rows) and `220,924,800` seconds (`372,364` training rows and all `555,719` test rows).
  - **Decision**: Use `trans_date_trans_time` (`TIMESTAMP_NTZ`) for all event ordering and lookback windows; preserve `unix_time` in Bronze and Silver quarantine only.

---

## 3. Selected 42-Day Replay Scope (`71,934` Transactions)

Prepared in [`scripts/02_prepare_replay.ipynb`](../scripts/02_prepare_replay.ipynb) from `fraudTrain.csv` for `event_time >= TIMESTAMP_NTZ '2019-01-01 00:00:00'` and `event_time < TIMESTAMP_NTZ '2019-02-12 00:00:00'`:

| Replay Period | Date Range (`replay_batch`) | Daily Batches | Transactions | Role in Sentinel |
| --- | --- | --- | --- | --- |
| **`initial_history`** | `2019-01-01` – `2019-01-14` | `14` | `24,144` | Builds the 14-day card baseline required by `RULE_02_UNUSUAL_AMOUNT_14D`. |
| **`rule_development`** | `2019-01-15` – `2019-01-28` | `14` | `23,731` | Used to inspect unlabeled rule behavior and freeze `ruleset-v1.0-frozen`. |
| **`evaluation`** | `2019-01-29` – `2019-02-11` | `14` | `24,059` | Holdout evaluation period kept unreleased until rules are frozen. |
| **Total Replay Scope** | **`2019-01-01` – `2019-02-11`** | **`42`** | **`71,934`** | Partitioned into 42 daily Parquet folders + 42-row manifest. |

- **Fraud Label Separation**: `is_fraud` is removed from operational transaction batches in [`scripts/02_prepare_replay.ipynb`](../scripts/02_prepare_replay.ipynb) and written separately to `/Volumes/workspace/sentinel_evaluation/evaluation_labels/replay_v1` (`71,934` rows) for holdout evaluation in [`pipelines/05_rule_evaluation.ipynb`](../pipelines/05_rule_evaluation.ipynb).
