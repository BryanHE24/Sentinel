import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { AlertDetailPane } from "./components/AlertDetailPane";
import { AlertFiltersBar } from "./components/AlertFiltersBar";
import { AlertQueuePane } from "./components/AlertQueuePane";
import { AskGeniePanel } from "./components/AskGeniePanel";
import type {
  AlertHistoryResponse,
  AlertQueryFilters,
  AlertReviewSaveResponse,
  AlertsListResponse,
  AlertSummaryResponse,
  CardHistoryTransaction,
  GoldAlert,
  ReviewStatus,
} from "./types/alerts";

const DEFAULT_FILTERS: AlertQueryFilters = {
  ruleId: "",
  startDate: "",
  endDate: "",
  search: "",
  limit: 50,
};

interface ScopedSummaryState {
  alertId: string | null;
  result: AlertSummaryResponse | null;
  isLoading: boolean;
  error: string | null;
}

const INITIAL_SUMMARY_STATE: ScopedSummaryState = {
  alertId: null,
  result: null,
  isLoading: false,
  error: null,
};

interface ScopedReviewDraftState {
  alertId: string | null;
  status: ReviewStatus;
  notes: string;
}

const INITIAL_REVIEW_DRAFT: ScopedReviewDraftState = {
  alertId: null,
  status: "Needs review",
  notes: "",
};

interface ScopedReviewSaveState {
  alertId: string | null;
  isSaving: boolean;
  error: string | null;
  savedMessage: string | null;
}

const INITIAL_REVIEW_SAVE_STATE: ScopedReviewSaveState = {
  alertId: null,
  isSaving: false,
  error: null,
  savedMessage: null,
};

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

  const [summaryState, setSummaryState] =
    useState<ScopedSummaryState>(INITIAL_SUMMARY_STATE);
  const summaryAbortRef = useRef<AbortController | null>(null);

  const [reviewDraft, setReviewDraft] =
    useState<ScopedReviewDraftState>(INITIAL_REVIEW_DRAFT);
  const [reviewSaveState, setReviewSaveState] =
    useState<ScopedReviewSaveState>(INITIAL_REVIEW_SAVE_STATE);
  const reviewSaveAbortRef = useRef<AbortController | null>(null);

  // Abort any in-flight AI summary or review save request if selectedAlertId changes or unmounts.
  useEffect(() => {
    return () => {
      summaryAbortRef.current?.abort();
      reviewSaveAbortRef.current?.abort();
    };
  }, [selectedAlertId]);

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
          summaryAbortRef.current?.abort();
          reviewSaveAbortRef.current?.abort();
          setSummaryState(INITIAL_SUMMARY_STATE);
          setReviewDraft(INITIAL_REVIEW_DRAFT);
          setReviewSaveState(INITIAL_REVIEW_SAVE_STATE);
          return loadedAlerts[0]?.alert_id ?? null;
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        summaryAbortRef.current?.abort();
        reviewSaveAbortRef.current?.abort();
        setSummaryState(INITIAL_SUMMARY_STATE);
        setReviewDraft(INITIAL_REVIEW_DRAFT);
        setReviewSaveState(INITIAL_REVIEW_SAVE_STATE);
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

  const currentReviewStatus: ReviewStatus =
    selectedAlert && reviewDraft.alertId === selectedAlert.alert_id
      ? reviewDraft.status
      : (selectedAlert?.review_status ?? "Needs review");

  const currentReviewNotes: string =
    selectedAlert && reviewDraft.alertId === selectedAlert.alert_id
      ? reviewDraft.notes
      : (selectedAlert?.review_notes ?? "");

  const isReviewDirty: boolean =
    selectedAlert !== null &&
    reviewDraft.alertId === selectedAlert.alert_id &&
    (reviewDraft.status !== (selectedAlert.review_status ?? "Needs review") ||
      reviewDraft.notes.trim() !== (selectedAlert.review_notes ?? "").trim());

  // Warn before browser tab unload if the analyst has unsaved review edits.
  useEffect(() => {
    if (!isReviewDirty) {
      return;
    }
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isReviewDirty]);

  // Load strictly earlier card history (and fresh review fields) when the selected alert changes.
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

        if (data.alert && data.alert.alert_id === activeAlertId) {
          setAlerts((prev) =>
            prev.map((item) =>
              item.alert_id === activeAlertId
                ? {
                    ...item,
                    review_status:
                      data.alert.review_status ?? item.review_status,
                    review_notes: data.alert.review_notes ?? item.review_notes,
                    review_updated_at:
                      data.alert.review_updated_at ?? item.review_updated_at,
                  }
                : item
            )
          );
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

  const sidebarItems = useMemo(
    () => [
      {
        label: "Alert queue (all)",
        ruleId: "",
        count: loadedSummary.totalLoaded,
      },
      {
        label: "Payment velocity (1h)",
        ruleId: "RULE_01_CARD_VELOCITY_1H",
        count: loadedSummary.velocityCount,
      },
      {
        label: "Unusual amount (14d)",
        ruleId: "RULE_02_UNUSUAL_AMOUNT_14D",
        count: loadedSummary.unusualAmountCount,
      },
      {
        label: "Similar payments (1h)",
        ruleId: "RULE_03_REPEATED_SIMILAR_MERCHANT_1H",
        count: loadedSummary.similarMerchantCount,
      },
      {
        label: "Multi-rule (2+)",
        ruleId: "MULTI_RULE",
        count: loadedSummary.multiRuleCount,
      },
    ],
    [loadedSummary]
  );

  function confirmDiscardUnsavedReview(): boolean {
    if (!isReviewDirty) {
      return true;
    }
    return window.confirm(
      "You have unsaved review changes for this alert. Discard unsaved changes?"
    );
  }

  function handleApplyFilters() {
    if (!confirmDiscardUnsavedReview()) {
      return;
    }
    setReviewDraft(INITIAL_REVIEW_DRAFT);
    setReviewSaveState(INITIAL_REVIEW_SAVE_STATE);
    setAppliedFilters({ ...draftFilters });
  }

  function handleResetFilters() {
    if (!confirmDiscardUnsavedReview()) {
      return;
    }
    setReviewDraft(INITIAL_REVIEW_DRAFT);
    setReviewSaveState(INITIAL_REVIEW_SAVE_STATE);
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  }

  function handleQuickRuleSelect(ruleId: string) {
    if (appliedFilters.ruleId !== ruleId && !confirmDiscardUnsavedReview()) {
      return;
    }
    setReviewDraft(INITIAL_REVIEW_DRAFT);
    setReviewSaveState(INITIAL_REVIEW_SAVE_STATE);
    setDraftFilters((prev) => ({ ...prev, ruleId }));
    setAppliedFilters((prev) => ({ ...prev, ruleId }));
  }

  function handleSelectAlert(alertId: string) {
    if (alertId !== selectedAlertId) {
      if (!confirmDiscardUnsavedReview()) {
        return;
      }
      summaryAbortRef.current?.abort();
      reviewSaveAbortRef.current?.abort();
      setSummaryState(INITIAL_SUMMARY_STATE);
      setReviewDraft(INITIAL_REVIEW_DRAFT);
      setReviewSaveState(INITIAL_REVIEW_SAVE_STATE);
      setHistory([]);
      setHistoryError(null);
      setSelectedAlertId(alertId);
    }
  }

  function handleReviewStatusChange(nextStatus: ReviewStatus) {
    if (!selectedAlert) {
      return;
    }
    setReviewSaveState(INITIAL_REVIEW_SAVE_STATE);
    setReviewDraft({
      alertId: selectedAlert.alert_id,
      status: nextStatus,
      notes: currentReviewNotes,
    });
  }

  function handleReviewNotesChange(nextNotes: string) {
    if (!selectedAlert) {
      return;
    }
    setReviewSaveState(INITIAL_REVIEW_SAVE_STATE);
    setReviewDraft({
      alertId: selectedAlert.alert_id,
      status: currentReviewStatus,
      notes: nextNotes,
    });
  }

  async function handleSaveReview() {
    if (!selectedAlert) {
      return;
    }

    const targetAlertId = selectedAlert.alert_id;
    const statusToSave = currentReviewStatus;
    const notesToSave = currentReviewNotes.trim();

    reviewSaveAbortRef.current?.abort();
    const controller = new AbortController();
    reviewSaveAbortRef.current = controller;

    setReviewSaveState({
      alertId: targetAlertId,
      isSaving: true,
      error: null,
      savedMessage: null,
    });

    try {
      const response = await fetch(
        `/api/alerts/${encodeURIComponent(targetAlertId)}/review`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reviewStatus: statusToSave,
            reviewNotes: notesToSave,
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const message = await readErrorMessage(
          response,
          "Failed to save analyst review"
        );
        throw new Error(message);
      }

      const data = (await response.json()) as AlertReviewSaveResponse;
      if (controller.signal.aborted) {
        return;
      }

      const saved = data.review;

      // Update only the matching alert in the queue so another alert's review is never overwritten.
      setAlerts((prev) =>
        prev.map((item) =>
          item.alert_id === targetAlertId
            ? {
                ...item,
                review_status: saved.review_status,
                review_notes: saved.review_notes,
                review_updated_at: saved.review_updated_at,
              }
            : item
        )
      );

      setReviewDraft((current) => {
        if (current.alertId !== null && current.alertId !== targetAlertId) {
          return current;
        }
        return {
          alertId: targetAlertId,
          status: saved.review_status,
          notes: saved.review_notes,
        };
      });

      setReviewSaveState({
        alertId: targetAlertId,
        isSaving: false,
        error: null,
        savedMessage: saved.review_updated_at
          ? `Review saved (${saved.review_updated_at})`
          : "Review saved",
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setReviewSaveState({
        alertId: targetAlertId,
        isSaving: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save analyst review.",
        savedMessage: null,
      });
    }
  }

  async function handleGenerateSummary() {
    if (!selectedAlertId) {
      return;
    }

    const targetAlertId = selectedAlertId;
    summaryAbortRef.current?.abort();
    const controller = new AbortController();
    summaryAbortRef.current = controller;

    setSummaryState({
      alertId: targetAlertId,
      result: null,
      isLoading: true,
      error: null,
    });

    try {
      const response = await fetch(
        `/api/alerts/${encodeURIComponent(targetAlertId)}/summary`,
        {
          method: "POST",
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const message = await readErrorMessage(
          response,
          "Failed to generate evidence summary"
        );
        throw new Error(message);
      }

      const data = (await response.json()) as AlertSummaryResponse;
      if (controller.signal.aborted) {
        return;
      }

      setSummaryState((current) => {
        if (current.alertId !== targetAlertId) {
          return current;
        }
        return {
          alertId: targetAlertId,
          result: data,
          isLoading: false,
          error: null,
        };
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setSummaryState((current) => {
        if (current.alertId !== targetAlertId) {
          return current;
        }
        return {
          alertId: targetAlertId,
          result: null,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate evidence summary.",
        };
      });
    }
  }

  const isCurrentSummaryAlert =
    selectedAlertId !== null && summaryState.alertId === selectedAlertId;
  const isCurrentReviewSaveAlert =
    selectedAlertId !== null && reviewSaveState.alertId === selectedAlertId;

  return (
    <div className="app-layout">
      {/* Left Navy Sidebar */}
      <aside className="workspace-sidebar" aria-label="Workspace navigation">
        <div className="sidebar-brand">
          <div className="sidebar-brand-row">
            <span className="sidebar-diamond" aria-hidden="true" />
            <span className="sidebar-brand-name">sentinel</span>
          </div>
          <span className="sidebar-brand-sub">PAYMENT INTELLIGENCE</span>
        </div>

        <div className="sidebar-group">
          <span className="sidebar-group-title">WORKSPACE</span>
          <ul className="sidebar-nav-list">
            {sidebarItems.map((item) => {
              const isActive = appliedFilters.ruleId === item.ruleId;
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    className={`sidebar-nav-btn ${
                      isActive ? "sidebar-nav-btn-active" : ""
                    }`}
                    onClick={() => handleQuickRuleSelect(item.ruleId)}
                  >
                    <span>{item.label}</span>
                    <span className="sidebar-count-pill">{item.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-status-line">
            <span
              className={`status-dot ${
                alertsError ? "status-dot-error" : "status-dot-live"
              }`}
              aria-hidden="true"
            />
            <span>
              {alertsError ? "Connection error" : "Platform operational"}
            </span>
          </div>
          <div className="sidebar-footer-sub">Governed data · Unity Catalog</div>
          <div className="sidebar-footer-tag">
            <strong>FINTECH OPERATIONS</strong>
            <span>Investigation workspace</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="workspace-shell">
        <div className="topbar">
          <div className="breadcrumbs">
            <span>Operations</span>
            <span className="breadcrumb-sep">/</span>
            <strong>Alert queue</strong>
          </div>
          <div
            className={`source-badge ${
              alertsError ? "source-badge-error" : "source-badge-live"
            }`}
          >
            {alertsError
              ? "DATABRICKS SQL · CONNECTION ERROR"
              : "CONNECTED · DATABRICKS SQL"}
          </div>
        </div>

        <header className="console-header">
          <span className="section-eyebrow">RISK OPERATIONS CONSOLE</span>
          <h1>Every alert. Clear evidence.</h1>
          <p className="console-subtitle">
            Investigate unusual payments with context you can trust.
          </p>
        </header>

        {/* Compact Summary Cards (Loaded Results) */}
        <section
          className="summary-cards-grid"
          aria-label="Summary of loaded alert results"
        >
          <div className="summary-card">
            <span className="summary-card-label">Loaded alerts</span>
            <span className="summary-card-value">{loadedSummary.totalLoaded}</span>
            <span className="summary-card-foot summary-card-foot-ok">
              Showing up to {appliedLimit} loaded rows
            </span>
          </div>

          <div className="summary-card">
            <span className="summary-card-label">Payment velocity (loaded)</span>
            <span className="summary-card-value">{loadedSummary.velocityCount}</span>
            <span className="summary-card-foot">
              Rule 1 matches in loaded results
            </span>
          </div>

          <div className="summary-card">
            <span className="summary-card-label">Unusual amount (loaded)</span>
            <span className="summary-card-value">
              {loadedSummary.unusualAmountCount}
            </span>
            <span className="summary-card-foot">
              Rule 2 matches in loaded results
            </span>
          </div>

          <div className="summary-card">
            <span className="summary-card-label">Similar payments (loaded)</span>
            <span className="summary-card-value">
              {loadedSummary.similarMerchantCount}
            </span>
            <span className="summary-card-foot">
              Rule 3 matches in loaded results
            </span>
          </div>

          <div className="summary-card">
            <span className="summary-card-label">Multi-rule alerts (loaded)</span>
            <span className="summary-card-value">{loadedSummary.multiRuleCount}</span>
            <span className="summary-card-foot">
              2+ rules triggered in loaded results
            </span>
          </div>
        </section>

        <main className="workspace-content">
          <AlertQueuePane
            alerts={alerts}
            appliedLimit={appliedLimit}
            selectedAlertId={selectedAlertId}
            isLoading={isAlertsLoading}
            errorMessage={alertsError}
            onSelectAlert={handleSelectAlert}
            onRetry={() => setAlertsReloadToken((n) => n + 1)}
          >
            <AlertFiltersBar
              draftFilters={draftFilters}
              isLoading={isAlertsLoading}
              onDraftChange={setDraftFilters}
              onApply={handleApplyFilters}
              onReset={handleResetFilters}
            />
          </AlertQueuePane>

          <AlertDetailPane
            selectedAlert={selectedAlert}
            history={selectedAlertId ? history : []}
            historyLimit={historyLimit}
            isHistoryLoading={isHistoryLoading}
            historyError={historyError}
            onRetryHistory={() => setHistoryReloadToken((n) => n + 1)}
            summaryResult={isCurrentSummaryAlert ? summaryState.result : null}
            isSummaryLoading={isCurrentSummaryAlert ? summaryState.isLoading : false}
            summaryError={isCurrentSummaryAlert ? summaryState.error : null}
            onGenerateSummary={() => {
              void handleGenerateSummary();
            }}
            reviewStatus={currentReviewStatus}
            reviewNotes={currentReviewNotes}
            isReviewDirty={isReviewDirty}
            isReviewSaving={
              isCurrentReviewSaveAlert ? reviewSaveState.isSaving : false
            }
            reviewSaveError={
              isCurrentReviewSaveAlert ? reviewSaveState.error : null
            }
            reviewSavedMessage={
              isCurrentReviewSaveAlert ? reviewSaveState.savedMessage : null
            }
            onReviewStatusChange={handleReviewStatusChange}
            onReviewNotesChange={handleReviewNotesChange}
            onSaveReview={() => {
              void handleSaveReview();
            }}
          />

          <AskGeniePanel />
        </main>
      </div>
    </div>
  );
}

export default App;
