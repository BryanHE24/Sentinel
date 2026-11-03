import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

// Serve the compiled React application.
app.use(express.static(frontendDirectory));

const port = Number(
  process.env.DATABRICKS_APP_PORT ?? process.env.PORT ?? 8000
);

app.listen(port, "0.0.0.0", () => {
  console.log(`Sentinel is listening on port ${port}`);
});