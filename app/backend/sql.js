import { DBSQLClient } from "@databricks/sql";

export async function checkSqlConnection() {
  const {
    DATABRICKS_HOST,
    DATABRICKS_WAREHOUSE_ID,
    DATABRICKS_CLIENT_ID,
    DATABRICKS_CLIENT_SECRET
  } = process.env;

  if (
    !DATABRICKS_HOST ||
    !DATABRICKS_WAREHOUSE_ID ||
    !DATABRICKS_CLIENT_ID ||
    !DATABRICKS_CLIENT_SECRET
  ) {
    const required = {
      DATABRICKS_HOST,
      DATABRICKS_WAREHOUSE_ID,
      DATABRICKS_CLIENT_ID,
      DATABRICKS_CLIENT_SECRET
    };

    const missing = Object.entries(required)
      .filter(([, value]) => !value)
      .map(([name]) => name);

    throw new Error(`Missing configuration: ${missing.join(", ")}`);
  }

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

    operation = await session.executeStatement(
      "SELECT 1 AS connection_check",
      { runAsync: true }
    );

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