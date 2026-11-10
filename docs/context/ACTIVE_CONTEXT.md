# Active Context: Sentinel

## Session Metadata

- Last updated: 2026-11-10
- Active role: QA Engineer
- Mode: VERIFICATION

## Project

Sentinel is a learning prototype combining Databricks skills with a polished React UI for fintech transaction monitoring and investigation.

Transactions are validated, enriched with earlier activity, and assessed
using monitoring rules. Alerts provide evidence for analyst review.
An alert does not automatically establish fraud or block a transaction.
Prioritize understandable implementation and small steps.

## Current Objective

Phase 2 is **complete and verified**, and the Phase 3 **read-only investigation UI and API** (`GET /api/alerts`, `GET /api/alerts/:alertId/history`, and `app/frontend/src/`) are **complete and verified** in live browser checks on `feat/phase-3-investigation-ui`. Step 3E (**AI evidence summaries** via `POST /api/alerts/:alertId/summary`), Step 3F (**Ask Genie panel** via `POST /api/genie/ask`), and Step 3G (**Analyst review persistence** via `PUT /api/alerts/:alertId/review` against `workspace.sentinel_gold.alert_reviews`) are implemented and verified locally, pending live Databricks AI Gateway, Genie Conversation API, and review persistence testing.

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

### Steps 3B–3D — Read-Only React + TypeScript Investigation UI (`app/frontend/src/`) — Completed and Verified
- **Implemented & Verified (`npm run lint`, `npm run build`, and Live Browser Checks Passed)**:
  - **Visual & Layout Adaptation (`app/frontend/src/index.css`, `app/frontend/src/App.css`, `app/frontend/src/App.tsx`)**:
    - Adapted the Sentinel Payment Intelligence template: deep navy sidebar (`#0d1526`), pale cool gray background (`#f8fafc`), crisp white panels (`#ffffff`), thin 1px borders (`#e2e8f0`), blue accents (`#2563eb`), and clean typography without any non-functional navigation items (`Overview`, `My Cases`), priorities, workflow statuses, AI copilot, analyst notes, or `UTC` timestamp labels.
    - Functional sidebar rule-filter views (`Alert queue (all)`, `Payment velocity (1h)`, `Unusual amount (14d)`, `Similar payments (1h)`, `Multi-rule (2+)`) and top summary cards explicitly describing **loaded results** bounded by the API result limit.
  - **API Contracts & Formatters** (`app/frontend/src/types/alerts.ts`, `app/frontend/src/utils/formatters.ts`):
    - Typed contracts for `GoldAlert`, `RuleEvidence`, `CardHistoryTransaction`, `AlertQueryFilters`, `AppliedAlertFilters`, `AlertsListResponse`, and `AlertHistoryResponse` (no `is_fraud` field).
    - `maskCardNumber` (`•••• 1234`), `formatCurrency` (`$180.50`), `formatRuleTitle`, `formatRuleBadge`, `formatObservedMetricsList`, and `describeRuleEvidencePlainly`.
  - **Review Queue Panel & Filters** (`app/frontend/src/components/AlertFiltersBar.tsx`, `app/frontend/src/components/AlertQueuePane.tsx`):
    - Integrated search, rule filter, start/end date inputs, replay window shortcut pills, result limit (`25`, `50`, `100`, `200`), `Apply`, and `Reset`.
    - Selectable review queue table (`Event time`, `Merchant`, `Masked card`, `Amount`, `Matched rules`) with keyboard navigation, active blue row indicator, loading/error/empty states, and explicit loaded-result count badge.
  - **Selected Investigation Panel** (`app/frontend/src/components/AlertDetailPane.tsx`):
    - Displays 4-column key payment facts (`Payment amount`, `Card reference`, `Merchant`, `Event time` without `UTC` labeling), warm amber left-bordered plain-language rule evidence callouts with metric pills, horizontal SVG amount comparison graphic (`Transaction amount`, `14-day average`, `Rule threshold (3× 14d average)`), 4-card earlier activity snapshot, strictly earlier card history table (`event_time < alert.event_time`) clearly labeled as limited results, and an expandable `<details>` section for technical IDs, rule specifications, and Unity Catalog source lineage.
  - **Local Build Verification Passed**:
    - `npm run lint` (`eslint .`): `0` errors, `0` warnings.
    - `npm run build` (`tsc -b && vite build`): `0` errors; production bundle built in `app/frontend/dist/`.
  - **Confirmed Live Browser Verification**:
    - Alert selection updates transaction details, the amount comparison chart, and earlier card history.
    - Payment velocity (`RULE_01_CARD_VELOCITY_1H`) filtering works as expected.
    - No-match search clears both the review queue and the selected investigation details.
    - `Reset` restores the alerts queue and default selection.

### Step 3E — On-Demand AI Evidence Summaries (`app/backend/ai.js`, `app/backend/server.js`, `app/frontend/src/`)
- **Implemented & Verified Locally**:
  - Reused the existing Databricks OAuth + AI Gateway chat completion connection in `app/backend/ai.js` (`fetchDatabricksWorkspaceAuth`, `requestAiChatCompletion`, `maskCardIdentifier`, `buildAlertEvidencePayload`, `generateAlertEvidenceSummary`).
  - Added `POST /api/alerts/:alertId/summary` in `app/backend/server.js`, which retrieves the selected alert and up to `10` strictly earlier card transactions (`event_time < alert.event_time`) on the server via `fetchAlertHistory`, masks card identifiers, excludes fraud labels, treats merchant/source text strictly as data rather than instructions, and requests a short plain-text explanation covering why the transaction was flagged, supporting facts/thresholds, and missing context/limitations.
  - Added the `Generate evidence summary` button and plain-text summary box in `app/frontend/src/components/AlertDetailPane.tsx` and `app/frontend/src/App.tsx` with loading, error, and `AI-generated` labels, clearing state and aborting any in-flight request when alert selection changes.

### Step 3F — Ask Genie Panel (`app/app.yaml`, `app/backend/genie.js`, `app/backend/server.js`, `app/frontend/src/components/AskGeniePanel.tsx`)
- **Implemented & Verified Locally**:
  - Configured `SENTINEL_GENIE_SPACE_ID` via `valueFrom: sentinel-genie` in `app/app.yaml` (never hardcoded).
  - Reused `fetchDatabricksWorkspaceAuth` in `app/backend/genie.js` and implemented `askSentinelGenie` + `POST /api/genie/ask` (`app/backend/server.js`): starts a Genie conversation (`/api/2.0/genie/spaces/{spaceId}/start-conversation`) or sends a follow-up message (`/conversations/{conversationId}/messages`), polls message status with a bounded timeout (`60s`), and retrieves the plain-text answer, generated SQL, and available attachment query results (capped at `20` displayed rows) without executing generated SQL separately.
  - Added `app/frontend/src/components/AskGeniePanel.tsx` (separate from the selected-alert summary) with question input, `Ask` / `Ask follow-up` button, `New conversation` reset, loading/error states, `AI-generated · Review against evidence` label, safe basic Markdown answer (`SafeMarkdownText.tsx`), and collapsible `View supporting data` containing generated SQL and capped query results.

### Step 3G — Analyst Review Persistence (`workspace.sentinel_gold.alert_reviews`, `app/backend/sql.js`, `app/backend/server.js`, `app/frontend/src/`)
- **Implemented & Verified Locally (Pending Live Persistence Testing)**:
  - **Backend (`app/backend/sql.js`, `app/backend/server.js`)**:
    - Joined `workspace.sentinel_gold.alerts` with a deduplicated subquery on `workspace.sentinel_gold.alert_reviews` (`QUALIFY ROW_NUMBER() OVER (PARTITION BY LOWER(alert_id) ORDER BY updated_at DESC) = 1`) in `fetchGoldAlerts` and `fetchAlertHistory` so alert/history reads always remain at one row per transaction and default unsaved alerts to `review_status = 'Needs review'`, `review_notes = ''`, and `review_updated_at = null`.
    - Added `parseAlertReviewInput` and `saveAlertReview` (`PUT /api/alerts/:alertId/review`), validating 64-hex `alertId`, `reviewStatus` (`'Needs review'`, `'In review'`, `'Closed'`), and `reviewNotes` (maximum `2,000` characters), verifying that the alert exists in `workspace.sentinel_gold.alerts` (`404` if missing), executing a parameterized `MERGE INTO workspace.sentinel_gold.alert_reviews`, and returning the saved review record.
  - **Frontend (`app/frontend/src/`)**:
    - Added the `Review status` badge column in the selectable Review queue table (`AlertQueuePane.tsx`).
    - Added the **Analyst decision** section in `AlertDetailPane.tsx` with `Review status` select (`Needs review`, `In review`, `Closed`), `Investigation notes` textarea (`2,000` character counter), `Save review` button, last-saved timestamp badge, `Unsaved changes` indicator, save-success message, and error state.
    - Scoped draft edits and save requests (`AbortController`) to the selected `alert_id` in `App.tsx` so switching alerts cannot display or overwrite another alert's review, and added unsaved-edit confirmation (`window.confirm` + `beforeunload`) before discarding unsaved changes.
- **Pending Live Databricks Checks**:
  - Live persistence test of `PUT /api/alerts/:alertId/review` and `GET /api/alerts` against `workspace.sentinel_gold.alert_reviews`.
  - Live test of `POST /api/alerts/:alertId/summary` against the configured Databricks AI Gateway endpoint (`SENTINEL_AI_MODEL`).
  - Live test of `POST /api/genie/ask` (initial question and follow-up question) against the configured Databricks Genie space (`SENTINEL_GENIE_SPACE_ID` from `sentinel-genie`).

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

1. Run live persistence testing for `PUT /api/alerts/:alertId/review` and `GET /api/alerts` against `workspace.sentinel_gold.alert_reviews` in Databricks.
2. Run live browser verification for `POST /api/alerts/:alertId/summary` and `POST /api/genie/ask` (initial + follow-up questions) against the Databricks AI Gateway and Genie Conversation API endpoints.

## Verification Limitations

ACE's generated test command has not been configured for Sentinel.
Local checks do not establish that Databricks execution succeeded.
The automated ACE loop is not configured for this project.
