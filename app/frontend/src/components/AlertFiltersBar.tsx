import type { FormEvent } from "react";
import type { AlertQueryFilters } from "../types/alerts";

interface AlertFiltersBarProps {
  draftFilters: AlertQueryFilters;
  isLoading: boolean;
  onDraftChange: (updated: AlertQueryFilters) => void;
  onApply: () => void;
  onReset: () => void;
}

const DATE_PRESETS: Array<{ label: string; startDate: string; endDate: string }> = [
  { label: "All Dates", startDate: "", endDate: "" },
  { label: "Initial History (Jan 1–14)", startDate: "2019-01-01", endDate: "2019-01-14" },
  { label: "Rule Dev (Jan 15–28)", startDate: "2019-01-15", endDate: "2019-01-28" },
  { label: "Evaluation (Jan 29–Feb 11)", startDate: "2019-01-29", endDate: "2019-02-11" },
];

export function AlertFiltersBar({
  draftFilters,
  isLoading,
  onDraftChange,
  onApply,
  onReset,
}: AlertFiltersBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply();
  }

  function applyDatePreset(startDate: string, endDate: string) {
    onDraftChange({
      ...draftFilters,
      startDate,
      endDate,
    });
  }

  return (
    <form
      className="filters-bar glass-panel"
      onSubmit={handleSubmit}
      aria-label="Alert filters"
    >
      <div className="filters-row">
        <label className="filter-field">
          <span className="filter-label">Rule Filter</span>
          <select
            value={draftFilters.ruleId}
            onChange={(e) =>
              onDraftChange({ ...draftFilters, ruleId: e.target.value })
            }
          >
            <option value="">All Flagged Alerts</option>
            <option value="RULE_01_CARD_VELOCITY_1H">
              Rule 1 · Card Velocity (1h)
            </option>
            <option value="RULE_02_UNUSUAL_AMOUNT_14D">
              Rule 2 · Unusual Amount (14d)
            </option>
            <option value="RULE_03_REPEATED_SIMILAR_MERCHANT_1H">
              Rule 3 · Similar Merchant (1h)
            </option>
            <option value="MULTI_RULE">Multi-Rule Matches (2+)</option>
          </select>
        </label>

        <label className="filter-field">
          <span className="filter-label">Start Batch Date</span>
          <input
            type="date"
            value={draftFilters.startDate}
            onChange={(e) =>
              onDraftChange({ ...draftFilters, startDate: e.target.value })
            }
          />
        </label>

        <label className="filter-field">
          <span className="filter-label">End Batch Date</span>
          <input
            type="date"
            value={draftFilters.endDate}
            onChange={(e) =>
              onDraftChange({ ...draftFilters, endDate: e.target.value })
            }
          />
        </label>

        <label className="filter-field filter-field-search">
          <span className="filter-label">Search (Txn ID, Card, Merchant)</span>
          <input
            type="search"
            placeholder="e.g. Kirlin or last 4 digits…"
            maxLength={100}
            value={draftFilters.search}
            onChange={(e) =>
              onDraftChange({ ...draftFilters, search: e.target.value })
            }
          />
        </label>

        <label className="filter-field filter-field-limit">
          <span className="filter-label">Max Results</span>
          <select
            value={draftFilters.limit}
            onChange={(e) =>
              onDraftChange({ ...draftFilters, limit: Number(e.target.value) })
            }
          >
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
            <option value={200}>200 rows (max)</option>
          </select>
        </label>

        <div className="filter-actions">
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? "Loading…" : "Apply Filters"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={isLoading}
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="preset-row">
        <span className="preset-caption">Replay period shortcuts:</span>
        {DATE_PRESETS.map((preset) => {
          const isActive =
            draftFilters.startDate === preset.startDate &&
            draftFilters.endDate === preset.endDate;
          return (
            <button
              key={preset.label}
              type="button"
              className={`preset-pill ${isActive ? "preset-pill-active" : ""}`}
              onClick={() => applyDatePreset(preset.startDate, preset.endDate)}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </form>
  );
}
