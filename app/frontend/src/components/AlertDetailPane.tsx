import type {
  AlertSummaryResponse,
  CardHistoryTransaction,
  GoldAlert,
} from "../types/alerts";
import {
  describeRuleEvidencePlainly,
  formatCurrency,
  formatObservedMetricsList,
  formatRuleTitle,
  maskCardNumber,
} from "../utils/formatters";
import { SafeMarkdownText } from "./SafeMarkdownText";

interface AlertDetailPaneProps {
  selectedAlert: GoldAlert | null;
  history: CardHistoryTransaction[];
  historyLimit: number;
  isHistoryLoading: boolean;
  historyError: string | null;
  onRetryHistory: () => void;
  summaryResult: AlertSummaryResponse | null;
  isSummaryLoading: boolean;
  summaryError: string | null;
  onGenerateSummary: () => void;
}

const SVG_BAR_MAX_WIDTH = 320;

function computeBarWidth(value: number | null, maxValue: number): number {
  if (value === null || !Number.isFinite(value) || value <= 0 || maxValue <= 0) {
    return 0;
  }
  const scaled = Math.round((value / maxValue) * SVG_BAR_MAX_WIDTH);
  return Math.max(4, Math.min(SVG_BAR_MAX_WIDTH, scaled));
}

export function AlertDetailPane({
  selectedAlert,
  history,
  historyLimit,
  isHistoryLoading,
  historyError,
  onRetryHistory,
  summaryResult,
  isSummaryLoading,
  summaryError,
  onGenerateSummary,
}: AlertDetailPaneProps) {
  if (!selectedAlert) {
    return (
      <section
        className="panel detail-panel"
        aria-label="Selected investigation details"
      >
        <div className="state-box">
          <p className="state-title">Select an alert from the review queue</p>
          <p className="state-detail">
            Choose a flagged payment above to inspect its plain-language rule
            evidence, 14-day amount comparison, and strictly earlier card activity.
          </p>
        </div>
      </section>
    );
  }

  const txnAmountNum = Number(selectedAlert.amount);
  const avg14dNum =
    selectedAlert.card_avg_amount_14d !== null
      ? Number(selectedAlert.card_avg_amount_14d)
      : null;
  const threshold14dNum =
    selectedAlert.unusual_amount_threshold_14d !== null
      ? Number(selectedAlert.unusual_amount_threshold_14d)
      : null;

  const maxComparisonAmount = Math.max(
    Number.isFinite(txnAmountNum) ? txnAmountNum : 0,
    avg14dNum !== null && Number.isFinite(avg14dNum) ? avg14dNum : 0,
    threshold14dNum !== null && Number.isFinite(threshold14dNum)
      ? threshold14dNum
      : 0,
    1
  );

  const txnBarWidth = computeBarWidth(txnAmountNum, maxComparisonAmount);
  const avgBarWidth = computeBarWidth(avg14dNum, maxComparisonAmount);
  const thresholdBarWidth = computeBarWidth(threshold14dNum, maxComparisonAmount);

  const activeSummary =
    summaryResult && summaryResult.alertId === selectedAlert.alert_id
      ? summaryResult
      : null;

  return (
    <section
      className="panel detail-panel"
      aria-label="Selected investigation details"
    >
      {/* Selected Investigation Header */}
      <div className="detail-header">
        <div>
          <span className="section-eyebrow">SELECTED INVESTIGATION</span>
          <h2>{selectedAlert.trans_num} · Payment review</h2>
        </div>
        <span className="rule-count-chip">
          {selectedAlert.matched_rule_count} matched rule
          {selectedAlert.matched_rule_count === 1 ? "" : "s"}
        </span>
      </div>

      {/* 4-Column Key Transaction Facts */}
      <div className="detail-facts-grid">
        <div className="detail-fact">
          <span className="detail-fact-label">Payment amount</span>
          <span className="detail-fact-value">
            {formatCurrency(selectedAlert.amount)}
          </span>
        </div>
        <div className="detail-fact">
          <span className="detail-fact-label">Card reference</span>
          <span className="detail-fact-value mono-cell">
            {maskCardNumber(selectedAlert.cc_num)}
          </span>
        </div>
        <div className="detail-fact">
          <span className="detail-fact-label">Merchant</span>
          <span className="detail-fact-value">
            {selectedAlert.merchant}
            {selectedAlert.category ? (
              <span className="detail-fact-sub"> · {selectedAlert.category}</span>
            ) : null}
          </span>
        </div>
        <div className="detail-fact">
          <span className="detail-fact-label">Event time</span>
          <span className="detail-fact-value mono-cell">
            {selectedAlert.event_time}
          </span>
        </div>
      </div>

      {/* Plain-Language Rule Evidence Callouts */}
      <div className="evidence-list" aria-label="Rule evidence">
        {selectedAlert.rule_evidence.map((ev) => {
          const metricItems = formatObservedMetricsList(ev.observed_metrics);
          return (
            <div key={ev.rule_id} className="evidence-callout">
              <div className="evidence-callout-header">
                <strong>{formatRuleTitle(ev.rule_id)}</strong>
                <span className="window-chip">{ev.window} window</span>
              </div>
              <p className="evidence-callout-text">
                {describeRuleEvidencePlainly(ev, selectedAlert)}
              </p>
              <div className="metric-pills">
                {metricItems.map((item) => (
                  <span key={item} className="metric-pill">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* On-Demand Evidence Summary */}
      <div className="detail-subsection ai-summary-section">
        <div className="subsection-header">
          <div>
            <h3>Evidence summary</h3>
            <p className="subsection-subtitle">
              Summarizes the selected alert and up to 10 strictly earlier card
              payments (masked card, fraud labels excluded).
            </p>
          </div>
          <div className="ai-summary-actions">
            <span className="ai-subtle-label">
              AI-generated · Review against evidence
            </span>
            <button
              type="button"
              className="btn-primary"
              disabled={isSummaryLoading}
              onClick={onGenerateSummary}
            >
              {isSummaryLoading
                ? "Generating summary…"
                : "Generate evidence summary"}
            </button>
          </div>
        </div>

        {isSummaryLoading && (
          <div className="state-box" role="status">
            <p className="state-title">Generating evidence summary…</p>
            <p className="state-detail">
              Retrieving the selected alert and limited earlier card history to
              prepare the explanation.
            </p>
          </div>
        )}

        {!isSummaryLoading && summaryError && (
          <div className="state-box state-error" role="alert">
            <p className="state-title">Unable to generate evidence summary</p>
            <p className="state-detail">{summaryError}</p>
          </div>
        )}

        {!isSummaryLoading && !summaryError && activeSummary && (
          <div
            className="ai-summary-card"
            role="region"
            aria-label="Evidence summary"
          >
            <div className="ai-summary-meta">
              <span className="ai-subtle-label">
                AI-generated · Review against evidence
              </span>
              <span className="subsection-caption">
                Based on selected alert and {activeSummary.historyCount} loaded
                earlier payment{activeSummary.historyCount === 1 ? "" : "s"} (limit{" "}
                {activeSummary.historyLimit}) · Does not establish fraud
              </span>
            </div>
            <SafeMarkdownText content={activeSummary.summary} />
          </div>
        )}
      </div>

      {/* Two-Column Section: Amount Comparison Graphic + Prior Card Activity Snapshot */}
      <div className="detail-two-col">
        <div className="detail-subsection">
          <div className="subsection-header">
            <h3>Amount comparison</h3>
            <span className="subsection-caption">
              {selectedAlert.card_txn_count_14d} earlier 14d payment
              {selectedAlert.card_txn_count_14d === 1 ? "" : "s"}
            </span>
          </div>

          <div
            className="comparison-chart"
            role="group"
            aria-label="Comparison of transaction amount, 14-day card average, and Rule 2 threshold"
          >
            <div className="comparison-row">
              <div className="comparison-label-row">
                <span className="comparison-label">Transaction amount</span>
                <span className="comparison-value">
                  {formatCurrency(selectedAlert.amount)}
                </span>
              </div>
              <svg
                className="comparison-bar-svg"
                viewBox={`0 0 ${SVG_BAR_MAX_WIDTH} 8`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <rect
                  className="comparison-bar-track"
                  x={0}
                  y={0}
                  width={SVG_BAR_MAX_WIDTH}
                  height={8}
                  rx={4}
                />
                <rect
                  className="comparison-bar-txn"
                  x={0}
                  y={0}
                  width={txnBarWidth}
                  height={8}
                  rx={4}
                />
              </svg>
            </div>

            <div className="comparison-row">
              <div className="comparison-label-row">
                <span className="comparison-label">14-day average</span>
                <span className="comparison-value">
                  {selectedAlert.card_avg_amount_14d !== null
                    ? formatCurrency(selectedAlert.card_avg_amount_14d)
                    : "No earlier 14d payments"}
                </span>
              </div>
              <svg
                className="comparison-bar-svg"
                viewBox={`0 0 ${SVG_BAR_MAX_WIDTH} 8`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <rect
                  className="comparison-bar-track"
                  x={0}
                  y={0}
                  width={SVG_BAR_MAX_WIDTH}
                  height={8}
                  rx={4}
                />
                <rect
                  className="comparison-bar-avg"
                  x={0}
                  y={0}
                  width={avgBarWidth}
                  height={8}
                  rx={4}
                />
              </svg>
            </div>

            <div className="comparison-row">
              <div className="comparison-label-row">
                <span className="comparison-label">
                  Rule threshold (3&times; 14d average)
                </span>
                <span className="comparison-value">
                  {selectedAlert.unusual_amount_threshold_14d !== null
                    ? formatCurrency(selectedAlert.unusual_amount_threshold_14d)
                    : "No earlier 14d payments"}
                </span>
              </div>
              <svg
                className="comparison-bar-svg"
                viewBox={`0 0 ${SVG_BAR_MAX_WIDTH} 8`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <rect
                  className="comparison-bar-track"
                  x={0}
                  y={0}
                  width={SVG_BAR_MAX_WIDTH}
                  height={8}
                  rx={4}
                />
                <rect
                  className="comparison-bar-threshold"
                  x={0}
                  y={0}
                  width={thresholdBarWidth}
                  height={8}
                  rx={4}
                />
              </svg>
            </div>

            <p className="comparison-footnote">
              Compares the selected payment against this card&apos;s earlier 14-day
              average and the 3&times; unusual-amount rule threshold.
            </p>
          </div>
        </div>

        <div className="detail-subsection">
          <div className="subsection-header">
            <h3>Earlier activity snapshot</h3>
            <span className="subsection-caption">Prior to event time</span>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <span className="feature-label">1h card velocity</span>
              <span className="feature-value">
                {selectedAlert.card_txn_count_1h} earlier payment
                {selectedAlert.card_txn_count_1h === 1 ? "" : "s"}
              </span>
              <span className="feature-note">Rule 1 triggers at &ge; 3 in 1h</span>
            </div>

            <div className="feature-card">
              <span className="feature-label">14d card baseline</span>
              <span className="feature-value">
                {selectedAlert.card_txn_count_14d} earlier · avg{" "}
                {formatCurrency(selectedAlert.card_avg_amount_14d)}
              </span>
              <span className="feature-note">
                Rule 2 requires &ge; 5 payments in 14d
              </span>
            </div>

            <div className="feature-card">
              <span className="feature-label">1h same-merchant count</span>
              <span className="feature-value">
                {selectedAlert.card_merchant_txn_count_1h} earlier payment
                {selectedAlert.card_merchant_txn_count_1h === 1 ? "" : "s"}
              </span>
              <span className="feature-note">At {selectedAlert.merchant}</span>
            </div>

            <div className="feature-card">
              <span className="feature-label">1h similar-amount count</span>
              <span className="feature-value">
                {selectedAlert.card_merchant_similar_amount_count_1h} earlier
                payment
                {selectedAlert.card_merchant_similar_amount_count_1h === 1 ? "" : "s"}
              </span>
              <span className="feature-note">
                &plusmn;10% band:{" "}
                {formatCurrency(selectedAlert.similar_amount_lower_bound)}–
                {formatCurrency(selectedAlert.similar_amount_upper_bound)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Strictly Earlier Card Transaction History */}
      <div className="detail-subsection">
        <div className="subsection-header">
          <div>
            <h3>Earlier card history</h3>
            <p className="subsection-subtitle">
              Showing <strong>{history.length}</strong> loaded earlier payment
              {history.length === 1 ? "" : "s"} for card{" "}
              <code>{maskCardNumber(selectedAlert.cc_num)}</code> before{" "}
              <code>{selectedAlert.event_time}</code> (limited to {historyLimit} rows)
            </p>
          </div>
          <span className="loaded-count-badge">
            Loaded results: {history.length} / {historyLimit} max
          </span>
        </div>

        {isHistoryLoading && (
          <div className="state-box" role="status">
            <p className="state-title">Loading earlier card transactions…</p>
          </div>
        )}

        {!isHistoryLoading && historyError && (
          <div className="state-box state-error" role="alert">
            <p className="state-title">Unable to load card history</p>
            <p className="state-detail">{historyError}</p>
            <button
              type="button"
              className="btn-secondary"
              onClick={onRetryHistory}
            >
              Retry history query
            </button>
          </div>
        )}

        {!isHistoryLoading && !historyError && history.length === 0 && (
          <div className="state-box">
            <p className="state-title">No earlier transactions found</p>
            <p className="state-detail">
              This card has no accepted transactions prior to{" "}
              <code>{selectedAlert.event_time}</code>.
            </p>
          </div>
        )}

        {!isHistoryLoading && !historyError && history.length > 0 && (
          <div className="table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Event time</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th>Masked card</th>
                  <th className="num-col">Amount</th>
                  <th>Replay batch</th>
                  <th>Transaction ID</th>
                </tr>
              </thead>
              <tbody>
                {history.map((txn) => (
                  <tr key={txn.trans_num}>
                    <td className="mono-cell">{txn.event_time}</td>
                    <td className="merchant-cell">{txn.merchant}</td>
                    <td>{txn.category ?? "—"}</td>
                    <td className="mono-cell">{maskCardNumber(txn.cc_num)}</td>
                    <td className="num-col amount-cell">
                      {formatCurrency(txn.amount)}
                    </td>
                    <td className="mono-cell">{txn.replay_batch}</td>
                    <td className="mono-cell muted-cell">{txn.trans_num}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expandable Technical Details & Source Lineage */}
      <details className="technical-details">
        <summary className="technical-summary">
          Technical details and source lineage
        </summary>
        <div className="technical-body">
          <div className="meta-grid">
            <div className="meta-item">
              <span className="meta-label">Transaction ID (trans_num)</span>
              <span className="meta-value">
                <code>{selectedAlert.trans_num}</code>
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Replay batch</span>
              <span className="meta-value">
                <code>{selectedAlert.replay_batch}</code>
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Ruleset version</span>
              <span className="meta-value">
                <code>{selectedAlert.ruleset_version}</code>
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Source file &amp; row</span>
              <span className="meta-value">
                <code>
                  {selectedAlert.source_file} (row {selectedAlert.source_row_index})
                </code>
              </span>
            </div>
            <div className="meta-item meta-item-wide">
              <span className="meta-label">Unity Catalog tables</span>
              <span className="meta-value">
                Alerts: <code>workspace.sentinel_gold.alerts</code> · History:{" "}
                <code>workspace.sentinel_silver.transactions</code>
              </span>
            </div>
            <div className="meta-item meta-item-wide">
              <span className="meta-label">Deterministic alert ID (SHA-256)</span>
              <span className="meta-value">
                <code className="code-wrap">{selectedAlert.alert_id}</code>
              </span>
            </div>
            {selectedAlert.rule_evidence.map((ev) => (
              <div key={ev.rule_id} className="meta-item meta-item-wide">
                <span className="meta-label">
                  Rule specification · {ev.rule_id} ({ev.rule_version})
                </span>
                <span className="meta-value">
                  <code className="code-wrap">
                    threshold: {ev.threshold_definition} | observed_metrics:{" "}
                    {ev.observed_metrics}
                  </code>
                </span>
              </div>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}
