export async function checkAiConnection() {
  const {
    DATABRICKS_HOST,
    DATABRICKS_CLIENT_ID,
    DATABRICKS_CLIENT_SECRET,
    SENTINEL_AI_MODEL
  } = process.env;

  const required = {
    DATABRICKS_HOST,
    DATABRICKS_CLIENT_ID,
    DATABRICKS_CLIENT_SECRET,
    SENTINEL_AI_MODEL
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing configuration: ${missing.join(", ")}`);
  }

  const workspaceUrl = new URL(
    DATABRICKS_HOST.startsWith("https://")
      ? DATABRICKS_HOST
      : `https://${DATABRICKS_HOST}`
  ).origin;

  // Authenticate using Sentinel's app identity.
  const tokenResponse = await fetch(`${workspaceUrl}/oidc/v1/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${DATABRICKS_CLIENT_ID}:${DATABRICKS_CLIENT_SECRET}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "all-apis"
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!tokenResponse.ok) {
    throw new Error(`OAuth request failed: HTTP ${tokenResponse.status}`);
  }

  const token = await tokenResponse.json();

  if (!token.access_token) {
    throw new Error("OAuth response did not contain an access token");
  }

  // Ask the model to respond to a fixed connectivity test.
  const aiResponse = await fetch(
    `${workspaceUrl}/ai-gateway/mlflow/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: SENTINEL_AI_MODEL,
        messages: [
          {
            role: "user",
            content: "Reply with exactly: Sentinel AI connection test successful."
          }
        ],
        max_tokens: 1000
      }),
      signal: AbortSignal.timeout(90000)
    }
  );

  if (!aiResponse.ok) {
    throw new Error(`AI request failed: HTTP ${aiResponse.status}`);
  }

  const result = await aiResponse.json();
  const text = result.choices?.[0]?.message?.content;

  if (typeof text !== "string" || !text.trim()) {
    throw new Error("AI response did not contain text");
  }

  return {
    model: SENTINEL_AI_MODEL,
    response: text.trim()
  };
}