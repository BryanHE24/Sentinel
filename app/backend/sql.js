import { DBSQLClient, DBSQLParameter } from "@databricks/sql";

export const GOLD_ALERTS_TABLE = "workspace.sentinel_gold.alerts";
export const GOLD_ALERT_REVIEWS_TABLE = "workspace.sentinel_gold.alert_reviews";
export const SILVER_TRANSACTIONS_TABLE = "workspace.sentinel_silver.transactions";

export const ALLOWED_RULE_IDS = new Set([
  "RULE_01_CARD_VELOCITY_1H",
  "RULE_02_UNUSUAL_AMOUNT_14D",
  "RULE_03_REPEATED_SIMILAR_MERCHANT_1H"
]);

export const DEFAULT_REVIEW_STATUS = "Needs review";
export const ALLOWED_REVIEW_STATUSES = new Set([
  "Needs review",
  "In review",
  "Closed"
]);
export const MAX_REVIEW_NOTES_LENGTH = 2000;

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
 * Execute a parameterized SQL statement against the Databricks SQL Warehouse.
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

export function validateAlertId(rawAlertId) {
  const alertId = String(rawAlertId ?? "").trim().toLowerCase();
  if (!ALERT_ID_PATTERN.test(alertId)) {
    const error = new Error(
      "Invalid alertId parameter: expected a 64-character hexadecimal SHA-256 identifier."
    );
    error.statusCode = 400;
    throw error;
  }
  return alertId;
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
  const alertId = validateAlertId(rawAlertId);

  const limit = parseCappedLimit(
    query.limit,
    DEFAULT_HISTORY_LIMIT,
    MAX_HISTORY_LIMIT
  );

  return { alertId, limit };
}

/**
 * Validate alertId, reviewStatus, and reviewNotes for PUT /api/alerts/:alertId/review.
 */
export function parseAlertReviewInput(rawAlertId, body = {}) {
  const alertId = validateAlertId(rawAlertId);

  const rawStatus = body?.reviewStatus ?? body?.review_status;
  const reviewStatus =
    typeof rawStatus === "string" ? rawStatus.trim() : "";

  if (!ALLOWED_REVIEW_STATUSES.has(reviewStatus)) {
    const error = new Error(
      "Invalid reviewStatus parameter: expected 'Needs review', 'In review', or 'Closed'."
    );
    error.statusCode = 400;
    throw error;
  }

  const rawNotes = body?.reviewNotes ?? body?.review_notes ?? "";
  if (typeof rawNotes !== "string") {
    const error = new Error(
      "Invalid reviewNotes parameter: expected a text string."
    );
    error.statusCode = 400;
    throw error;
  }

  const reviewNotes = rawNotes.trim();
  if (reviewNotes.length > MAX_REVIEW_NOTES_LENGTH) {
    const error = new Error(
      `Invalid reviewNotes parameter: maximum length is ${MAX_REVIEW_NOTES_LENGTH} characters.`
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    alertId,
    reviewStatus,
    reviewNotes
  };
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
  const rawStatus =
    row.review_status !== null && row.review_status !== undefined
      ? String(row.review_status)
      : DEFAULT_REVIEW_STATUS;

  return {
    alert_id: String(row.alert_id),
    trans_num: String(row.trans_num),
    ruleset_version: String(row.ruleset_version),
    event_time: String(row.event_time),
    cc_num: String(row.cc_num),
    merchant: String(row.merchant),
    category:
      row.category !== null && row.category !== undefined
        ? String(row.category)
        : null,
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
    rule_evidence: parseJsonArrayField(row.rule_evidence_json),
    review_status: ALLOWED_REVIEW_STATUSES.has(rawStatus)
      ? rawStatus
      : DEFAULT_REVIEW_STATUS,
    review_notes:
      row.review_notes !== null && row.review_notes !== undefined
        ? String(row.review_notes)
        : "",
    review_updated_at:
      row.review_updated_at !== null && row.review_updated_at !== undefined
        ? String(row.review_updated_at)
        : null
  };
}

export function normalizeHistoryRow(row) {
  return {
    trans_num: String(row.trans_num),
    cc_num: String(row.cc_num),
    merchant: String(row.merchant),
    category:
      row.category !== null && row.category !== undefined
        ? String(row.category)
        : null,
    amount: String(row.amount),
    event_time: String(row.event_time),
    replay_batch: String(row.replay_batch),
    source_file: String(row.source_file),
    source_row_index: String(row.source_row_index)
  };
}

const ALERT_SELECT_PROJECTION = `
  a.alert_id,
  a.trans_num,
  a.ruleset_version,
  DATE_FORMAT(a.event_time, 'yyyy-MM-dd HH:mm:ss') AS event_time,
  a.cc_num,
  a.merchant,
  a.category,
  CAST(CAST(a.amount AS DECIMAL(18, 2)) AS STRING) AS amount,
  DATE_FORMAT(a.replay_batch, 'yyyy-MM-dd') AS replay_batch,
  a.source_file,
  a.source_row_index,
  CAST(a.card_txn_count_1h AS INT) AS card_txn_count_1h,
  CAST(a.card_txn_count_14d AS INT) AS card_txn_count_14d,
  CAST(CAST(a.card_avg_amount_14d AS DECIMAL(18, 2)) AS STRING) AS card_avg_amount_14d,
  CAST(CAST(a.unusual_amount_threshold_14d AS DECIMAL(18, 2)) AS STRING) AS unusual_amount_threshold_14d,
  CAST(a.card_merchant_txn_count_1h AS INT) AS card_merchant_txn_count_1h,
  CAST(a.card_merchant_similar_amount_count_1h AS INT) AS card_merchant_similar_amount_count_1h,
  CAST(CAST(a.similar_amount_lower_bound AS DECIMAL(18, 2)) AS STRING) AS similar_amount_lower_bound,
  CAST(CAST(a.similar_amount_upper_bound AS DECIMAL(18, 2)) AS STRING) AS similar_amount_upper_bound,
  CAST(a.matched_rule_count AS INT) AS matched_rule_count,
  TO_JSON(a.matched_rule_ids) AS matched_rule_ids_json,
  TO_JSON(a.matched_rule_versions) AS matched_rule_versions_json,
  TO_JSON(a.rule_evidence) AS rule_evidence_json,
  COALESCE(r.review_status, '${DEFAULT_REVIEW_STATUS}') AS review_status,
  COALESCE(r.review_notes, '') AS review_notes,
  r.review_updated_at AS review_updated_at
`;

// Deduplicated subquery guarantees at most one review row per alert_id on join.
const LATEST_REVIEW_JOIN_SQL = `
  LEFT JOIN (
    SELECT
      LOWER(alert_id) AS alert_id_key,
      review_status,
      review_notes,
      DATE_FORMAT(updated_at, 'yyyy-MM-dd HH:mm:ss') AS review_updated_at
    FROM ${GOLD_ALERT_REVIEWS_TABLE}
    QUALIFY ROW_NUMBER() OVER (
      PARTITION BY LOWER(alert_id)
      ORDER BY updated_at DESC
    ) = 1
  ) AS r
    ON LOWER(a.alert_id) = r.alert_id_key
`;

/**
 * Fetch filtered Gold alerts from workspace.sentinel_gold.alerts joined with
 * current analyst review status from workspace.sentinel_gold.alert_reviews.
 * Fraud labels are never queried or returned.
 */
export async function fetchGoldAlerts(rawQuery = {}, executeFn = executeSqlStatement) {
  const filters = parseAlertListFilters(rawQuery);
  const whereClauses = [];
  const params = {
    limit: filters.limit
  };

  if (filters.ruleId) {
    whereClauses.push("ARRAY_CONTAINS(a.matched_rule_ids, :ruleId)");
    params.ruleId = filters.ruleId;
  }

  if (filters.multiRuleOnly) {
    whereClauses.push("a.matched_rule_count > 1");
  }

  if (filters.startDate) {
    whereClauses.push("a.replay_batch >= CAST(:startDate AS DATE)");
    params.startDate = filters.startDate;
  }

  if (filters.endDate) {
    whereClauses.push("a.replay_batch <= CAST(:endDate AS DATE)");
    params.endDate = filters.endDate;
  }

  if (filters.search) {
    whereClauses.push(
      "(LOWER(a.trans_num) LIKE :searchPattern OR LOWER(a.cc_num) LIKE :searchPattern OR LOWER(a.merchant) LIKE :searchPattern)"
    );
    params.searchPattern = `%${filters.search}%`;
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const statement = `
    SELECT
      ${ALERT_SELECT_PROJECTION}
    FROM ${GOLD_ALERTS_TABLE} AS a
    ${LATEST_REVIEW_JOIN_SQL}
    ${whereSql}
    ORDER BY a.event_time DESC, a.trans_num ASC
    LIMIT :limit
  `;

  const rows = await executeFn(statement, params);
  return {
    alerts: rows.map(normalizeGoldAlertRow),
    appliedFilters: filters
  };
}

/**
 * Fetch a single Gold alert (with its current review) and its strictly earlier
 * card transaction history (event_time < alert.event_time) from workspace.sentinel_silver.transactions.
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
    FROM ${GOLD_ALERTS_TABLE} AS a
    ${LATEST_REVIEW_JOIN_SQL}
    WHERE LOWER(a.alert_id) = :alertId
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

/**
 * Save or update one current analyst review row for an existing Gold alert
 * using parameterized MERGE INTO workspace.sentinel_gold.alert_reviews.
 */
export async function saveAlertReview(
  rawAlertId,
  rawBody = {},
  executeFn = executeSqlStatement
) {
  const { alertId, reviewStatus, reviewNotes } = parseAlertReviewInput(
    rawAlertId,
    rawBody
  );

  // Verify the alert exists in workspace.sentinel_gold.alerts before saving.
  const existsStatement = `
    SELECT alert_id
    FROM ${GOLD_ALERTS_TABLE}
    WHERE LOWER(alert_id) = :alertId
    LIMIT 1
  `;

  const existingAlerts = await executeFn(existsStatement, { alertId });
  if (existingAlerts.length === 0) {
    return null;
  }

  const canonicalAlertId = String(existingAlerts[0].alert_id);

  // Upsert one current review row per alert_id via MERGE INTO.
  const mergeStatement = `
    MERGE INTO ${GOLD_ALERT_REVIEWS_TABLE} AS target
    USING (
      SELECT
        :alertId AS alert_id,
        :reviewStatus AS review_status,
        :reviewNotes AS review_notes,
        CURRENT_TIMESTAMP() AS updated_at
    ) AS source
    ON LOWER(target.alert_id) = LOWER(source.alert_id)
    WHEN MATCHED THEN
      UPDATE SET
        target.review_status = source.review_status,
        target.review_notes = source.review_notes,
        target.updated_at = source.updated_at
    WHEN NOT MATCHED THEN
      INSERT (alert_id, review_status, review_notes, updated_at)
      VALUES (source.alert_id, source.review_status, source.review_notes, source.updated_at)
  `;

  await executeFn(mergeStatement, {
    alertId: canonicalAlertId,
    reviewStatus,
    reviewNotes
  });

  const selectSavedStatement = `
    SELECT
      alert_id,
      review_status,
      COALESCE(review_notes, '') AS review_notes,
      DATE_FORMAT(updated_at, 'yyyy-MM-dd HH:mm:ss') AS review_updated_at
    FROM ${GOLD_ALERT_REVIEWS_TABLE}
    WHERE LOWER(alert_id) = :alertId
    ORDER BY updated_at DESC
    LIMIT 1
  `;

  const savedRows = await executeFn(selectSavedStatement, { alertId });
  const saved = savedRows[0] ?? {
    alert_id: canonicalAlertId,
    review_status: reviewStatus,
    review_notes: reviewNotes,
    review_updated_at: null
  };

  return {
    alert_id: String(saved.alert_id),
    review_status: String(saved.review_status),
    review_notes: String(saved.review_notes ?? ""),
    review_updated_at:
      saved.review_updated_at !== null && saved.review_updated_at !== undefined
        ? String(saved.review_updated_at)
        : null
  };
}
