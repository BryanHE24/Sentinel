# Sentinel Build Journal

## Phase 1 — Foundation, Source Assessment & Incremental Bronze Ingestion (Completed & Verified)

### Key Decisions
- Preserve original Kaggle CSV files (`fraudTrain.csv`, `fraudTest.csv`) outside Git in `/Volumes/workspace/sentinel_sources/originals/`.
- Profile all raw columns as strings (`inferColumnTypes => false`) before defining transformations.
- Select a continuous 42-day chronological replay scope (`2019-01-01` through `2019-02-11`, `71,934` transactions) split into 14-day `initial_history` (`24,144`), `rule_development` (`23,731`), and `evaluation` (`24,059`) windows.
- Strip `is_fraud` from operational replay files into `/Volumes/workspace/sentinel_evaluation/evaluation_labels/replay_v1` and extract `_rescued_data._c0` as `source_row_index`.
- Keep evaluation batches unreleased in `/Volumes/workspace/sentinel_sources/replay_landing` until rule thresholds are frozen.

### Completed & Verified
- Created the React + TypeScript frontend (`app/frontend`) and Node.js + Express backend (`app/backend`).
- Verified SQL Warehouse connectivity (`/api/health/sql`) using the Databricks App service principal and OAuth.
- Executed [`explorations/01_source_assesment.ipynb`](../explorations/01_source_assesment.ipynb), [`scripts/02_prepare_replay.ipynb`](../scripts/02_prepare_replay.ipynb), [`scripts/03_release_replay.ipynb`](../scripts/03_release_replay.ipynb), and [`pipelines/01_bronze_transactions.ipynb`](../pipelines/01_bronze_transactions.ipynb).
- Verified Auto Loader (`cloudFiles`) ingestion of `2,414` rows for `2019-01-01` and confirmed idempotent rerun (`0` rows added with the same checkpoint).
- Phase 1 commit: `a81ba70`.

---

## Phase 2 — Silver Validation, Historical Features, Frozen Rules & Lakeflow Job (Completed & Verified)

### Key Decisions
- Validate required identifiers (`trans_num`, `cc_num`, `merchant`), parse `trans_date_trans_time` as `TIMESTAMP_NTZ` (unspecified source timezone), and validate 2-decimal positive amounts (`DECIMAL(18,2)` with `AMOUNT_PATTERN = r"^-?[0-9]+(\.[0-9]{1,2})?$"`).
- Classify duplicate `trans_num` occurrences across all of Bronze using `F.collect_set(F.struct(*BUSINESS_COLUMNS))` over a `trans_num` window so conflicting duplicates are all quarantined and valid identical duplicates retain one accepted row.
- Compute strictly earlier point-in-time card features (`[event_time - 1h, event_time)` and `[event_time - 14d, event_time)`) via an Associate-level self-join (`prev_event_time < event_time`) and persist `workspace.sentinel_gold.transaction_features`.
- Freeze three explainable monitoring rules (`ruleset-v1.0-frozen`) after inspecting `2019-01-15`–`2019-01-28` (`1,376` alerts / `5.8%` flag rate) without fraud labels, then release `2019-01-29`–`2019-02-11` for holdout evaluation.

### Completed & Verified
- Executed Silver, Historical Features, and Monitoring Rules across all `42` batches (`71,934` accepted Silver rows, `0` quarantined rows, `2,719` Gold alerts for Jan 1–28, and `4,142` total Gold alerts across Jan 1–Feb 11).
- Executed holdout evaluation in [`pipelines/05_rule_evaluation.ipynb`](../pipelines/05_rule_evaluation.ipynb) on Jan 29–Feb 11 (`24,059` transactions, `1,423` alerts, `256` actual fraud: `TP = 116`, `FP = 1,307`, `FN = 140`, `TN = 22,496`, `precision = 8.15%`, `recall = 45.31%`).
- Refactored notebooks `02`, `03`, and `04` to Associate-level PySpark (documented in [`docs/REFACTOR_GUIDE.md`](./REFACTOR_GUIDE.md)), verified two-way `exceptAll == 0` equivalence in [`tests/00_refactor_equivalence_check.ipynb`](../tests/00_refactor_equivalence_check.ipynb), and ran the 4-task Databricks Lakeflow Job (`01_bronze → 02_silver → 03_features → 04_rules`) to completion.

---

## Phase 3 — Investigation UI, AI Summaries, Genie, Analyst Reviews & Power BI (Implemented & Tested)

### Completed & Verified
- **Read-Only Investigation API & UI**: Implemented parameterized `GET /api/alerts` and `GET /api/alerts/:alertId/history` in [`app/backend/sql.js`](../app/backend/sql.js) and the Sentinel React investigation console in [`app/frontend/src/`](../app/frontend/src/); confirmed alert selection, SVG amount comparison chart, strictly earlier history, velocity filtering, no-match search, and reset in live browser checks.
- **On-Demand AI Evidence Summaries (`POST /api/alerts/:alertId/summary`)**: Implemented in [`app/backend/ai.js`](../app/backend/ai.js) using Databricks AI Gateway (`system.ai.gpt-oss-120b`), masking card numbers and excluding fraud labels; confirmed in live Databricks App testing.
- **Ask Genie Panel (`POST /api/genie/ask`)**: Implemented in [`app/backend/genie.js`](../app/backend/genie.js) using `SENTINEL_GENIE_SPACE_ID` (`valueFrom: sentinel-genie` in [`app/app.yaml`](../app/app.yaml)) and rendered in [`AskGeniePanel.tsx`](../app/frontend/src/components/AskGeniePanel.tsx); initial questions confirmed in live testing (follow-up questions remain unconfirmed).
- **Persistent Analyst Reviews (`PUT /api/alerts/:alertId/review`)**: Implemented parameterized `MERGE INTO workspace.sentinel_gold.alert_reviews` in [`app/backend/sql.js`](../app/backend/sql.js) and extracted [`AnalystReviewForm.tsx`](../app/frontend/src/components/AnalystReviewForm.tsx); live save/update, browser refresh persistence, and alert isolation passed (survival after a pipeline rerun and post-extraction browser regression check remain pending).
- **Power BI Consumer**: Connected Power BI to `workspace.sentinel_silver.transactions`, `workspace.sentinel_gold.alerts`, and `workspace.sentinel_gold.alert_reviews` via the SQL Warehouse; KPI totals verified (shared-date filtering remains unconfirmed).
