import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkSqlConnection } from "./sql.js";

const app = express();

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(
  currentDirectory,
  "../frontend/dist"
);

// This endpoint verifies the web server only.
// SQL and AI connectivity will have separate checks.
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
    console.error("SQL connectivity check failed:", error.message);

    response.status(503).json({
      status: "unavailable",
      message: "SQL connectivity check failed. Check the app logs."
    });
  }
});


// Serve the compiled React application.
app.use(express.static(frontendDirectory));

const port = Number(
  process.env.DATABRICKS_APP_PORT ?? process.env.PORT ?? 8000
);

app.listen(port, "0.0.0.0", () => {
  console.log(`Sentinel is listening on port ${port}`);
});