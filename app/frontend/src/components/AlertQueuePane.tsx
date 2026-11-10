import type { KeyboardEvent, ReactNode } from "react";
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
  children?: ReactNode;
}

export function AlertQueuePane({
  alerts,
  appliedLimit,
  selectedAlertId,
  isLoading,
  errorMessage,
  onSelectAlert,
  onRetry,
  children,
}: AlertQueuePaneProps) {
  function handleRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    alertId: string
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectAlert(alertId);
    }
  }

  return (
    <section className="panel queue-panel" aria-label="Review queue">
      <div className="panel-header">
        <h2>Review queue</h2>
        <span className="loaded-count-badge">
          Showing {alerts.length} loaded result{alerts.length === 1 ? "" : "s"} (limit{" "}
          {appliedLimit})
        </span>
      </div>

      {children}

      {isLoading && (
        <div className="state-box" role="status">
          <p className="state-title">Loading alerts from Databricks SQL…</p>
          <p className="state-detail">Fetching flagged payment records…</p>
        </div>
      )}

      {!isLoading && errorMessage && (
        <div className="state-box state-error" role="alert">
          <p className="state-title">Unable to load alerts</p>
          <p className="state-detail">{errorMessage}</p>
          <button type="button" className="btn-secondary" onClick={onRetry}>
            Retry query
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
        <>
          <div className="queue-table-scroll">
            <table className="queue-table" aria-label="Flagged alerts">
              <thead>
                <tr>
                  <th>Event time</th>
                  <th>Merchant</th>
                  <th>Masked card</th>
                  <th className="num-col">Amount</th>
                  <th>Matched rules</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => {
                  const isSelected = alert.alert_id === selectedAlertId;
                  return (
                    <tr
                      key={alert.alert_id}
                      tabIndex={0}
                      aria-selected={isSelected}
                      className={`queue-row ${
                        isSelected ? "queue-row-selected" : ""
                      }`}
                      onClick={() => onSelectAlert(alert.alert_id)}
                      onKeyDown={(e) => handleRowKeyDown(e, alert.alert_id)}
                    >
                      <td className="mono-cell">{alert.event_time}</td>
                      <td>
                        <div className="queue-merchant-primary">
                          {alert.merchant}
                        </div>
                        <div className="queue-merchant-sub">
                          {alert.trans_num}
                          {alert.category ? ` · ${alert.category}` : ""}
                        </div>
                      </td>
                      <td className="mono-cell">
                        {maskCardNumber(alert.cc_num)}
                      </td>
                      <td className="num-col amount-cell">
                        {formatCurrency(alert.amount)}
                      </td>
                      <td>
                        <div className="rule-badge-row">
                          {alert.matched_rule_ids.map((ruleId) => (
                            <span key={ruleId} className="rule-badge">
                              {formatRuleBadge(ruleId)}
                            </span>
                          ))}
                          {alert.matched_rule_count > 1 && (
                            <span className="rule-badge rule-badge-multi">
                              Multi-rule ({alert.matched_rule_count})
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="queue-footer-note">
            Select an alert to inspect its evidence. Flags indicate review, not
            confirmed fraud.
          </p>
        </>
      )}
    </section>
  );
}
