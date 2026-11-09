# Phase 3 — Investigation UI Plan (Smallest Next Step)

## Objective

Build a polished, understandable, prototype-sized React + TypeScript investigation workspace in `app/` that:
1. Displays an **Alert List** with simple, high-signal filters (rule ID, replay batch / date period, card or merchant search).
2. Displays an **Alert Detail Drawer/Panel** with structured **rule evidence** (`observed_metrics`, `threshold_definition`, `window`, `rule_version`), **historical feature context** (`1h` and `14d` metrics), and recent **card transaction history** leading up to the alert.
3. Provides a **clear, honest path to `workspace.sentinel_gold.alerts`** (and `workspace.sentinel_silver.transactions` for card history) that explicitly distinguishes **Connected Databricks Data** from **Local Demo / Mock Fixture Data** without silent fallback.

## Current Application Inspection

- **Frontend (`app/frontend/src/App.tsx`, `index.css`, `App.css`)**:
  - React 19 + TypeScript + Vite (`tsc -b && vite build`).
  - Currently a 32-line Phase 1 status page checking `GET /api/health`.
  - Uses clean CSS custom properties in `index.css` (`--bg`, `--text`, `--text-h`, `--border`, `--code-bg`, `--accent`, `--sans`, `--mono`) with light/dark mode support.
- **Backend (`app/backend/server.js`, `sql.js`, `ai.js`)**:
  - Node.js + Express 5 (`type: "module"`) serving `../frontend/dist` and exposing `GET /api/health`, `GET /api/health/sql`, and `POST /api/checks/ai`.
  - `sql.js` already connects to Databricks SQL Warehouse via `@databricks/sql` (`DBSQLClient`) using OAuth client credentials (`DATABRICKS_HOST`, `DATABRICKS_WAREHOUSE_ID`, `DATABRICKS_CLIENT_ID`, `DATABRICKS_CLIENT_SECRET`).

## Data Contract Alignment (`workspace.sentinel_gold.alerts`)

Every alert record in the UI (whether loaded from Databricks SQL or the local mock fixture) will match the exact 23-column schema persisted by `pipelines/04_monitoring_rules.ipynb`:

- **Identity & Lineage**: `alert_id`, `trans_num`, `ruleset_version` (`ruleset-v1.0-frozen`), `event_time`, `replay_batch`, `source_file`, `source_row_index`
- **Transaction Attributes**: `cc_num`, `merchant`, `category`, `amount`
- **Historical Context**:
  - `card_txn_count_1h`, `card_txn_count_14d`, `card_avg_amount_14d`, `unusual_amount_threshold_14d`
  - `card_merchant_txn_count_1h`, `card_merchant_similar_amount_count_1h`, `similar_amount_lower_bound`, `similar_amount_upper_bound`
- **Rule Match & Evidence**:
  - `matched_rule_count`, `matched_rule_ids`, `matched_rule_versions`
  - `rule_evidence`: array of `{ rule_id, rule_version, window, observed_metrics, threshold_definition }`

*(Fraud labels `is_fraud` are strictly excluded from all API queries, types, and UI views.)*

## Architecture & Visual Direction

1. **Explicit Data-Source Banner & Mode Toggle (No Silent Mock Fallback)**:
   - Top header badge clearly displays the active data source:
     - **`Connected: Databricks SQL (workspace.sentinel_gold.alerts)`** when querying the live SQL warehouse.
     - **`Mock Preview (Local Fixture — Not Connected to Databricks)`** when viewing built-in sample alerts locally (or when explicitly switched to Mock Preview mode).
   - If the user selects **Databricks SQL** mode and credentials or table permissions are missing, the UI shows the explicit connection error from the backend and offers a manual **"Load Mock Preview Fixture"** button rather than silently pretending mock data is live.
2. **Two-Pane Investigation Layout**:
   - **Top Bar**: App title, data-source badge + mode selector (`Databricks SQL` vs `Mock Preview`), and summary KPI pills (`Total Alerts`, `Velocity (Rule 1)`, `Unusual Amount (Rule 2)`, `Similar Merchant (Rule 3)`, `Multi-Rule`).
   - **Left Pane — Alert Queue & Filters**:
     - Filter by **Matched Rule** (`All`, `RULE_01_CARD_VELOCITY_1H`, `RULE_02_UNUSUAL_AMOUNT_14D`, `RULE_03_REPEATED_SIMILAR_MERCHANT_1H`, `Multi-Rule (2+)`).
     - Filter by **Replay Window / Date** (`All Dates`, `Initial History (Jan 1–14)`, `Rule Development (Jan 15–28)`, `Evaluation (Jan 29–Feb 11)`).
     - Search by **Transaction ID / Card / Merchant**.
     - Compact, scannable table/cards showing `event_time`, `trans_num`, masked `cc_num`, `merchant`, formatted `amount`, and rule badges.
   - **Right Pane — Alert Details, Rule Evidence & Prior History**:
     - **Alert Header**: `trans_num`, deterministic `alert_id`, `ruleset_version`, `event_time`, `amount`, `merchant`, `category`, `cc_num`, and source lineage (`replay_batch`, `source_file`, `source_row_index`).
     - **Rule Evidence Cards**: One card per item in `rule_evidence`, rendering `rule_id`, `rule_version`, `window`, `observed_metrics`, and `threshold_definition` in plain, explainable layout.
     - **Point-in-Time Feature Summary**: Side-by-side comparison of the transaction's `amount` vs `card_avg_amount_14d` and `unusual_amount_threshold_14d`, plus `1h` card and merchant counts.
     - **Prior Card Transaction History (`<= event_time`)**: Table of recent accepted transactions for the same `cc_num` up to the alert's `event_time` (from `workspace.sentinel_silver.transactions` when connected, or the mock history fixture in Mock Preview mode) so an analyst can visually verify the `1h` and `14d` activity.

## Smallest Implementation Steps

1. **Step 3A — Backend Read-Only Alert & History Endpoints (`app/backend/sql.js`, `app/backend/server.js`)**:
   - Add a reusable parameterized `executeSqlQuery(sqlText, params)` helper in `app/backend/sql.js` built on the existing `DBSQLClient` connection logic.
   - Add `GET /api/alerts` (reads `workspace.sentinel_gold.alerts` with optional `ruleId`, `startDate`, `endDate`, `search`, and `limit` parameters, ordered by `event_time DESC, trans_num ASC`).
   - Add `GET /api/alerts/:alertId/history` (reads the selected alert from `workspace.sentinel_gold.alerts` and fetches recent earlier transactions for the same `cc_num` with `event_time <= alert.event_time` from `workspace.sentinel_silver.transactions`).
   - Return explicit `{ source: "databricks", table: "workspace.sentinel_gold.alerts", ... }` metadata on success and `503` with diagnostic details on SQL/config failure.
2. **Step 3B — Frontend Types & Realistic Mock Fixture (`app/frontend/src/types/alerts.ts`, `app/frontend/src/data/mockAlerts.ts`)**:
   - Define TypeScript interfaces (`GoldAlert`, `RuleEvidence`, `CardHistoryTransaction`, `DataSourceMode`) matching `GOLD_ALERTS_COLUMNS`.
   - Provide a small, realistic 5-alert mock fixture (`mockAlerts.ts`) with representative `RULE_01`, `RULE_02`, `RULE_03`, and multi-rule cases plus matching prior card transactions, clearly labeled with `source_file: "mock_preview_fixture"`.
3. **Step 3C — Investigation Workspace UI (`app/frontend/src/App.tsx`, `app/frontend/src/App.css`)**:
   - Replace the Phase 1 placeholder in `App.tsx` with the two-pane Investigation Workspace (header with explicit data-source badge/selector, filter bar, alert list, and alert detail panel with rule evidence + prior card history).
   - Keep component structure flat and easy to explain (no new UI libraries or state frameworks).
4. **Step 3D — Verification (`Developer → QA`)**:
   - Run `npm run lint` and `npm run build` in `app/frontend` to verify zero TypeScript or ESLint errors.
   - Verify Mock Preview mode and error states locally; verify live `workspace.sentinel_gold.alerts` query execution when deployed to Databricks Apps.

## Guardrails & Scope Boundaries

- Do **not** modify any pipeline notebooks (`pipelines/`, `scripts/`, `tests/`).
- Do **not** expose `is_fraud` anywhere in the backend SQL or frontend UI.
- Do **not** add analyst write-back/disposition tables or AI summary triggers in this step (keep those as the subsequent incremental steps once the core alert list + detail view is verified).

