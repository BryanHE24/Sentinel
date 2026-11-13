import { type FormEvent, useState } from "react";
import type { GenieAskResponse } from "../types/alerts";
import { SafeMarkdownText } from "./SafeMarkdownText";

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
          "Failed to query monitoring data"
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
          : "Failed to query monitoring data."
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

  const hasSupportingData =
    genieResult !== null &&
    (genieResult.columns.length > 0 || Boolean(genieResult.sql));

  return (
    <section className="panel genie-panel" aria-label="Ask about the data">
      <div className="panel-header">
        <div>
          <h2>Ask about the data</h2>
          <p className="subsection-subtitle">
            Ask natural-language questions about alerts, rules, and transaction
            patterns across the monitoring tables.
          </p>
        </div>
        <div className="genie-header-badges">
          <span className="ai-subtle-label">
            AI-generated · Review against evidence
          </span>
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
              ? "Ask a follow-up question..."
              : "Ask a question (e.g., How many alerts matched each rule by replay batch?)..."
          }
          value={question}
          disabled={isLoading}
          onChange={(e) => setQuestion(e.target.value)}
          aria-label="Ask a question about the monitoring data"
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={isLoading || !question.trim()}
        >
          {isLoading
            ? "Loading answer…"
            : conversationId
              ? "Ask follow-up"
              : "Ask"}
        </button>
      </form>

      {isLoading && (
        <div className="state-box" role="status">
          <p className="state-title">Preparing answer…</p>
          <p className="state-detail">
            Running the query and retrieving available results.
          </p>
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="state-box state-error" role="alert">
          <p className="state-title">Unable to complete question</p>
          <p className="state-detail">{errorMessage}</p>
        </div>
      )}

      {!isLoading && genieResult && (
        <div className="genie-response-card">
          <div className="genie-response-meta">
            <span className="ai-subtle-label">
              AI-generated · Review against evidence
            </span>
            <span className="subsection-caption">
              Question: <strong>{genieResult.question}</strong>
            </span>
          </div>

          <SafeMarkdownText content={genieResult.answer} />

          {hasSupportingData && (
            <details className="technical-details supporting-data-details">
              <summary className="technical-summary">
                View supporting data
              </summary>
              <div className="technical-body supporting-data-body">
                {genieResult.columns.length > 0 && (
                  <div className="genie-results-section">
                    <div className="subsection-header">
                      <h3>Query results</h3>
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
                                  <td
                                    key={`${col}-${colIndex}`}
                                    className="mono-cell"
                                  >
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
                  <div className="genie-sql-section">
                    <span className="meta-label">Generated SQL</span>
                    <pre className="genie-sql-pre">
                      <code>{genieResult.sql}</code>
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
