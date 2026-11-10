import type { CardHistoryTransaction, GoldAlert } from "../types/alerts";
import {
  describeRuleEvidencePlainly,
  formatCurrency,
  formatObservedMetricsList,
  formatRuleTitle,
  maskCardNumber,
} from "../utils/formatters";

interface AlertDetailPaneProps {
  selectedAlert: GoldAlert | null;
  history: CardHistoryTransaction[];
  historyLimit: number;
  isHistoryLoading: boolean;
  historyError: string | null;
  onRetryHistory: () => void;
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
}: AlertDetailPaneProps) {
  if (!selectedAlert) {
    return (
      <section className="pane detail-pane" aria-label="Alert investigation details">
        <div className="state-box">
          <p className="state-title">Select an alert from the queue</p>
          <p className="state-detail">
            Choose a flagged payment on the left to inspect its plain-language rule
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

  return (
    <section className="pane detail-pane" aria-label="Alert investigation details">
      {/* Top Investigation Header */}
      <div className="detail-header">
        <div className="detail-title-group">
          <div className="detail-badge-row">
            <span className="review-banner">
              Analyst Review Signal · Does not automatically establish fraud
            </span>
            <span className="meta-chip">
              Card {maskCardNumber(selectedAlert.cc_num)}
            </span>
            {selectedAlert.category && (
              <span className="meta-chip">{selectedAlert.category}</span>
            )}
          </div>
          <h2>{selectedAlert.merchant}</h2>
          <p className="detail-subtitle">
            Transaction time: <strong>{selectedAlert.event_time}</strong> · Replay
            batch: <strong>{selectedAlert.replay_batch}</strong> · Triggered{" "}
            <strong>
              {selectedAlert.matched_rule_count} rule
              {selectedAlert.matched_rule_count === 1 ? "" : "s"}
            </strong>
          </p>
        </div>

        <div className="detail-amount-box">
          <span className="detail-amount-label">Transaction Amount</span>
          <span className="detail-amount-value">
            {formatCurrency(selectedAlert.amount)}
          </span>
        </div>
      </div>

      {/* Plain-Language Rule Evidence */}
      <div className="detail-section">
        <div className="section-heading-row">
          <h3>Why This Transaction Was Flagged</h3>
          <span className="section-count-pill">
            {selectedAlert.matched_rule_count} matched rule
            {selectedAlert.matched_rule_count === 1 ? "" : "s"}
          </span>
        </div>

        <div className="evidence-list">
          {selectedAlert.rule_evidence.map((ev) => {
            const metricItems = formatObservedMetricsList(ev.observed_metrics);
            return (
              <div key={ev.rule_id} className="evidence-card">
                <div className="evidence-card-header">
                  <strong>{formatRuleTitle(ev.rule_id)}</strong>
                  <span className="window-chip">{ev.window} lookback window</span>
                </div>

                <p className="evidence-plain-summary">
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
      </div>

      {/* Simple Amount Comparison Graphic + Point-in-Time Snapshot */}
      <div className="detail-two-col">
        <div className="detail-section comparison-panel">
          <div className="section-heading-row">
            <h3>Amount vs. 14-Day Baseline &amp; Rule Threshold</h3>
            <span className="section-caption">
              Based on {selectedAlert.card_txn_count_14d} earlier 14d txn
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
                <span className="comparison-label">Transaction Amount</span>
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
                <span className="comparison-label">14-Day Card Average</span>
                <span className="comparison-value">
                  {selectedAlert.card_avg_amount_14d !== null
                    ? formatCurrency(selectedAlert.card_avg_amount_14d)
                    : "No prior 14d txns"}
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
                  Rule 2 Threshold (3&times; 14d Average)
                </span>
                <span className="comparison-value">
                  {selectedAlert.unusual_amount_threshold_14d !== null
                    ? formatCurrency(selectedAlert.unusual_amount_threshold_14d)
                    : "No prior 14d txns"}
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
              Rule 2 flags payments exceeding 3&times; the 14-day average when the card
              has at least 5 earlier transactions in the 14-day window.
            </p>
          </div>
        </div>

        {/* Point-in-Time Historical Activity Metrics */}
        <div className="detail-section">
          <div className="section-heading-row">
            <h3>Prior Card Activity Snapshot</h3>
            <span className="section-caption">Strictly before event time</span>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <span className="feature-label">1h Card Velocity</span>
              <span className="feature-value">
                {selectedAlert.card_txn_count_1h} earlier txn
                {selectedAlert.card_txn_count_1h === 1 ? "" : "s"}
              </span>
              <span className="feature-note">Rule 1 threshold: &ge; 3 in 1h</span>
            </div>

            <div className="feature-card">
              <span className="feature-label">14d Card Volume</span>
              <span className="feature-value">
                {selectedAlert.card_txn_count_14d} earlier txn
                {selectedAlert.card_txn_count_14d === 1 ? "" : "s"}
              </span>
              <span className="feature-note">
                14d avg: {formatCurrency(selectedAlert.card_avg_amount_14d)}
              </span>
            </div>

            <div className="feature-card">
              <span className="feature-label">1h Same-Merchant Count</span>
              <span className="feature-value">
                {selectedAlert.card_merchant_txn_count_1h} earlier txn
                {selectedAlert.card_merchant_txn_count_1h === 1 ? "" : "s"}
              </span>
              <span className="feature-note">At {selectedAlert.merchant}</span>
            </div>

            <div className="feature-card">
              <span className="feature-label">1h Similar-Amount Count</span>
              <span className="feature-value">
                {selectedAlert.card_merchant_similar_amount_count_1h} earlier txn
                {selectedAlert.card_merchant_similar_amount_count_1h === 1 ? "" : "s"}
              </span>
              <span className="feature-note">
                &plusmn;10% band: [
                {formatCurrency(selectedAlert.similar_amount_lower_bound)},{" "}
                {formatCurrency(selectedAlert.similar_amount_upper_bound)}]
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Strictly Earlier Card Transaction History */}
      <div className="detail-section">
        <div className="section-heading-row">
          <div>
            <h3>Earlier Card Activity (Before Alert Time)</h3>
            <p className="section-subtitle">
              Showing <strong>{history.length}</strong> loaded result
              {history.length === 1 ? "" : "s"} (API cap: {historyLimit} rows) for
              card <code>{maskCardNumber(selectedAlert.cc_num)}</code> prior to{" "}
              <code>{selectedAlert.event_time}</code>
            </p>
          </div>
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
              Retry History Query
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
                  <th>Event Time</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th className="num-col">Amount</th>
                  <th>Card</th>
                  <th>Replay Batch</th>
                  <th>Transaction ID</th>
                </tr>
              </thead>
              <tbody>
                {history.map((txn) => (
                  <tr key={txn.trans_num}>
                    <td className="mono-cell">{txn.event_time}</td>
                    <td className="merchant-cell">{txn.merchant}</td>
                    <td>{txn.category ?? "—"}</td>
                    <td className="num-col amount-cell">
                      {formatCurrency(txn.amount)}
                    </td>
                    <td className="mono-cell">{maskCardNumber(txn.cc_num)}</td>
                    <td className="mono-cell">{txn.replay_batch}</td>
                    <td className="mono-cell muted-cell">{txn.trans_num}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expandable Technical Details: IDs, Table Names & Lineage */}
      <details className="technical-details">
        <summary className="technical-summary">
          Technical IDs, Rule Definitions &amp; Table Lineage
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
              <span className="meta-label">Ruleset Version</span>
              <span className="meta-value">
                <code>{selectedAlert.ruleset_version}</code>
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Source File &amp; Row</span>
              <span className="meta-value">
                <code>
                  {selectedAlert.source_file} (row {selectedAlert.source_row_index})
                </code>
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Databricks Tables</span>
              <span className="meta-value">
                <code>workspace.sentinel_gold.alerts</code> ·{" "}
                <code>workspace.sentinel_silver.transactions</code>
              </span>
            </div>
            <div className="meta-item meta-item-wide">
              <span className="meta-label">Deterministic Alert ID (SHA-256)</span>
              <span className="meta-value">
                <code className="code-wrap">{selectedAlert.alert_id}</code>
              </span>
            </div>
            {selectedAlert.rule_evidence.map((ev) => (
              <div key={ev.rule_id} className="meta-item meta-item-wide">
                <span className="meta-label">
                  Rule Spec · {ev.rule_id} ({ev.rule_version})
                </span>
                <span className="meta-value">
                  <code className="code-wrap">
                    threshold: {ev.threshold_definition} | raw metrics:{" "}
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
