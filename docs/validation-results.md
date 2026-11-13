# Sentinel Verification Results & Demo Guide

- **Last Updated**: 2026-11-13
- **Branch**: `feat/phase-3-investigation-ui`

---

## 1. Phase 1 & Phase 2 — Medallion Pipeline Verification (Confirmed in Databricks)

### A. Replay Preparation, Release & Bronze Ingestion
- **Replay Staging & Manifest ([`scripts/02_prepare_replay.ipynb`](../scripts/02_prepare_replay.ipynb))**:
  - Verified `71,934` staged replay transactions across `42` daily Parquet folders (`2019-01-01` through `2019-02-11`).
  - Verified `71,934` separated fraud-label records in `/Volumes/workspace/sentinel_evaluation/evaluation_labels/replay_v1` with `100%` unique `trans_num`.
  - Confirmed `is_fraud` is absent from operational transaction files and all `42` daily batch counts match the manifest (`0` full-join mismatches).
- **Controlled Release & Auto Loader Bronze Ingestion ([`scripts/03_release_replay.ipynb`](../scripts/03_release_replay.ipynb), [`pipelines/01_bronze_transactions.ipynb`](../pipelines/01_bronze_transactions.ipynb))**:
  - Confirmed initial single-day ingestion (`2019-01-01`: `2,414` rows, `2,414` unique `trans_num`), pre-evaluation ingestion (`28` batches, `2019-01-01`–`2019-01-28`: `47,875` rows), and complete 42-day ingestion (`42` batches, `2019-01-01`–`2019-02-11`: `71,934` rows).
  - Reran `01_bronze_transactions.ipynb` against the same Auto Loader checkpoint (`.../ingestion_state/transactions_v1/checkpoint`); confirmed `0` duplicate rows were added.

### B. Silver Validation, Quarantine & Duplicate Classification ([`pipelines/02_silver_transactions.ipynb`](../pipelines/02_silver_transactions.ipynb))
- **Real Bronze Data Reconciliation**:
  - Every ingested batch reconciled with `accepted + quarantine == Bronze` (`2,414` accepted / `0` quarantined on Jan 1; `47,875` accepted / `0` quarantined across Jan 1–28; `71,934` accepted / `0` quarantined across all 42 days).
  - Confirmed `0` null or duplicate `trans_num` values in `workspace.sentinel_silver.transactions`, and confirmed personal cardholder columns and `is_fraud` are excluded.
- **Synthetic Verification Fixtures**:
  - **19-Row In-Notebook Self-Test**: Passed `19/19` expected dispositions and `validation_reasons` (`missing_transaction_id`, `missing_card_id`, `missing_merchant`, `missing_event_time`, `unparseable_event_time`, `missing_amount`, `invalid_amount` for non-numeric and `>2`-decimal strings, `non_positive_amount`, `unexpected_rescued_data`, `duplicate_identical_transaction_id` with numeric `source_row_index` ordering `9` before `10`, and `conflicting_duplicate_transaction_id` even when one copy has an invalid field).
  - **24-Row Legacy Suite ([`tests/02_silver_transactions_tests.ipynb`](../tests/02_silver_transactions_tests.ipynb))**: Confirmed in Databricks (`4` accepted, `19` quarantined, `1` identical duplicate extra).

### C. Historical Features & Monitoring Rules ([`pipelines/03_historical_features.ipynb`](../pipelines/03_historical_features.ipynb), [`pipelines/04_monitoring_rules.ipynb`](../pipelines/04_monitoring_rules.ipynb))
- **Point-in-Time Historical Features (`workspace.sentinel_gold.transaction_features`)**:
  - Verified in-notebook self-test on exact window boundaries (`-14d` and `-1h` included; `-14d - 1s` and `-1h - 1s` excluded), equal-timestamp exclusion (`prev_event_time < event_time`), `NULL` 14-day average when `card_txn_count_14d == 0`, `±10%` similar-amount bounds, and zero future leakage (`exceptAll == 0` when future rows are appended).
  - Persisted `1:1` feature rows matching `workspace.sentinel_silver.transactions` (`71,934` rows across all 42 batches).
- **Monitoring Rules (`workspace.sentinel_gold.alerts`, `ruleset-v1.0-frozen`)**:
  - Verified in-notebook threshold boundary self-test (just below, at, and above thresholds for all 3 rules plus multi-rule matching).
  - **Complete-Replay vs. Period-Specific Alert Counts**:
    - **Jan 1 (`1` batch)**: `2,414` transactions → `21` alerts (`1` Rule 1 velocity, `20` Rule 2 unusual amount, `0` Rule 3 similar merchant).
    - **Jan 1–28 (`28` batches, pre-evaluation total)**: `47,875` transactions → **`2,719` saved alerts**.
    - **Jan 15–28 (`14` batches, `rule_development` window)**: `23,731` transactions → **`1,376` flagged alerts (`5.8%`)** (`25` Rule 1, `1,356` Rule 2, `0` Rule 3, `5` multi-rule alerts).
    - **Jan 1–Feb 11 (`42` batches, complete replay total)**: `71,934` transactions → **`4,142` saved alerts** (`2,719` Jan 1–28 + `1,423` Jan 29–Feb 11).

### D. Holdout Evaluation Metrics ([`pipelines/05_rule_evaluation.ipynb`](../pipelines/05_rule_evaluation.ipynb))
Evaluated on the `14`-day holdout period (`2019-01-29` through `2019-02-11`) by joining `workspace.sentinel_gold.alerts` with `/Volumes/workspace/sentinel_evaluation/evaluation_labels/replay_v1`:

| Metric | Confirmed Value |
| --- | --- |
| **Evaluated Holdout Transactions** | `24,059` |
| **Flagged Holdout Alerts (`ruleset-v1.0-frozen`)** | `1,423` |
| **Actual Fraud Transactions (`is_fraud = 1`)** | `256` |
| **True Positives (`TP`)** | `116` |
| **False Positives (`FP`)** | `1,307` |
| **False Negatives (`FN`)** | `140` |
| **True Negatives (`TN`)** | `22,496` (`TP + FP + FN + TN = 24,059`) |
| **Precision (`TP / (TP + FP)`)** | **`8.15%` (`0.0815`)** |
| **Recall (`TP / (TP + FN)`)** | **`45.31%` (`0.4531`)** |

### E. Associate-Level Refactor & 4-Task Lakeflow Job ([`tests/00_refactor_equivalence_check.ipynb`](../tests/00_refactor_equivalence_check.ipynb))
- Confirmed two-way `exceptAll == 0` equivalence between pre-refactor and Associate-level refactored outputs across `workspace.sentinel_silver.transactions`, `workspace.sentinel_silver.quarantine` (all non-reason columns), and `workspace.sentinel_gold.alerts`.
- Executed the 4-task Databricks Lakeflow Job (`01_bronze_transactions → 02_silver_transactions → 03_historical_features → 04_monitoring_rules`) on Serverless compute; all four tasks succeeded end-to-end.

---

## 2. Phase 3 — Application, AI, Genie, Reviews & Power BI Verification

### A. Confirmed Live Databricks App & Browser Checks
- **Connectivity Checks**: `/api/health` and `/api/health/sql` (`connectionCheck: 1`) confirmed in Databricks Apps.
- **Read-Only Investigation Workspace (`GET /api/alerts`, `GET /api/alerts/:alertId/history`)**:
  - Selecting an alert in the Review Queue updates transaction facts, plain-language rule evidence callouts, the 14-day SVG Amount Comparison bar chart, and the strictly earlier card history table (`event_time < alert.event_time`).
  - Filtering by Payment velocity (`RULE_01_CARD_VELOCITY_1H`) updates loaded queue rows and summary counts.
  - Searching a non-matching string clears the Review Queue and Selected Investigation panel cleanly.
  - Clicking `Reset` restores the default queue and alert selection.
- **On-Demand AI Evidence Summary (`POST /api/alerts/:alertId/summary`)**:
  - Confirmed live summary generation against the Databricks AI Gateway endpoint (`SENTINEL_AI_MODEL = system.ai.gpt-oss-120b`) using masked card numbers and excluding fraud labels.
- **Ask Genie Panel (`POST /api/genie/ask`)**:
  - Confirmed live initial natural-language questions against the configured Databricks Genie space (`SENTINEL_GENIE_SPACE_ID` via `sentinel-genie`).
- **Persistent Analyst Reviews (`PUT /api/alerts/:alertId/review`)**:
  - Confirmed live review saving and updating (`Needs review`, `In review`, `Closed`, and notes) in `workspace.sentinel_gold.alert_reviews`.
  - Confirmed saved status and notes persist across browser page refreshes.
  - Confirmed per-alert isolation when switching between alerts.
- **Power BI Consumer**:
  - Confirmed Power BI imports `workspace.sentinel_silver.transactions`, `workspace.sentinel_gold.alerts`, and `workspace.sentinel_gold.alert_reviews` via the SQL Warehouse, and verified KPI totals.

### B. Remaining Unconfirmed Checks
1. **Genie Follow-Up Questions**: Sending a follow-up question in `Ask about the data` using an existing `conversationId` has not yet been confirmed in live testing.
2. **Review Survival After Pipeline Rerun**: Confirming that saved rows in `workspace.sentinel_gold.alert_reviews` remain intact and properly joined after rerunning the 4-task Lakeflow Job (which overwrites `workspace.sentinel_gold.alerts` using deterministic SHA-256 `alert_id` keys) remains unconfirmed.
3. **Power BI Shared-Date Filtering**: Confirming shared-date slicer filtering across the imported tables in Power BI remains unconfirmed.
4. **Frontend Cleanup Browser Regression Check**: Running the short browser regression checklist following the extraction of `AnalystReviewForm.tsx` and consolidation of `getReviewStatusBadgeClass`.

---

## 3. Demo Walkthrough Guide (5-Minute Presentation Flow)

1. **Medallion Pipeline & Governance (1 min)**:
   - Show the 4-task Databricks Lakeflow Job (`01_bronze → 02_silver → 03_features → 04_rules`) and explain how `is_fraud` is separated during replay preparation so monitoring rules and AI prompts never see fraud labels.
2. **Alert Triage in the Review Queue (1 min)**:
   - Open the Sentinel Databricks App. Point out the `CONNECTED · DATABRICKS SQL` status badge and the **Loaded alerts** summary cards (explaining that counts reflect the bounded API response up to `200` rows).
   - Filter by **Payment velocity (1h)** or select the **Evaluation (Jan 29–Feb 11)** replay window preset, then click `Apply` and `Reset`.
3. **Inspecting Explainable Rule Evidence & Earlier History (1 min)**:
   - Select a flagged transaction in the queue. Walk through its plain-language rule evidence callout, the horizontal SVG **Amount comparison** chart (`Transaction amount` vs. `14-day average` vs. `Rule threshold (3× 14d average)`), and the **Earlier card history** table (`event_time < alert.event_time`).
   - Expand **Technical details and source lineage** to show the deterministic SHA-256 `alert_id`, `source_file`, `source_row_index`, and Unity Catalog table lineage.
4. **AI Evidence Summary & Analyst Decision Persistence (1 min)**:
   - Click **Generate evidence summary** to request an on-demand explanation from Databricks AI Gateway (`AI-generated · Review against evidence`).
   - In **Analyst decision**, update the status to `In review` or `Closed`, enter investigation notes, click **Save review**, and refresh the browser to demonstrate Delta Lake persistence in `workspace.sentinel_gold.alert_reviews`.
5. **Natural-Language Exploration with Genie & Power BI (1 min)**:
   - In **Ask about the data**, submit a question about alert counts or rule matches and expand **View supporting data** to inspect the generated SQL and capped result rows.
   - Show the Power BI report connected to the same Databricks SQL Warehouse tables (`transactions`, `alerts`, `alert_reviews`).
