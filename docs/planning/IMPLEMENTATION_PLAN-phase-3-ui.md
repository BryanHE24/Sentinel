# Phase 3 — Investigation UI Plan

## Objective

Build a polished, understandable, prototype-sized React + TypeScript investigation workspace in `app/` that:
1. Displays a selectable **Review Queue** table with high-signal filters (rule ID / multi-rule, replay batch date period, transaction/card/merchant search, and result cap).
2. Displays a **Selected Investigation** panel with structured plain-language **rule evidence** (`observed_metrics`, `threshold_definition`, `window`, `rule_version`), a horizontal **amount comparison graphic** (`amount`, `card_avg_amount_14d`, `unusual_amount_threshold_14d`), **point-in-time historical feature context** (`1h` and `14d` metrics), **strictly earlier card transaction history** (`event_time < alert.event_time`), expandable technical details/lineage, and an on-demand **AI evidence summary** (`POST /api/alerts/:alertId/summary`).
3. Connects directly to real Databricks SQL data (`workspace.sentinel_gold.alerts` and `workspace.sentinel_silver.transactions`) with explicit connection status and error states (no mock mode or silent mock fallback).

## Data Contract Alignment (`workspace.sentinel_gold.alerts`)

Every alert record loaded from `workspace.sentinel_gold.alerts` matches the 23-column schema persisted by `pipelines/04_monitoring_rules.ipynb`:

- **Identity & Lineage**: `alert_id`, `trans_num`, `ruleset_version` (`ruleset-v1.0-frozen`), `event_time`, `replay_batch`, `source_file`, `source_row_index`
- **Transaction Attributes**: `cc_num`, `merchant`, `category`, `amount`
- **Historical Context**:
  - `card_txn_count_1h`, `card_txn_count_14d`, `card_avg_amount_14d`, `unusual_amount_threshold_14d`
  - `card_merchant_txn_count_1h`, `card_merchant_similar_amount_count_1h`, `similar_amount_lower_bound`, `similar_amount_upper_bound`
- **Rule Match & Evidence**:
  - `matched_rule_count`, `matched_rule_ids`, `matched_rule_versions`
  - `rule_evidence`: array of `{ rule_id, rule_version, window, observed_metrics, threshold_definition }`

*(Fraud labels `is_fraud` are strictly excluded from all API queries, AI prompts, types, and UI views.)*

## Architecture & Visual Direction

1. **Direct Databricks SQL Data Source (No Mock Mode)**:
   - Top header badge clearly displays the live Databricks SQL connection status (`CONNECTED · DATABRICKS SQL` or `DATABRICKS SQL · CONNECTION ERROR`).
   - All summary card counts and queue/history counts explicitly describe **loaded results** bounded by the API result limit.
2. **Sentinel Template Layout**:
   - **Left Navy Sidebar**: Brand identity (`sentinel · PAYMENT INTELLIGENCE`), working rule-filter navigation items with loaded counts, and operational status footer.
   - **Top Console Header & Summary Cards**: Displays `Loaded alerts` and per-rule counts across the currently loaded response.
   - **Review Queue Panel**:
     - Search by transaction ID, card, or merchant; filter by rule signal, start/end batch date, replay window presets, and result limit (`25`, `50`, `100`, `200`).
     - Selectable table showing `Event time` (without `UTC` labeling), `Merchant`, `Masked card`, `Amount`, and `Matched rules`.
   - **Selected Investigation Panel**:
     - **Key Facts**: `Payment amount`, `Card reference` (masked), `Merchant`, and `Event time` (source timezone unspecified).
     - **Plain-Language Rule Evidence**: Warm amber callouts explaining why each rule triggered alongside formatted metric pills.
     - **On-Demand AI Evidence Summary**: `Generate evidence summary` button calling `POST /api/alerts/:alertId/summary`, rendering the plain-text explanation with loading, error, and `AI-generated` labels, and clearing/aborting when selection changes.
     - **Amount Comparison & Activity Snapshot**: Horizontal SVG bar comparison (`Transaction amount`, `14-day average`, `Rule threshold (3× 14d average)`) plus `1h` and `14d` prior activity counts.
     - **Strictly Earlier Card History (`event_time < alert.event_time`)**: Table of earlier accepted Silver transactions for the same `cc_num` strictly before the alert's `event_time`, clearly labeled as limited results.
     - **Expandable Technical Details & Lineage**: Native `<details>` block containing `trans_num`, `alert_id` (SHA-256), `ruleset_version`, `replay_batch`, `source_file`, `source_row_index`, Unity Catalog table names, and raw rule specifications.

## Implementation Steps & Status

1. **Step 3A — Backend Read-Only Alert & History Endpoints (`app/backend/sql.js`, `app/backend/server.js`)**: **Complete & Confirmed in Live Databricks SQL**
   - Parameterized `executeSqlStatement` helper in `app/backend/sql.js` built on `DBSQLClient` + `DBSQLParameter`.
   - `GET /api/alerts`: reads `workspace.sentinel_gold.alerts` with validated `ruleId` / `MULTI_RULE`, `startDate`, `endDate`, `search`, and `limit` (capped at `200`, default `50`).
   - `GET /api/alerts/:alertId/history`: reads the selected alert from `workspace.sentinel_gold.alerts` and fetches strictly earlier transactions for the same `cc_num` with `event_time < alert.event_time` from `workspace.sentinel_silver.transactions` (`limit` capped at `100`, default `25`).
2. **Steps 3B–3D — Read-Only Investigation UI (`app/frontend/src/`)**: **Complete & Confirmed in Live Browser Checks**
   - Typed contracts (`alerts.ts`), formatters (`formatters.ts`), filter bar (`AlertFiltersBar.tsx`), selectable review queue table (`AlertQueuePane.tsx`), and selected investigation panel (`AlertDetailPane.tsx`).
   - **Confirmed Live Browser Checks**:
     - Alert selection updates transaction details, the amount comparison chart, and earlier card history.
     - Payment velocity (`RULE_01_CARD_VELOCITY_1H`) filtering works.
     - No-match search clears the review queue and selected investigation details.
     - `Reset` restores the alerts queue and selection.
3. **Step 3E — On-Demand AI Evidence Summaries (`app/backend/ai.js`, `app/backend/server.js`, `app/frontend/src/`)**: **Implemented & Verified Locally (Pending Live Databricks AI Check)**
   - Reused the OAuth + AI Gateway chat completion flow in `app/backend/ai.js` (`requestAiChatCompletion`, `buildAlertEvidencePayload`, `generateAlertEvidenceSummary`).
   - Added `POST /api/alerts/:alertId/summary`, which retrieves the selected alert and up to `10` strictly earlier card transactions on the server via `fetchAlertHistory`, masks card identifiers, excludes fraud labels, treats source text as data rather than instructions, and requests a concise explanation of why the transaction was flagged, supporting facts/thresholds, and missing context/limitations.
   - Added the `Generate evidence summary` button and safe Markdown summary display (`SafeMarkdownText.tsx`) in `AlertDetailPane.tsx` with `AbortController` cancellation and automatic state clearing when alert selection changes.
4. **Step 3F — Ask Genie Panel (`app/app.yaml`, `app/backend/genie.js`, `app/backend/server.js`, `app/frontend/src/components/AskGeniePanel.tsx`)**: **Implemented & Verified Locally (Pending Live Genie Check)**
   - Reads `SENTINEL_GENIE_SPACE_ID` from the `sentinel-genie` app resource in `app/app.yaml` and queries the Genie Conversation API (`/api/2.0/genie/spaces/{spaceId}`) with bounded polling (`60s`) and follow-up conversation support.
   - Displays the `Ask about the data` panel with safe basic Markdown rendering and collapsible `View supporting data` (generated SQL + capped result rows).
5. **Step 3G — Analyst Review Persistence (`workspace.sentinel_gold.alert_reviews`, `app/backend/sql.js`, `app/backend/server.js`, `app/frontend/src/`)**: **Implemented & Verified Locally (Pending Live Persistence Testing)**
   - Reads current review state via a deduplicated `LEFT JOIN` (`QUALIFY ROW_NUMBER() OVER (PARTITION BY LOWER(alert_id) ORDER BY updated_at DESC) = 1`), defaulting unsaved alerts to `'Needs review'`.
   - Saves analyst reviews via `PUT /api/alerts/:alertId/review` using parameterized `MERGE INTO workspace.sentinel_gold.alert_reviews` after validating `alertId`, `reviewStatus` (`'Needs review'`, `'In review'`, `'Closed'`), `reviewNotes` (`<= 2,000` chars), and alert existence in `workspace.sentinel_gold.alerts`.
   - Displays review status in the queue and selected investigation header, scopes form edits and save requests to the selected alert, and warns before discarding unsaved edits.
6. **Pending Live Verification**:
   - Live persistence test of `PUT /api/alerts/:alertId/review` against `workspace.sentinel_gold.alert_reviews`.
   - Live browser test of `POST /api/alerts/:alertId/summary` and `POST /api/genie/ask`.

## Guardrails & Scope Boundaries

- Do **not** modify any pipeline notebooks (`pipelines/`, `scripts/`, `tests/`).
- Do **not** expose `is_fraud` anywhere in the backend SQL, AI prompts, or frontend UI.
- Do **not** add mock mode or silent fallback data.
