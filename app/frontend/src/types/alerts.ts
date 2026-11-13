export type ReviewStatus = "Needs review" | "In review" | "Closed";

export interface RuleEvidence {
  rule_id: string;
  rule_version: string;
  window: string;
  observed_metrics: string;
  threshold_definition: string;
}

export interface GoldAlert {
  alert_id: string;
  trans_num: string;
  ruleset_version: string;
  event_time: string;
  cc_num: string;
  merchant: string;
  category: string | null;
  amount: string;
  replay_batch: string;
  source_file: string;
  source_row_index: string;
  card_txn_count_1h: number;
  card_txn_count_14d: number;
  card_avg_amount_14d: string | null;
  unusual_amount_threshold_14d: string | null;
  card_merchant_txn_count_1h: number;
  card_merchant_similar_amount_count_1h: number;
  similar_amount_lower_bound: string;
  similar_amount_upper_bound: string;
  matched_rule_count: number;
  matched_rule_ids: string[];
  matched_rule_versions: string[];
  rule_evidence: RuleEvidence[];
  review_status: ReviewStatus;
  review_notes: string;
  review_updated_at: string | null;
}

export interface AlertReviewRecord {
  alert_id: string;
  review_status: ReviewStatus;
  review_notes: string;
  review_updated_at: string | null;
}

export interface AlertReviewSaveResponse {
  status: string;
  source: string;
  table: string;
  review: AlertReviewRecord;
}

export interface CardHistoryTransaction {
  trans_num: string;
  cc_num: string;
  merchant: string;
  category: string | null;
  amount: string;
  event_time: string;
  replay_batch: string;
  source_file: string;
  source_row_index: string;
}

export interface AlertQueryFilters {
  ruleId: string;
  startDate: string;
  endDate: string;
  search: string;
  limit: number;
}

export interface AppliedAlertFilters {
  ruleId: string | null;
  multiRuleOnly: boolean;
  startDate: string | null;
  endDate: string | null;
  search: string | null;
  limit: number;
}

export interface AlertsListResponse {
  status: string;
  source: string;
  table: string;
  count: number;
  filters: AppliedAlertFilters;
  alerts: GoldAlert[];
}

export interface AlertHistoryResponse {
  status: string;
  source: string;
  alertTable: string;
  historyTable: string;
  historyWindow: string;
  limit: number;
  alert: GoldAlert;
  historyCount: number;
  history: CardHistoryTransaction[];
}

export interface AlertSummaryResponse {
  status: string;
  alertId: string;
  model: string;
  historyWindow: string;
  historyCount: number;
  historyLimit: number;
  summary: string;
}

export interface GenieAskResponse {
  status: string;
  source: string;
  aiGenerated: boolean;
  conversationId: string;
  messageId: string;
  question: string;
  answer: string;
  sql: string | null;
  columns: string[];
  rows: Array<Array<string | null>>;
  displayedRowCount: number;
  totalRowCount: number;
  rowCap: number;
}
