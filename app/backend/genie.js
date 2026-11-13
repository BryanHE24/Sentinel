import { fetchDatabricksWorkspaceAuth } from "./ai.js";

export const MAX_GENIE_QUESTION_LENGTH = 500;
export const MAX_GENIE_RESULT_ROWS = 20;
export const DEFAULT_GENIE_TIMEOUT_MS = 60000;
export const DEFAULT_GENIE_POLL_MS = 1500;

const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const TERMINAL_FAILURE_STATUSES = new Set([
  "FAILED",
  "CANCELLED",
  "CANCELED",
  "QUERY_RESULT_EXPIRED"
]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate and normalize the incoming { question, conversationId } request body.
 */
export function validateGenieQuestionPayload(body = {}) {
  const rawQuestion = body?.question;
  if (typeof rawQuestion !== "string" || !rawQuestion.trim()) {
    const error = new Error("Question is required.");
    error.statusCode = 400;
    throw error;
  }

  const question = rawQuestion.trim();
  if (question.length > MAX_GENIE_QUESTION_LENGTH) {
    const error = new Error(
      `Question is too long (maximum ${MAX_GENIE_QUESTION_LENGTH} characters).`
    );
    error.statusCode = 400;
    throw error;
  }

  let conversationId = null;
  if (
    body?.conversationId !== undefined &&
    body?.conversationId !== null &&
    body?.conversationId !== ""
  ) {
    const trimmedId = String(body.conversationId).trim();
    if (!SAFE_ID_PATTERN.test(trimmedId)) {
      const error = new Error("Invalid conversationId parameter.");
      error.statusCode = 400;
      throw error;
    }
    conversationId = trimmedId;
  }

  return { question, conversationId };
}

/**
 * Extract plain-text answer, generated SQL, and query attachment ID from a completed Genie message.
 */
export function parseGenieCompletedMessage(message = {}) {
  const attachments = Array.isArray(message.attachments)
    ? message.attachments
    : [];

  const textParts = [];
  let sql = null;
  let queryDescription = null;
  let queryAttachmentId = null;

  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== "object") {
      continue;
    }

    const textContent =
      typeof attachment.text === "string"
        ? attachment.text.trim()
        : typeof attachment.text?.content === "string"
          ? attachment.text.content.trim()
          : "";

    if (textContent) {
      textParts.push(textContent);
    }

    if (attachment.query && typeof attachment.query === "object") {
      if (!sql && typeof attachment.query.query === "string") {
        sql = attachment.query.query.trim();
      }
      if (
        !queryDescription &&
        typeof attachment.query.description === "string"
      ) {
        queryDescription = attachment.query.description.trim();
      }
      const candidateAttachmentId =
        attachment.attachment_id ?? attachment.id ?? null;
      if (!queryAttachmentId && candidateAttachmentId) {
        queryAttachmentId = String(candidateAttachmentId);
      }
    }
  }

  let answer = textParts.join("\n\n").trim();
  if (!answer && queryDescription) {
    answer = queryDescription;
  }
  if (!answer && sql) {
    answer = "Genie generated a SQL query and retrieved the results below.";
  }
  if (!answer && typeof message.content === "string" && message.content.trim()) {
    answer = message.content.trim();
  }
  if (!answer) {
    answer = "Genie completed the request without returning a text explanation.";
  }

  return {
    answer,
    sql,
    queryAttachmentId
  };
}

/**
 * Normalize the Genie query-result payload (statement_response) into
 * { columns, rows, displayedRowCount, totalRowCount, rowCap } capped at MAX_GENIE_RESULT_ROWS.
 */
export function normalizeGenieQueryResult(
  payload = {},
  rowCap = MAX_GENIE_RESULT_ROWS
) {
  const statementResponse = payload?.statement_response ?? payload ?? {};
  const rawColumns =
    statementResponse?.manifest?.schema?.columns ??
    statementResponse?.schema?.columns ??
    [];

  const columns = Array.isArray(rawColumns)
    ? rawColumns.map((col, idx) =>
        typeof col?.name === "string" && col.name.trim()
          ? col.name.trim()
          : `column_${idx + 1}`
      )
    : [];

  const rawDataArray =
    statementResponse?.result?.data_array ??
    statementResponse?.data_array ??
    [];

  const allRows = Array.isArray(rawDataArray) ? rawDataArray : [];
  const totalRowCount =
    typeof statementResponse?.manifest?.total_row_count === "number"
      ? statementResponse.manifest.total_row_count
      : allRows.length;

  const rows = allRows.slice(0, rowCap).map((row) =>
    Array.isArray(row)
      ? row.map((cell) =>
          cell === null || cell === undefined ? null : String(cell)
        )
      : []
  );

  return {
    columns,
    rows,
    displayedRowCount: rows.length,
    totalRowCount,
    rowCap
  };
}

/**
 * Start or continue a Databricks Genie conversation, wait for completion
 * with a bounded timeout, and retrieve the answer, generated SQL, and query results.
 */
export async function askSentinelGenie(
  rawBody = {},
  {
    fetchFn = fetch,
    timeoutMs = DEFAULT_GENIE_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_GENIE_POLL_MS
  } = {}
) {
  const { question, conversationId } = validateGenieQuestionPayload(rawBody);
  const { SENTINEL_GENIE_SPACE_ID } = process.env;

  const { workspaceUrl, accessToken } = await fetchDatabricksWorkspaceAuth(
    fetchFn,
    { SENTINEL_GENIE_SPACE_ID }
  );

  const spaceId = encodeURIComponent(SENTINEL_GENIE_SPACE_ID.trim());
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  };

  // Step 1: Start a new conversation or post a follow-up message in the active conversation.
  const submitUrl = conversationId
    ? `${workspaceUrl}/api/2.0/genie/spaces/${spaceId}/conversations/${encodeURIComponent(
        conversationId
      )}/messages`
    : `${workspaceUrl}/api/2.0/genie/spaces/${spaceId}/start-conversation`;

  const submitResponse = await fetchFn(submitUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ content: question }),
    signal: AbortSignal.timeout(30000)
  });

  if (!submitResponse.ok) {
    throw new Error(
      `Genie message submission failed: HTTP ${submitResponse.status}`
    );
  }

  const submitData = await submitResponse.json();
  const activeConversationId =
    submitData.conversation_id ??
    submitData.message?.conversation_id ??
    submitData.conversation?.id ??
    conversationId;
  const messageId =
    submitData.message_id ??
    submitData.id ??
    submitData.message?.id ??
    submitData.message?.message_id;

  if (!activeConversationId || !messageId) {
    throw new Error(
      "Genie response did not include a conversation_id and message_id."
    );
  }

  // Step 2: Poll message status until COMPLETED, FAILED, or bounded timeout expires.
  const deadline = Date.now() + timeoutMs;
  const messageUrl = `${workspaceUrl}/api/2.0/genie/spaces/${spaceId}/conversations/${encodeURIComponent(
    activeConversationId
  )}/messages/${encodeURIComponent(messageId)}`;

  let completedMessage = null;
  let lastStatus = submitData.status ?? "SUBMITTED";

  while (Date.now() <= deadline) {
    const statusResponse = await fetchFn(messageUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20000)
    });

    if (!statusResponse.ok) {
      throw new Error(
        `Genie status check failed: HTTP ${statusResponse.status}`
      );
    }

    const messageData = await statusResponse.json();
    lastStatus = messageData.status ?? "UNKNOWN";

    if (lastStatus === "COMPLETED") {
      completedMessage = messageData;
      break;
    }

    if (TERMINAL_FAILURE_STATUSES.has(lastStatus)) {
      const reason =
        messageData.error?.message ??
        messageData.error?.error ??
        `Genie finished with status ${lastStatus}.`;
      throw new Error(reason);
    }

    if (Date.now() + pollIntervalMs > deadline) {
      break;
    }

    await delay(pollIntervalMs);
  }

  if (!completedMessage) {
    throw new Error(
      `Genie request timed out after ${Math.round(
        timeoutMs / 1000
      )}s (last status: ${lastStatus}).`
    );
  }

  // Step 3: Parse answer text, generated SQL, and optional query attachment ID.
  const { answer, sql, queryAttachmentId } =
    parseGenieCompletedMessage(completedMessage);

  // Step 4: Retrieve available query results from the Genie attachment without re-executing SQL.
  let queryResult = {
    columns: [],
    rows: [],
    displayedRowCount: 0,
    totalRowCount: 0,
    rowCap: MAX_GENIE_RESULT_ROWS
  };

  if (queryAttachmentId || sql) {
    const queryResultUrl = queryAttachmentId
      ? `${messageUrl}/attachments/${encodeURIComponent(
          queryAttachmentId
        )}/query-result`
      : `${messageUrl}/query-result`;

    try {
      const resultResponse = await fetchFn(queryResultUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(30000)
      });

      if (resultResponse.ok) {
        const resultPayload = await resultResponse.json();
        queryResult = normalizeGenieQueryResult(
          resultPayload,
          MAX_GENIE_RESULT_ROWS
        );
      }
    } catch {
      // Keep the text answer and generated SQL even if no tabular result is available.
    }
  }

  return {
    conversationId: String(activeConversationId),
    messageId: String(messageId),
    question,
    answer,
    sql,
    ...queryResult
  };
}
