import type { FormEvent } from "react";
import type { ReviewStatus } from "../types/alerts";

export interface AnalystReviewFormProps {
  transNum: string;
  reviewUpdatedAt: string | null;
  reviewStatus: ReviewStatus;
  reviewNotes: string;
  isReviewDirty: boolean;
  isReviewSaving: boolean;
  reviewSaveError: string | null;
  reviewSavedMessage: string | null;
  onReviewStatusChange: (status: ReviewStatus) => void;
  onReviewNotesChange: (notes: string) => void;
  onSaveReview: () => void;
}

const REVIEW_STATUS_OPTIONS: ReviewStatus[] = [
  "Needs review",
  "In review",
  "Closed",
];

export function AnalystReviewForm({
  transNum,
  reviewUpdatedAt,
  reviewStatus,
  reviewNotes,
  isReviewDirty,
  isReviewSaving,
  reviewSaveError,
  reviewSavedMessage,
  onReviewStatusChange,
  onReviewNotesChange,
  onSaveReview,
}: AnalystReviewFormProps) {
  function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSaveReview();
  }

  return (
    <form
      className="detail-subsection review-form-section"
      onSubmit={handleReviewSubmit}
      aria-label="Analyst review"
    >
      <div className="subsection-header">
        <div>
          <h3>Analyst decision</h3>
          <p className="subsection-subtitle">
            Record the current review status and investigation notes for alert{" "}
            <code>{transNum}</code>.
          </p>
        </div>
        <div className="review-meta-row">
          {isReviewDirty && (
            <span className="unsaved-pill">Unsaved changes</span>
          )}
          <span className="loaded-count-badge">
            {reviewUpdatedAt
              ? `Last saved: ${reviewUpdatedAt}`
              : "Not yet saved · Defaults to Needs review"}
          </span>
        </div>
      </div>

      <div className="review-form-grid">
        <label className="filter-field review-status-field">
          <span className="filter-label">Review status</span>
          <select
            value={reviewStatus}
            disabled={isReviewSaving}
            onChange={(e) =>
              onReviewStatusChange(e.target.value as ReviewStatus)
            }
          >
            {REVIEW_STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field review-notes-field">
          <div className="review-notes-label-row">
            <span className="filter-label">Investigation notes</span>
            <span className="subsection-caption">
              {reviewNotes.length} / 2,000 characters
            </span>
          </div>
          <textarea
            className="review-notes-textarea"
            rows={3}
            maxLength={2000}
            placeholder="Record what you reviewed and your next step..."
            value={reviewNotes}
            disabled={isReviewSaving}
            onChange={(e) => onReviewNotesChange(e.target.value)}
          />
        </label>
      </div>

      <div className="review-actions-row">
        <button
          type="submit"
          className="btn-primary"
          disabled={isReviewSaving}
        >
          {isReviewSaving ? "Saving review…" : "Save review"}
        </button>

        {!isReviewSaving && reviewSavedMessage && (
          <span className="review-save-success" role="status">
            {reviewSavedMessage}
          </span>
        )}
      </div>

      {!isReviewSaving && reviewSaveError && (
        <div className="state-box state-error" role="alert">
          <p className="state-title">Unable to save review</p>
          <p className="state-detail">{reviewSaveError}</p>
        </div>
      )}
    </form>
  );
}
