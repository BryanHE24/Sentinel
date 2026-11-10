import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { AlertDetailPane } from "./components/AlertDetailPane";
import { AlertFiltersBar } from "./components/AlertFiltersBar";
import { AlertQueuePane } from "./components/AlertQueuePane";
import type {
  AlertHistoryResponse,
  AlertQueryFilters,
  AlertsListResponse,
  CardHistoryTransaction,
  GoldAlert,
} from "./types/alerts";

const DEFAULT_FILTERS: AlertQueryFilters = {
  ruleId: "",
  startDate: "",
  endDate: "",
  search: "",
  limit: 50,
};

const SIDEBAR_RULE_VIEWS: Array<{ label: string; ruleId: string }> = [
  { label: "All Flagged Alerts", ruleId: "" },
  { label: "Rule 1 · Velocity (1h)", ruleId: "RULE_01_CARD_VELOCITY_1H" },
  { label: "Rule 2 · Unusual Amt (14d)", ruleId: "RULE_02_UNUSUAL_AMOUNT_14D" },
  {
    label: "Rule 3 · Similar Merch (1h)",
    ruleId: "RULE_03_REPEATED_SIMILAR_MERCHANT_1H",
  },
  { label: "Multi-Rule (2+)", ruleId: "MULTI_RULE" },
];

const SIDEBAR_REPLAY_WINDOWS: Array<{
  label: string;
  range: string;
  startDate: string;
  endDate: string;
}> = [
  { label: "All Replay Dates", range: "Jan 1–Feb 11", startDate: "", endDate: "" },
  {
    label: "Initial History",
    range: "Jan 1–14",
    startDate: "2019-01-01",
    endDate: "2019-01-14",
  },
  {
    label: "Rule Development",
    range: "Jan 15–28",
    startDate: "2019-01-15",
    endDate: "2019-01-28",
  },
  {
    label: "Holdout Evaluation",
    range: "Jan 29–Feb 11",
    startDate: "2019-01-29",
    endDate: "2019-02-11",
  },
];

function buildAlertsUrl(filters: AlertQueryFilters): string {
  const params = new URLSearchParams();
  if (filters.ruleId) {
    params.set("ruleId", filters.ruleId);
  }
  if (filters.startDate) {
    params.set("startDate", filters.startDate);
  }
  if (filters.endDate) {
    params.set("endDate", filters.endDate);
  }
  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }
  params.set("limit", String(filters.limit));
  return `/api/alerts?${params.toString()}`;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    if (payload?.message) {
      return payload.message;
    }
  } catch {
    // Ignore JSON parse failure on non-JSON error responses.
  }
  return `${fallback} (HTTP ${response.status})`;
}

export function App() {
  const [draftFilters, setDraftFilters] = useState<AlertQueryFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AlertQueryFilters>(DEFAULT_FILTERS);
  const [alertsReloadToken, setAlertsReloadToken] = useState(0);

  const [alerts, setAlerts] = useState<GoldAlert[]>([]);
  const [appliedLimit, setAppliedLimit] = useState<number>(DEFAULT_FILTERS.limit);
  const [isAlertsLoading, setIsAlertsLoading] = useState<boolean>(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [historyReloadToken, setHistoryReloadToken] = useState(0);
  const [history, setHistory] = useState<CardHistoryTransaction[]>([]);
  const [historyLimit, setHistoryLimit] = useState<number>(25);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Load alerts whenever appliedFilters or alertsReloadToken changes.
  useEffect(() => {
    const controller = new AbortController();

    async function loadAlerts() {
      setIsAlertsLoading(true);
      setAlertsError(null);

      try {
        const response = await fetch(buildAlertsUrl(appliedFilters), {
          signal: controller.signal,
        });
        if (!response.ok) {
          const message = await readErrorMessage(
            response,
            "Failed to fetch alerts from /api/alerts"
          );
          throw new Error(message);
        }

        const data = (await response.json()) as AlertsListResponse;
        if (controller.signal.aborted) {
          return;
        }

        const loadedAlerts = Array.isArray(data.alerts) ? data.alerts : [];
        setAlerts(loadedAlerts);
        setAppliedLimit(data.filters?.limit ?? appliedFilters.limit);
        setSelectedAlertId((currentId) => {
          if (currentId && loadedAlerts.some((a) => a.alert_id === currentId)) {
            return currentId;
          }
          return loadedAlerts[0]?.alert_id ?? null;
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setAlerts([]);
        setSelectedAlertId(null);
        setAlertsError(
          error instanceof Error ? error.message : "Failed to load alerts."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsAlertsLoading(false);
        }
      }
    }

    void loadAlerts();
    return () => controller.abort();
  }, [appliedFilters, alertsReloadToken]);

  const selectedAlert = useMemo(
    () => alerts.find((a) => a.alert_id === selectedAlertId) ?? null,
    [alerts, selectedAlertId]
  );

  // Load strictly earlier card history when the selected alert changes.
  useEffect(() => {
    if (!selectedAlertId) {
      return;
    }

    const controller = new AbortController();
    const activeAlertId = selectedAlertId;

    async function loadHistory() {
      setIsHistoryLoading(true);
      setHistoryError(null);

      try {
        const response = await fetch(
          `/api/alerts/${encodeURIComponent(activeAlertId)}/history?limit=25`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          const message = await readErrorMessage(
            response,
            "Failed to fetch card history"
          );
          throw new Error(message);
        }

        const data = (await response.json()) as AlertHistoryResponse;
        if (controller.signal.aborted) {
          return;
        }

        setHistory(Array.isArray(data.history) ? data.history : []);
        setHistoryLimit(data.limit ?? 25);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setHistory([]);
        setHistoryError(
          error instanceof Error ? error.message : "Failed to load card history."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsHistoryLoading(false);
        }
      }
    }

    void loadHistory();
    return () => controller.abort();
  }, [selectedAlertId, historyReloadToken]);

  // Summary counts across the currently loaded alerts response.
  const loadedSummary = useMemo(() => {
    let velocityCount = 0;
    let unusualAmountCount = 0;
    let similarMerchantCount = 0;
    let multiRuleCount = 0;

    for (const alert of alerts) {
      if (alert.matched_rule_ids.includes("RULE_01_CARD_VELOCITY_1H")) {
        velocityCount += 1;
      }
      if (alert.matched_rule_ids.includes("RULE_02_UNUSUAL_AMOUNT_14D")) {
        unusualAmountCount += 1;
      }
      if (alert.matched_rule_ids.includes("RULE_03_REPEATED_SIMILAR_MERCHANT_1H")) {
        similarMerchantCount += 1;
      }
      if (alert.matched_rule_count > 1) {
        multiRuleCount += 1;
      }
    }

    return {
      totalLoaded: alerts.length,
      velocityCount,
      unusualAmountCount,
      similarMerchantCount,
      multiRuleCount,
    };
  }, [alerts]);

  function handleApplyFilters() {
    setAppliedFilters({ ...draftFilters });
  }

  function handleResetFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  }

  function handleQuickRuleSelect(ruleId: string) {
    const next = { ...draftFilters, ruleId };
    setDraftFilters(next);
    setAppliedFilters({ ...appliedFilters, ruleId });
  }

  function handleQuickWindowSelect(startDate: string, endDate: string) {
    const next = { ...draftFilters, startDate, endDate };
    setDraftFilters(next);
    setAppliedFilters({ ...appliedFilters, startDate, endDate });
  }

  function handleSelectAlert(alertId: string) {
    if (alertId !== selectedAlertId) {
      setHistory([]);
      setHistoryError(null);
      setSelectedAlertId(alertId);
    }
  }

  return (
    <div className="app-layout">
      {/* Narrow Sidebar */}
      <aside className="workspace-sidebar" aria-label="Workspace views and quick filters">
        <div className="sidebar-brand">
          <div className="sidebar-logo-mark" aria-hidden="true">
            S
          </div>
          <div>
            <div className="sidebar-brand-name">Sentinel</div>
            <div className="sidebar-brand-sub">Alert Investigation</div>
          </div>
        </div>

        <div className="sidebar-group">
          <span className="sidebar-group-title">Rule Views</span>
          <ul className="sidebar-nav-list">
            {SIDEBAR_RULE_VIEWS.map((view) => {
              const isActive = appliedFilters.ruleId === view.ruleId;
              return (
                <li key={view.label}>
                  <button
                    type="button"
                    className={`sidebar-nav-btn ${
                      isActive ? "sidebar-nav-btn-active" : ""
                    }`}
                    onClick={() => handleQuickRuleSelect(view.ruleId)}
                  >
                    <span>{view.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="sidebar-group">
          <span className="sidebar-group-title">Replay Windows</span>
          <ul className="sidebar-nav-list">
            {SIDEBAR_REPLAY_WINDOWS.map((win) => {
              const isActive =
                appliedFilters.startDate === win.startDate &&
                appliedFilters.endDate === win.endDate;
              return (
                <li key={win.label}>
                  <button
                    type="button"
                    className={`sidebar-nav-btn ${
                      isActive ? "sidebar-nav-btn-active" : ""
                    }`}
                    onClick={() =>
                      handleQuickWindowSelect(win.startDate, win.endDate)
                    }
                  >
                    <span>{win.label}</span>
                    <span className="sidebar-nav-meta">{win.range}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="sidebar-footer">
          <div
            className={`source-badge ${
              alertsError ? "source-badge-error" : "source-badge-live"
            }`}
          >
            {alertsError ? "SQL Connection Error" : "Databricks SQL Connected"}
          </div>
          <details className="sidebar-tech-details">
            <summary>Data Source Tables</summary>
            <div className="sidebar-tech-body">
              <div>
                Alerts: <code>workspace.sentinel_gold.alerts</code>
              </div>
              <div>
                History: <code>workspace.sentinel_silver.transactions</code>
              </div>
            </div>
          </details>
        </div>
      </aside>

      {/* Main Investigation Workspace */}
      <div className="workspace-shell">
        <header className="workspace-header">
          <div className="brand-block">
            <div className="eyebrow-row">
              <span className="eyebrow-pill">Phase 3 Investigation Workspace</span>
              <span
                className={`source-badge ${
                  alertsError ? "source-badge-error" : "source-badge-live"
                }`}
              >
                {alertsError
                  ? "Databricks SQL: Connection / Query Error"
                  : "Live: Databricks SQL"}
              </span>
            </div>
            <h1>Transaction Monitoring &amp; Alert Investigation</h1>
            <p className="header-description">
              Review flagged card payments, plain-language rule evidence, and strictly
              earlier card transactions before the alert time.
            </p>
          </div>

          <div className="summary-strip" aria-label="Counts in loaded results">
            <div className="summary-pill summary-pill-accent">
              <span className="summary-label">Loaded Alerts (cap {appliedLimit})</span>
              <span className="summary-value">{loadedSummary.totalLoaded}</span>
            </div>
            <div className="summary-pill">
              <span className="summary-label">Rule 1 Velocity (loaded)</span>
              <span className="summary-value">{loadedSummary.velocityCount}</span>
            </div>
            <div className="summary-pill">
              <span className="summary-label">Rule 2 Unusual Amt (loaded)</span>
              <span className="summary-value">{loadedSummary.unusualAmountCount}</span>
            </div>
            <div className="summary-pill">
              <span className="summary-label">Rule 3 Similar Merch (loaded)</span>
              <span className="summary-value">{loadedSummary.similarMerchantCount}</span>
            </div>
            <div className="summary-pill">
              <span className="summary-label">Multi-Rule (loaded)</span>
              <span className="summary-value">{loadedSummary.multiRuleCount}</span>
            </div>
          </div>
        </header>

        <AlertFiltersBar
          draftFilters={draftFilters}
          isLoading={isAlertsLoading}
          onDraftChange={setDraftFilters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
        />

        <main className="workspace-grid">
          <AlertQueuePane
            alerts={alerts}
            appliedLimit={appliedLimit}
            selectedAlertId={selectedAlertId}
            isLoading={isAlertsLoading}
            errorMessage={alertsError}
            onSelectAlert={handleSelectAlert}
            onRetry={() => setAlertsReloadToken((n) => n + 1)}
          />

          <AlertDetailPane
            selectedAlert={selectedAlert}
            history={selectedAlertId ? history : []}
            historyLimit={historyLimit}
            isHistoryLoading={isHistoryLoading}
            historyError={historyError}
            onRetryHistory={() => setHistoryReloadToken((n) => n + 1)}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
