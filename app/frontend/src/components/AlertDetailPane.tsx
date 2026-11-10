import type { CardHistoryTransaction, GoldAlert } from "../types/alerts";
import {
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
      <section
        className="pane glass-panel detail-pane"
        aria-label="Alert investigation details"
      >
        <div className="state-box">
          <p className="state-title">Select an alert to inspect</p>
          <p className="state-detail">
            Choose a flagged transaction on the left to review its rule evidence,
            historical card features, and strictly earlier payments.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="pane glass-panel detail-pane"
      aria-label="Alert investigation details"
    >
      <div className="detail-header">
        <div>
          <span className="review-banner">
            Analyst Review Signal · An alert requests investigation and does not
            automatically establish fraud
          </span>
          <h2>
            Transaction <code>{selectedAlert.trans_num}</code>
          </h2>
          <p className="detail-subtitle">
            Event time: <strong>{selectedAlert.event_time}</strong> · Replay batch:{" "}
            <code>{selectedAlert.replay_batch}</code> · Ruleset:{" "}
            <code>{selectedAlert.ruleset_version}</code>
          </p>
        </div>
        <div className="detail-amount-box">
          <span className="detail-amount-label">Transaction Amount</span>
          <span className="detail-amount-value">
            {formatCurrency(selectedAlert.amount)}
          </span>
        </div>
      </div>

      {/* Transaction & Lineage Summary */}
      <div className="meta-grid">
        <div className="meta-item">
          <span className="meta-label">Masked Card Number</span>
          <span className="meta-value">
            <code>{maskCardNumber(selectedAlert.cc_num)}</code>
          </span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Merchant</span>
          <span className="meta-value">{selectedAlert.merchant}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Category</span>
          <span className="meta-value">{selectedAlert.category ?? "—"}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Source Lineage</span>
          <span className="meta-value">
            <code>
              {selectedAlert.source_file} (row {selectedAlert.source_row_index})
            </code>
          </span>
        </div>
        <div className="meta-item meta-item-wide">
          <span className="meta-label">Deterministic Alert ID (SHA-256)</span>
          <span className="meta-value">
            <code className="code-wrap">{selectedAlert.alert_id}</code>
          </span>
        </div>
      </div>

      {/* Matched Rule Evidence */}
      <div className="detail-section">
        <h3>
          Matched Rule Evidence ({selectedAlert.matched_rule_count} rule
          {selectedAlert.matched_rule_count === 1 ? "" : "s"})
        </h3>
        <div className="evidence-list">
          {selectedAlert.rule_evidence.map((ev) => {
            const metricItems = formatObservedMetricsList(ev.observed_metrics);
            return (
              <div key={ev.rule_id} className="evidence-card">
                <div className="evidence-card-header">
                  <strong>{formatRuleTitle(ev.rule_id)}</strong>
                  <span className="evidence-meta">
                    <code>{ev.rule_id}</code> · version <code>{ev.rule_version}</code> ·
                    window <code>{ev.window}</code>
                  </span>
                </div>

                <div className="evidence-body">
                  <div>
                    <span className="evidence-field-label">Observed Metrics</span>
                    <div className="metric-pills">
                      {metricItems.map((item) => (
                        <span key={item} className="metric-pill">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="evidence-field-label">Threshold Rule</span>
                    <p className="threshold-text">
                      <code>{ev.threshold_definition}</code>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Point-in-Time Historical Feature Snapshot */}
      <div className="detail-section">
        <h3>Point-in-Time Historical Features (Prior to Event Time)</h3>
        <div className="feature-grid">
          <div className="feature-card">
            <span className="feature-label">1h Card Velocity</span>
            <span className="feature-value">
              {selectedAlert.card_txn_count_1h} prior txn
              {selectedAlert.card_txn_count_1h === 1 ? "" : "s"}
            </span>
            <span className="feature-note">Rule 1 threshold: &ge; 3 in 1h</span>
          </div>

          <div className="feature-card">
            <span className="feature-label">14d Card Baseline</span>
            <span className="feature-value">
              {selectedAlert.card_txn_count_14d} prior · avg{" "}
              {formatCurrency(selectedAlert.card_avg_amount_14d)}
            </span>
            <span className="feature-note">
              3&times; threshold:{" "}
              {formatCurrency(selectedAlert.unusual_amount_threshold_14d)} (&ge; 5
              txns)
            </span>
          </div>

          <div className="feature-card">
            <span className="feature-label">1h Same-Merchant Count</span>
            <span className="feature-value">
              {selectedAlert.card_merchant_txn_count_1h} prior txn
              {selectedAlert.card_merchant_txn_count_1h === 1 ? "" : "s"}
            </span>
            <span className="feature-note">At {selectedAlert.merchant}</span>
          </div>

          <div className="feature-card">
            <span className="feature-label">1h Similar-Amount Count</span>
            <span className="feature-value">
              {selectedAlert.card_merchant_similar_amount_count_1h} prior txn
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

      {/* Strictly Earlier Card Transaction History */}
      <div className="detail-section">
        <div className="section-header-row">
          <div>
            <h3>Earlier Card Activity (`event_time &lt; alert.event_time`)</h3>
            <p className="section-subtitle">
              Showing <strong>{history.length}</strong> loaded earlier transaction
              {history.length === 1 ? "" : "s"} for card{" "}
              <code>{maskCardNumber(selectedAlert.cc_num)}</code> (API cap:{" "}
              {historyLimit} rows, from{" "}
              <code>workspace.sentinel_silver.transactions</code>)
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
              This card has no accepted Silver transactions prior to{" "}
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
                  <th>Transaction ID</th>
                  <th>Merchant</th>
                  <th>Category</th>
                  <th className="num-col">Amount</th>
                  <th>Card</th>
                  <th>Replay Batch</th>
                </tr>
              </thead>
              <tbody>
                {history.map((txn) => (
                  <tr key={txn.trans_num}>
                    <td className="mono-cell">{txn.event_time}</td>
                    <td className="mono-cell">{txn.trans_num}</td>
                    <td>{txn.merchant}</td>
                    <td>{txn.category ?? "—"}</td>
                    <td className="num-col amount-cell">
                      {formatCurrency(txn.amount)}
                    </td>
                    <td className="mono-cell">{maskCardNumber(txn.cc_num)}</td>
                    <td className="mono-cell">{txn.replay_batch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
