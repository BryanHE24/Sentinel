import type { GoldAlert } from "../types/alerts";
import {
  formatCurrency,
  formatRuleBadge,
  maskCardNumber,
} from "../utils/formatters";

interface AlertQueuePaneProps {
  alerts: GoldAlert[];
  appliedLimit: number;
  selectedAlertId: string | null;
  isLoading: boolean;
  errorMessage: string | null;
  onSelectAlert: (alertId: string) => void;
  onRetry: () => void;
}

export function AlertQueuePane({
  alerts,
  appliedLimit,
  selectedAlertId,
  isLoading,
  errorMessage,
  onSelectAlert,
  onRetry,
}: AlertQueuePaneProps) {
  return (
    <section className="pane glass-panel queue-pane" aria-label="Alert queue">
      <div className="pane-header">
        <div>
          <h2>Flagged Alert Queue</h2>
          <p className="pane-subtitle">
            Showing <strong>{alerts.length}</strong> loaded result
            {alerts.length === 1 ? "" : "s"} (API cap: {appliedLimit} rows)
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="state-box" role="status">
          <p className="state-title">Loading alerts from Databricks SQL…</p>
          <p className="state-detail">
            Querying <code>workspace.sentinel_gold.alerts</code>
          </p>
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="state-box state-error" role="alert">
          <p className="state-title">Unable to load alerts</p>
          <p className="state-detail">{errorMessage}</p>
          <button type="button" className="btn-secondary" onClick={onRetry}>
            Retry Query
          </button>
        </div>
      )}

      {!isLoading && !errorMessage && alerts.length === 0 && (
        <div className="state-box">
          <p className="state-title">No alerts matched these filters</p>
          <p className="state-detail">
            Try clearing the search text or selecting a broader replay date window.
          </p>
        </div>
      )}

      {!isLoading && !errorMessage && alerts.length > 0 && (
        <ul className="alert-list">
          {alerts.map((alert) => {
            const isSelected = alert.alert_id === selectedAlertId;
            return (
              <li key={alert.alert_id}>
                <button
                  type="button"
                  className={`alert-card ${isSelected ? "alert-card-selected" : ""}`}
                  onClick={() => onSelectAlert(alert.alert_id)}
                >
                  <div className="alert-card-top">
                    <span className="alert-time">{alert.event_time}</span>
                    <span className="alert-amount">
                      {formatCurrency(alert.amount)}
                    </span>
                  </div>

                  <div className="alert-card-middle">
                    <span className="alert-merchant">{alert.merchant}</span>
                    {alert.category && (
                      <span className="category-tag">{alert.category}</span>
                    )}
                  </div>

                  <div className="alert-card-meta">
                    <span>
                      Txn: <code>{alert.trans_num}</code>
                    </span>
                    <span>
                      Card: <code>{maskCardNumber(alert.cc_num)}</code>
                    </span>
                  </div>

                  <div className="rule-badge-row">
                    {alert.matched_rule_ids.map((ruleId) => (
                      <span key={ruleId} className="rule-badge">
                        {formatRuleBadge(ruleId)}
                      </span>
                    ))}
                    {alert.matched_rule_count > 1 && (
                      <span className="rule-badge rule-badge-multi">
                        Multi-Rule ({alert.matched_rule_count})
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
