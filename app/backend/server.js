import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkAiConnection,
  generateAlertEvidenceSummary,
  SUMMARY_HISTORY_LIMIT
} from "./ai.js";
import { askSentinelGenie } from "./genie.js";
import {
  checkSqlConnection,
  fetchAlertHistory,
  fetchGoldAlerts,
  GOLD_ALERTS_TABLE,
  SILVER_TRANSACTIONS_TABLE
} from "./sql.js";

const app = express();
app.use(express.json({ limit: "16kb" }));

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(
  currentDirectory,
  "../frontend/dist"
);

function handleSqlRouteError(routeLabel, error, response) {
  if (error?.statusCode === 400) {
    return response.status(400).json({
      status: "invalid_request",
      message: error.message
    });
  }

  console.error(`${routeLabel} failed:`, error);

  const isConfigurationError =
    typeof error?.message === "string" &&
    error.message.startsWith("Missing configuration:");

  return response.status(503).json({
    status: "unavailable",
    errorType: error?.name ?? "Error",
    errorCode: String(error?.code ?? "UNKNOWN"),
    message: isConfigurationError
      ? error.message
      : "Configuration is present, but SQL authentication or query execution failed."
  });
}

// This endpoint verifies the web server only.
// SQL and AI connectivity have separate checks.
app.get("/api/health", (_request, response) => {
  response.json({
    service: "sentinel",
    status: "ok"
  });
});

app.get("/api/health/sql", async (_request, response) => {
  response.set("Cache-Control", "no-store");

  try {
    const rows = await checkSqlConnection();

    response.json({
      status: "ok",
      connectionCheck: rows[0].connection_check
    });
  } catch (error) {
    handleSqlRouteError("SQL connectivity check", error, response);
  }
});

// Read-only alert list from workspace.sentinel_gold.alerts.
app.get("/api/alerts", async (request, response) => {
  response.set("Cache-Control", "no-store");

  try {
    const { alerts, appliedFilters } = await fetchGoldAlerts(request.query);

    response.json({
      status: "ok",
      source: "databricks",
      table: GOLD_ALERTS_TABLE,
      count: alerts.length,
      filters: appliedFilters,
      alerts
    });
  } catch (error) {
    handleSqlRouteError("GET /api/alerts", error, response);
  }
});

// Read-only selected alert details and strictly earlier card history (event_time < alert.event_time).
app.get("/api/alerts/:alertId/history", async (request, response) => {
  response.set("Cache-Control", "no-store");

  try {
    const result = await fetchAlertHistory(
      request.params.alertId,
      request.query
    );

    if (!result) {
      return response.status(404).json({
        status: "not_found",
        message: "Alert not found in workspace.sentinel_gold.alerts."
      });
    }

    return response.json({
      status: "ok",
      source: "databricks",
      alertTable: GOLD_ALERTS_TABLE,
      historyTable: SILVER_TRANSACTIONS_TABLE,
      historyWindow: "event_time < alert.event_time",
      limit: result.limit,
      alert: result.alert,
      historyCount: result.history.length,
      history: result.history
    });
  } catch (error) {
    return handleSqlRouteError(
      "GET /api/alerts/:alertId/history",
      error,
      response
    );
  }
});

// Read-only AI evidence summary for a selected alert and its limited earlier card history.
app.post("/api/alerts/:alertId/summary", async (request, response) => {
  response.set("Cache-Control", "no-store");

  try {
    const result = await fetchAlertHistory(request.params.alertId, {
      limit: SUMMARY_HISTORY_LIMIT
    });

    if (!result) {
      return response.status(404).json({
        status: "not_found",
        message: "Alert not found in workspace.sentinel_gold.alerts."
      });
    }

    const aiResult = await generateAlertEvidenceSummary(
      result.alert,
      result.history,
      { historyLimit: result.limit }
    );

    return response.json({
      status: "ok",
      alertId: result.alert.alert_id,
      model: aiResult.model,
      historyWindow: "event_time < alert.event_time",
      historyCount: result.history.length,
      historyLimit: result.limit,
      summary: aiResult.summary
    });
  } catch (error) {
    if (error?.statusCode === 400) {
      return response.status(400).json({
        status: "invalid_request",
        message: error.message
      });
    }

    console.error("POST /api/alerts/:alertId/summary failed:", error);

    const isConfigurationError =
      typeof error?.message === "string" &&
      error.message.startsWith("Missing configuration:");

    return response.status(503).json({
      status: "unavailable",
      message: isConfigurationError
        ? error.message
        : "Unable to generate AI evidence summary. Check SQL and AI model endpoint configuration."
    });
  }
});

// Ask Genie Conversation API endpoint (start conversation or follow-up question).
app.post("/api/genie/ask", async (request, response) => {
  response.set("Cache-Control", "no-store");

  try {
    const genieResult = await askSentinelGenie(request.body);

    return response.json({
      status: "ok",
      source: "databricks_genie",
      aiGenerated: true,
      ...genieResult
    });
  } catch (error) {
    if (error?.statusCode === 400) {
      return response.status(400).json({
        status: "invalid_request",
        message: error.message
      });
    }

    console.error("POST /api/genie/ask failed:", error);

    const isConfigurationError =
      typeof error?.message === "string" &&
      error.message.startsWith("Missing configuration:");

    return response.status(503).json({
      status: "unavailable",
      message: isConfigurationError
        ? error.message
        : "Unable to complete Genie request. Check SENTINEL_GENIE_SPACE_ID and Genie space permissions."
    });
  }
});

app.post("/api/checks/ai", async (_request, response) => {
  response.set("Cache-Control", "no-store");

  try {
    const result = await checkAiConnection();

    response.json({
      status: "ok",
      ...result
    });
  } catch (error) {
    console.error("AI connectivity check failed:", error.message);

    response.status(503).json({
      status: "unavailable",
      message: error.message
    });
  }
});

// Serve the compiled React application.
app.use(express.static(frontendDirectory));

const port = Number(
  process.env.DATABRICKS_APP_PORT ?? process.env.PORT ?? 8000
);

if (process.env.NODE_ENV !== "test") {
  app.listen(port, "0.0.0.0", () => {
    console.log(`Sentinel is listening on port ${port}`);
  });
}

export { app };
