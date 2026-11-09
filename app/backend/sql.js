import { DBSQLClient, DBSQLParameter } from "@databricks/sql";

export const GOLD_ALERTS_TABLE = "workspace.sentinel_gold.alerts";
export const SILVER_TRANSACTIONS_TABLE = "workspace.sentinel_silver.transactions";

export const ALLOWED_RULE_IDS = new Set([
  "RULE_01_CARD_VELOCITY_1H",
  "RULE_02_UNUSUAL_AMOUNT_14D",
  "RULE_03_REPEATED_SIMILAR_MERCHANT_1H"
]);

export const DEFAULT_ALERTS_LIMIT = 50;
export const MAX_ALERTS_LIMIT = 200;
export const DEFAULT_HISTORY_LIMIT = 25;
export const MAX_HISTORY_LIMIT = 100;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALERT_ID_PATTERN = /^[a-f0-9]{64}$/i;

function getRequiredSqlConfig() {
  const {
    DATABRICKS_HOST,
    DATABRICKS_WAREHOUSE_ID,
    DATABRICKS_CLIENT_ID,
    DATABRICKS_CLIENT_SECRET
  } = process.env;

  const required = {
    DATABRICKS_HOST,
    DATABRICKS_WAREHOUSE_ID,
    DATABRICKS_CLIENT_ID,
    DATABRICKS_CLIENT_SECRET
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing configuration: ${missing.join(", ")}`);
  }

  return required;
}

/**
 * Execute a parameterized read-only SQL statement against the Databricks SQL Warehouse.
 * Named parameters use `:paramName` syntax in SQL and `DBSQLParameter` bindings.
 */
export async function executeSqlStatement(statement, namedParameters = {}) {
  const {
    DATABRICKS_HOST,
    DATABRICKS_WAREHOUSE_ID,
    DATABRICKS_CLIENT_ID,
    DATABRICKS_CLIENT_SECRET
  } = getRequiredSqlConfig();

  const client = new DBSQLClient();
  let session;
  let operation;

  try {
    await client.connect({
      host: new URL(
        DATABRICKS_HOST.startsWith("https://")
          ? DATABRICKS_HOST
          : `https://${DATABRICKS_HOST}`
      ).hostname,
      path: `/sql/1.0/warehouses/${DATABRICKS_WAREHOUSE_ID}`,
      authType: "databricks-oauth",
      oauthClientId: DATABRICKS_CLIENT_ID,
      oauthClientSecret: DATABRICKS_CLIENT_SECRET
    });

    session = await client.openSession();

    const boundParameters = {};
    for (const [key, value] of Object.entries(namedParameters)) {
      boundParameters[key] =
        value instanceof DBSQLParameter ? value : new DBSQLParameter({ value });
    }

    const options = { runAsync: true };
    if (Object.keys(boundParameters).length > 0) {
      options.namedParameters = boundParameters;
    }

    operation = await session.executeStatement(statement, options);
    return await operation.fetchAll();
  } finally {
    // Attempt every cleanup even if an earlier close fails.
    for (const resource of [operation, session, client]) {
      if (resource) {
        try {
          await resource.close();
        } catch {
          console.error("SQL resource cleanup failed");
        }
      }
    }
  }
}

export async function checkSqlConnection() {
  return executeSqlStatement("SELECT 1 AS connection_check");
}

function parseCappedLimit(rawLimit, defaultLimit, maxLimit) {
  if (rawLimit === undefined || rawLimit === null || rawLimit === "") {
    return defaultLimit;
  }

  const parsed = Number(rawLimit);
  if (!Number.isInteger(parsed) || parsed < 1) {
    const error = new Error(
      `Invalid limit parameter: must be a positive integer between 1 and ${maxLimit}.`
    );
    error.statusCode = 400;
    throw error;
  }

  return Math.min(parsed, maxLimit);
}

function validateIsoDate(dateString, fieldName) {
  if (!ISO_DATE_PATTERN.test(dateString)) {
    const error = new Error(
      `Invalid ${fieldName} parameter: expected YYYY-MM-DD.`
    );
    error.statusCode = 400;
    throw error;
  }

  const parsed = new Date(`${dateString}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== dateString
  ) {
    const error = new Error(
      `Invalid ${fieldName} parameter: must be a valid calendar date (YYYY-MM-DD).`
    );
    error.statusCode = 400;
    throw error;
  }

  return dateString;
}

/**
 * Validate and normalize query parameters for GET /api/alerts.
 */
export function parseAlertListFilters(query = {}) {
  const filters = {
    ruleId: null,
    multiRuleOnly: false,
    startDate: null,
    endDate: null,
    search: null,
    limit: parseCappedLimit(query.limit, DEFAULT_ALERTS_LIMIT, MAX_ALERTS_LIMIT)
  };

  if (query.ruleId !== undefined && query.ruleId !== "") {
    const ruleId = String(query.ruleId).trim();
    if (ruleId === "MULTI_RULE") {
      filters.multiRuleOnly = true;
    } else if (ALLOWED_RULE_IDS.has(ruleId)) {
      filters.ruleId = ruleId;
    } else {
      const error = new Error(
        "Invalid ruleId parameter: expected a valid monitoring rule ID or MULTI_RULE."
      );
      error.statusCode = 400;
      throw error;
    }
  }

  if (query.multiRule === "true" || query.multiRule === "1") {
    filters.multiRuleOnly = true;
  }

  if (query.startDate !== undefined && query.startDate !== "") {
    filters.startDate = validateIsoDate(
      String(query.startDate).trim(),
      "startDate"
    );
  }

  if (query.endDate !== undefined && query.endDate !== "") {
    filters.endDate = validateIsoDate(String(query.endDate).trim(), "endDate");
  }

  if (
    filters.startDate &&
    filters.endDate &&
    filters.startDate > filters.endDate
  ) {
    const error = new Error(
      "Invalid date range: startDate must be on or before endDate."
    );
    error.statusCode = 400;
    throw error;
  }

  if (query.search !== undefined && query.search !== "") {
    const trimmed = String(query.search).trim();
    if (trimmed.length > 100) {
      const error = new Error(
        "Invalid search parameter: maximum length is 100 characters."
      );
      error.statusCode = 400;
      throw error;
    }
    if (trimmed.length > 0) {
      filters.search = trimmed.toLowerCase();
    }
  }

  return filters;
}

/**
 * Validate alertId path parameter and history limit for GET /api/alerts/:alertId/history.
 */
export function parseAlertHistoryParams(rawAlertId, query = {}) {
  const alertId = String(rawAlertId ?? "").trim().toLowerCase();
  if (!ALERT_ID_PATTERN.test(alertId)) {
    const error = new Error(
      "Invalid alertId parameter: expected a 64-character hexadecimal SHA-256 identifier."
    );
    error.statusCode = 400;
    throw error;
  }

  const limit = parseCappedLimit(
    query.limit,
    DEFAULT_HISTORY_LIMIT,
    MAX_HISTORY_LIMIT
  );

  return { alertId, limit };
}

function parseJsonArrayField(rawJson, fallback = []) {
  if (Array.isArray(rawJson)) {
    return rawJson;
  }
  if (typeof rawJson !== "string" || !rawJson.trim()) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(rawJson);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Normalize a Gold alert row returned by SQL so decimal strings and
 * timezone-unspecified timestamps are preserved without floating-point or timezone drift.
 */
export function normalizeGoldAlertRow(row) {
  return {
    alert_id: String(row.alert_id),
    trans_num: String(row.trans_num),
    ruleset_version: String(row.ruleset_version),
    event_time: String(row.event_time),
    cc_num: String(row.cc_num),
    merchant: String(row.merchant),
    category: row.category !== null && row.category !== undefined ? String(row.category) : null,
    amount: String(row.amount),
    replay_batch: String(row.replay_batch),
    source_file: String(row.source_file),
    source_row_index: String(row.source_row_index),
    card_txn_count_1h: Number(row.card_txn_count_1h),
    card_txn_count_14d: Number(row.card_txn_count_14d),
    card_avg_amount_14d:
      row.card_avg_amount_14d !== null && row.card_avg_amount_14d !== undefined
        ? String(row.card_avg_amount_14d)
        : null,
    unusual_amount_threshold_14d:
      row.unusual_amount_threshold_14d !== null &&
      row.unusual_amount_threshold_14d !== undefined
        ? String(row.unusual_amount_threshold_14d)
        : null,
    card_merchant_txn_count_1h: Number(row.card_merchant_txn_count_1h),
    card_merchant_similar_amount_count_1h: Number(
      row.card_merchant_similar_amount_count_1h
    ),
    similar_amount_lower_bound: String(row.similar_amount_lower_bound),
    similar_amount_upper_bound: String(row.similar_amount_upper_bound),
    matched_rule_count: Number(row.matched_rule_count),
    matched_rule_ids: parseJsonArrayField(row.matched_rule_ids_json),
    matched_rule_versions: parseJsonArrayField(row.matched_rule_versions_json),
    rule_evidence: parseJsonArrayField(row.rule_evidence_json)
  };
}

export function normalizeHistoryRow(row) {
  return {
    trans_num: String(row.trans_num),
    cc_num: String(row.cc_num),
    merchant: String(row.merchant),
    category: row.category !== null && row.category !== undefined ? String(row.category) : null,
    amount: String(row.amount),
    event_time: String(row.event_time),
    replay_batch: String(row.replay_batch),
    source_file: String(row.source_file),
    source_row_index: String(row.source_row_index)
  };
}

const ALERT_SELECT_PROJECTION = `
  alert_id,
  trans_num,
  ruleset_version,
  DATE_FORMAT(event_time, 'yyyy-MM-dd HH:mm:ss') AS event_time,
  cc_num,
  merchant,
  category,
  CAST(CAST(amount AS DECIMAL(18, 2)) AS STRING) AS amount,
  DATE_FORMAT(replay_batch, 'yyyy-MM-dd') AS replay_batch,
  source_file,
  source_row_index,
  CAST(card_txn_count_1h AS INT) AS card_txn_count_1h,
  CAST(card_txn_count_14d AS INT) AS card_txn_count_14d,
  CAST(CAST(card_avg_amount_14d AS DECIMAL(18, 2)) AS STRING) AS card_avg_amount_14d,
  CAST(CAST(unusual_amount_threshold_14d AS DECIMAL(18, 2)) AS STRING) AS unusual_amount_threshold_14d,
  CAST(card_merchant_txn_count_1h AS INT) AS card_merchant_txn_count_1h,
  CAST(card_merchant_similar_amount_count_1h AS INT) AS card_merchant_similar_amount_count_1h,
  CAST(CAST(similar_amount_lower_bound AS DECIMAL(18, 2)) AS STRING) AS similar_amount_lower_bound,
  CAST(CAST(similar_amount_upper_bound AS DECIMAL(18, 2)) AS STRING) AS similar_amount_upper_bound,
  CAST(matched_rule_count AS INT) AS matched_rule_count,
  TO_JSON(matched_rule_ids) AS matched_rule_ids_json,
  TO_JSON(matched_rule_versions) AS matched_rule_versions_json,
  TO_JSON(rule_evidence) AS rule_evidence_json
`;

/**
 * Fetch filtered Gold alerts from workspace.sentinel_gold.alerts.
 * Fraud labels are never queried or returned.
 */
export async function fetchGoldAlerts(rawQuery = {}, executeFn = executeSqlStatement) {
  const filters = parseAlertListFilters(rawQuery);
  const whereClauses = [];
  const params = {
    limit: filters.limit
  };

  if (filters.ruleId) {
    whereClauses.push("ARRAY_CONTAINS(matched_rule_ids, :ruleId)");
    params.ruleId = filters.ruleId;
  }

  if (filters.multiRuleOnly) {
    whereClauses.push("matched_rule_count > 1");
  }

  if (filters.startDate) {
    whereClauses.push("replay_batch >= CAST(:startDate AS DATE)");
    params.startDate = filters.startDate;
  }

  if (filters.endDate) {
    whereClauses.push("replay_batch <= CAST(:endDate AS DATE)");
    params.endDate = filters.endDate;
  }

  if (filters.search) {
    whereClauses.push(
      "(LOWER(trans_num) LIKE :searchPattern OR LOWER(cc_num) LIKE :searchPattern OR LOWER(merchant) LIKE :searchPattern)"
    );
    params.searchPattern = `%${filters.search}%`;
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const statement = `
    SELECT
      ${ALERT_SELECT_PROJECTION}
    FROM ${GOLD_ALERTS_TABLE}
    ${whereSql}
    ORDER BY event_time DESC, trans_num ASC
    LIMIT :limit
  `;

  const rows = await executeFn(statement, params);
  return {
    alerts: rows.map(normalizeGoldAlertRow),
    appliedFilters: filters
  };
}

/**
 * Fetch a single Gold alert and its strictly earlier card transaction history
 * (event_time < alert.event_time) from workspace.sentinel_silver.transactions.
 */
export async function fetchAlertHistory(
  rawAlertId,
  rawQuery = {},
  executeFn = executeSqlStatement
) {
  const { alertId, limit } = parseAlertHistoryParams(rawAlertId, rawQuery);

  const alertStatement = `
    SELECT
      ${ALERT_SELECT_PROJECTION}
    FROM ${GOLD_ALERTS_TABLE}
    WHERE LOWER(alert_id) = :alertId
    LIMIT 1
  `;

  const alertRows = await executeFn(alertStatement, { alertId });
  if (alertRows.length === 0) {
    return null;
  }

  const alert = normalizeGoldAlertRow(alertRows[0]);

  // Strictly earlier transactions only (event_time < alert.event_time)
  // matching the historical feature window semantics in pipelines/03_historical_features.ipynb.
  const historyStatement = `
    SELECT
      trans_num,
      cc_num,
      merchant,
      category,
      CAST(CAST(amount AS DECIMAL(18, 2)) AS STRING) AS amount,
      DATE_FORMAT(event_time, 'yyyy-MM-dd HH:mm:ss') AS event_time,
      DATE_FORMAT(replay_batch, 'yyyy-MM-dd') AS replay_batch,
      source_file,
      source_row_index
    FROM ${SILVER_TRANSACTIONS_TABLE}
    WHERE cc_num = :ccNum
      AND event_time < CAST(:alertEventTime AS TIMESTAMP_NTZ)
    ORDER BY event_time DESC, trans_num ASC
    LIMIT :limit
  `;

  const historyRows = await executeFn(historyStatement, {
    ccNum: alert.cc_num,
    alertEventTime: alert.event_time,
    limit
  });

  return {
    alert,
    history: historyRows.map(normalizeHistoryRow),
    limit
  };
}
