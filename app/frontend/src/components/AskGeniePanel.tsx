import { type FormEvent, useState } from "react";
import type { GenieAskResponse } from "../types/alerts";

async function readGenieError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    if (payload?.message) {
      return payload.message;
    }
  } catch {
    // Ignore non-JSON error body.
  }
  return `${fallback} (HTTP ${response.status})`;
}

export function AskGeniePanel() {
  const [question, setQuestion] = useState<string>("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [genieResult, setGenieResult] = useState<GenieAskResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/genie/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmed,
          conversationId,
        }),
      });

      if (!response.ok) {
        const message = await readGenieError(
          response,
          "Failed to query Databricks Genie"
        );
        throw new Error(message);
      }

      const data = (await response.json()) as GenieAskResponse;
      setGenieResult(data);
      setConversationId(data.conversationId);
      setQuestion("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to query Databricks Genie."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleNewConversation() {
    setConversationId(null);
    setGenieResult(null);
    setErrorMessage(null);
    setQuestion("");
  }

  return (
    <section className="panel genie-panel" aria-label="Ask Genie">
      <div className="panel-header">
        <div>
          <h2>Ask Genie</h2>
          <p className="subsection-subtitle">
            Ask natural-language questions about Sentinel monitoring data via the
            Databricks Genie Conversation API.
          </p>
        </div>
        <div className="genie-header-badges">
          <span className="ai-badge">AI-generated · Databricks Genie</span>
          {conversationId && (
            <button
              type="button"
              className="btn-secondary"
              disabled={isLoading}
              onClick={handleNewConversation}
            >
              New conversation
            </button>
          )}
        </div>
      </div>

      <form className="genie-form" onSubmit={(e) => void handleSubmit(e)}>
        <input
          type="text"
          className="genie-input"
          maxLength={500}
          placeholder={
            conversationId
              ? "Ask a follow-up question in this conversation..."
              : "Ask a question (e.g., How many alerts matched each rule by replay batch?)..."
          }
          value={question}
          disabled={isLoading}
          onChange={(e) => setQuestion(e.target.value)}
          aria-label="Question for Databricks Genie"
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={isLoading || !question.trim()}
        >
          {isLoading
            ? "Asking Genie…"
            : conversationId
              ? "Ask follow-up"
              : "Ask"}
        </button>
      </form>

      {isLoading && (
        <div className="state-box" role="status">
          <p className="state-title">Waiting for Databricks Genie…</p>
          <p className="state-detail">
            Submitting your question, waiting for query completion, and retrieving
            available results.
          </p>
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="state-box state-error" role="alert">
          <p className="state-title">Genie request failed</p>
          <p className="state-detail">{errorMessage}</p>
        </div>
      )}

      {!isLoading && genieResult && (
        <div className="genie-response-card">
          <div className="genie-response-meta">
            <span className="ai-badge">AI-generated answer</span>
            <span className="subsection-caption">
              Question: <strong>{genieResult.question}</strong>
            </span>
            <span className="loaded-count-badge">
              Conversation: <code>{genieResult.conversationId}</code>
            </span>
          </div>

          <div className="genie-answer-text">{genieResult.answer}</div>

          {genieResult.columns.length > 0 && (
            <div className="genie-results-section">
              <div className="subsection-header">
                <h3>Query results (AI-generated query)</h3>
                <span className="loaded-count-badge">
                  Showing {genieResult.displayedRowCount} of{" "}
                  {genieResult.totalRowCount} row
                  {genieResult.totalRowCount === 1 ? "" : "s"} (capped at{" "}
                  {genieResult.rowCap} rows)
                </span>
              </div>

              {genieResult.rows.length === 0 ? (
                <p className="subsection-subtitle">
                  Query completed with 0 rows returned.
                </p>
              ) : (
                <div className="table-wrapper">
                  <table className="history-table">
                    <thead>
                      <tr>
                        {genieResult.columns.map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {genieResult.rows.map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`}>
                          {genieResult.columns.map((col, colIndex) => (
                            <td key={`${col}-${colIndex}`} className="mono-cell">
                              {row[colIndex] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {genieResult.sql && (
            <details className="technical-details">
              <summary className="technical-summary">
                Generated SQL (AI-generated by Genie)
              </summary>
              <div className="technical-body">
                <pre className="genie-sql-pre">
                  <code>{genieResult.sql}</code>
                </pre>
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
