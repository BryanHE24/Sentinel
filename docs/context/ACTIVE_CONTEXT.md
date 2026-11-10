# Active Context: Sentinel

## Session Metadata

- Last updated: 2026-11-09
- Active role: QA Engineer
- Mode: VERIFICATION

## Project

Sentinel is a learning prototype combining Databricks skills with a polished React UI for fintech transaction monitoring and investigation.

Transactions are validated, enriched with earlier activity, and assessed
using monitoring rules. Alerts provide evidence for analyst review.
An alert does not automatically establish fraud or block a transaction.
Prioritize understandable implementation and small steps.

## Current Objective

Phase 2 is **complete and verified**, and Step 3A backend endpoints (`GET /api/alerts` and `GET /api/alerts/:alertId/history`) are **confirmed working against live Databricks SQL**. Build and verify the Phase 3 React + TypeScript investigation UI (`app/frontend/src/`) on `feat/phase-3-investigation-ui`.

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
- pipelines/05_rule_evaluation.ipynb
- pipelines/historical_features.py
- tests/00_refactor_equivalence_check.ipynb
- tests/02_silver_transactions_tests.ipynb
- tests/04_monitoring_rules_tests.ipynb

The assessment filename above reflects the existing repository spelling.

## Phase 2: Completed and Verified

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
  - Confirmed in Databricks for the `rule_development` period (`2019-01-15` through `2019-01-28`):
    - Evaluated transactions: `23,731`
    - Flagged transactions: `1,376` (`5.8%`)
    - Rule matches: `25` velocity (`RULE_01_CARD_VELOCITY_1H`), `1,356` unusual amount (`RULE_02_UNUSUAL_AMOUNT_14D`), `0` repeated similar payments (`RULE_03_REPEATED_SIMILAR_MERCHANT_1H`)
    - Multi-rule transactions: `5`
- **Frozen-Rule Evaluation Summary (`2019-01-29` through `2019-02-11` Holdout Period)**:
  - Evaluated transactions: `24,059` (`42` total daily batches / `71,934` total transactions released and ingested)
  - Flagged alerts (`ruleset-v1.0-frozen`): `1,423`
  - Labeled fraud transactions: `256`
  - Confusion matrix: `TP = 116`, `FP = 1,307`, `FN = 140`, `TN = 22,496`
  - Precision: `8.15%` (`0.0815`)
  - Recall: `45.31%` (`0.4531`)
  - **Baseline Assessment**: This frozen ruleset (`ruleset-v1.0-frozen`) serves as a simple prototype baseline with substantial false alarms (`1,307` false positives) and missed fraud (`140` false negatives), motivating analyst review workflows and AI/triage enrichment while keeping rule thresholds unchanged.

### Associate-Level PySpark Refactor & 4-Task Databricks Lakeflow Job (Verified in Databricks)
- **Executed and Confirmed in Databricks**:
  - Refactored `pipelines/02_silver_transactions.ipynb`, `pipelines/03_historical_features.ipynb` (persisting `workspace.sentinel_gold.transaction_features`), and `pipelines/04_monitoring_rules.ipynb` to Associate-level PySpark per `.ace/standards/pyspark-associate-level.md` and `docs/REFACTOR_GUIDE.md`.
  - Passed two-way `exceptAll == 0` equivalence verification in `tests/00_refactor_equivalence_check.ipynb` across `workspace.sentinel_silver.transactions`, `workspace.sentinel_silver.quarantine` (all non-reason columns), and `workspace.sentinel_gold.alerts`.
  - Updated and executed the **four-task Databricks Lakeflow Job** (`01_bronze_transactions → 02_silver_transactions → 03_historical_features → 04_monitoring_rules`), which **succeeded** end-to-end.

## Phase 3 Status (Investigation UI & API)

### Step 3A — Read-Only Alert & History Backend Endpoints (`app/backend/sql.js`, `app/backend/server.js`)
- **Executed and Confirmed in Live Databricks SQL**:
  - Parameterized `executeSqlStatement` (`DBSQLClient` + `DBSQLParameter`) in `app/backend/sql.js` keeping OAuth credentials strictly server-side.
  - `GET /api/alerts` (reads `workspace.sentinel_gold.alerts` with validated `ruleId` / `MULTI_RULE`, `startDate`, `endDate`, `search`, and `limit` capped at `200`, default `50`).
  - `GET /api/alerts/:alertId/history` (validates 64-hex `alertId`, reads the alert from `workspace.sentinel_gold.alerts`, and queries `workspace.sentinel_silver.transactions` for the same `cc_num` with strictly earlier `event_time < CAST(:alertEventTime AS TIMESTAMP_NTZ)`, `limit` capped at `100`, default `25`).
  - Preserved exact decimal strings (`CAST(CAST(... AS DECIMAL(18, 2)) AS STRING)`) and timezone-unspecified timestamp strings (`DATE_FORMAT(event_time, 'yyyy-MM-dd HH:mm:ss')`) in SQL projections and JSON serialization; excluded fraud labels completely.
  - Confirmed live backend execution against Databricks SQL (`workspace.sentinel_gold.alerts` and `workspace.sentinel_silver.transactions`).

### Steps 3B–3D — React + TypeScript Investigation UI (`app/frontend/src/`)
- **Implemented & Verified Locally (`npm run lint` & `npm run build` Passed)**:
  - **API Contracts & Types** (`app/frontend/src/types/alerts.ts`): Typed contracts for `GoldAlert`, `RuleEvidence`, `CardHistoryTransaction`, `AlertQueryFilters`, `AppliedAlertFilters`, `AlertsListResponse`, and `AlertHistoryResponse` (no `is_fraud` field).
  - **Formatters** (`app/frontend/src/utils/formatters.ts`): `maskCardNumber` (`•••• 1234`), `formatCurrency` (`$180.50` while preserving exact decimal strings), `formatRuleTitle`, `formatRuleBadge`, and `formatObservedMetricsList` (`key=value` metric parser).
  - **Filter Bar** (`app/frontend/src/components/AlertFiltersBar.tsx`): Rule filter (`ALL`, `RULE_01_CARD_VELOCITY_1H`, `RULE_02_UNUSUAL_AMOUNT_14D`, `RULE_03_REPEATED_SIMILAR_MERCHANT_1H`, `MULTI_RULE`), `startDate` / `endDate` inputs, replay-period quick pills (`Initial History`, `Rule Dev`, `Evaluation`), merchant/category/transaction ID search, and result cap selector (`25`, `50`, `100`, `200`).
  - **Two-Pane Investigation Workspace** (`app/frontend/src/App.tsx`, `app/frontend/src/components/AlertQueuePane.tsx`, `app/frontend/src/components/AlertDetailPane.tsx`):
    - **Left Pane (`AlertQueuePane`)**: Displays `Showing X loaded results (API cap: Y rows)`, loading/error/empty states, and selectable alert cards with formatted USD amount, masked card number, merchant, category, and rule badges.
    - **Right Pane (`AlertDetailPane`)**: Displays transaction & lineage metadata, masked card number, readable rule evidence cards (`observed_metrics` pills + `threshold_definition`), 4-card point-in-time historical feature snapshot (`1h` velocity, `14d` baseline + `3x` threshold, `1h` merchant count, `1h` similar-amount count + `±10%` bounds), and the strictly earlier card history table (`event_time < alert.event_time`) from `GET /api/alerts/:alertId/history` with loading/error/empty states and loaded-result count labeling.
    - **Header Summary Strip**: Explicitly labels all summary counts (`Loaded Alerts`, `Multi-Rule (Loaded)`, `Velocity / 1h (Loaded)`, `Unusual Amt / 14d (Loaded)`) as **loaded results** bounded by the API response cap.
  - **Local Verification Passed**:
    - `npm run lint` (`eslint .`): `0` errors, `0` warnings.
    - `npm run build` (`tsc -b && vite build`): `0` errors; production bundle built in `app/frontend/dist/`.
- **Pending Interactive Browser Verification**:
  - End-to-end visual and interactive review in the browser against the running Express/Databricks Apps backend (`GET /api/alerts` and `GET /api/alerts/:alertId/history`).

## Established Decisions

- Use trans_num as the transaction identifier.
- Preserve cc_num as a string.
- Normalize blank required identifiers (`trans_num`, `cc_num`, `merchant`) to `NULL`.
- Use trans_date_trans_time parsed as TIMESTAMP_NTZ for event ordering.
- Convert `amt` to `DECIMAL(18,2)` after checking `AMOUNT_PATTERN = r"^-?[0-9]+(\.[0-9]{1,2})?$"` (ordinary numeric text with at most two decimal places), recording `missing_amount`, `invalid_amount` (merging malformed/out-of-range and >2-decimal precision changes; rejecting non-ordinary numeric strings like `+5`, `.50`, `1e3`), and `non_positive_amount`.
- Preserve source references and raw values (including `_rescued_data`) needed for investigation.
- Quarantine any row with non-blank `_rescued_data` using validation reason `unexpected_rescued_data`; `NULL` and whitespace-only `_rescued_data` do not trigger this reason.
- Classify duplicate `trans_num` values across the entire Bronze input using `F.collect_set(F.struct(*BUSINESS_COLUMNS))` over a `trans_num` window, distinguishing identical business records from conflicting records without letting invalid rows hide conflicts or arbitrarily selecting a winner.
- Account for every input row exactly once.
- Persist accepted transactions to `workspace.sentinel_silver.transactions` (excluding personal attributes), non-accepted records (`quarantined` and `duplicate_identical`) to `workspace.sentinel_silver.quarantine`, historical features to `workspace.sentinel_gold.transaction_features`, and flagged alerts to `workspace.sentinel_gold.alerts` using full-snapshot `overwrite` mode.
- The source timezone is unspecified.
- Preserve unix_time in Bronze and quarantine; its discrepancy remains unexplained.
- Exclude fraud labels from monitoring features, rules, and AI inputs.
- Keep evaluation batches unreleased until thresholds are frozen.

## Implementation Requirements

- Follow `.ace/standards/pyspark-associate-level.md` and `docs/context/PROJECT_CONTEXT.md`: write Associate-level SQL/PySpark that the developer can explain, treating line/row/check counts as preferences rather than rigid rules.
- Use short cells with one clear purpose; Markdown explains purpose, reasoning, and a small example.
- Keep in-notebook self-tests calling the actual transformation functions and basic count/uniqueness checks in pipeline notebooks; preserve legacy test notebooks and `pipelines/historical_features.py` until Databricks equivalence verification passes.
- Never hide complexity in large helper modules or copy pipeline transformation logic into separate test notebooks.
- Preserve essential validation, earlier-only history, one row per transaction ID, and alert evidence.
- Distinguish proposed checks from executed checks.

## Next Steps

1. Run interactive browser verification of the Phase 3 investigation UI (`app/frontend/src/`) connected to the live backend (`GET /api/alerts` and `GET /api/alerts/:alertId/history`).
2. Review any UI polish feedback or proceed to Phase 4 planning when ready.

## Verification Limitations

ACE's generated test command has not been configured for Sentinel.
Local checks do not establish that Databricks execution succeeded.
The automated ACE loop is not configured for this project.
