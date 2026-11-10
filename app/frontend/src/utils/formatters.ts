import type { GoldAlert, RuleEvidence } from "../types/alerts";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Mask a card number so only the last 4 digits are shown (e.g., "•••• 1234").
 */
export function maskCardNumber(ccNum: string | null | undefined): string {
  if (!ccNum) {
    return "••••";
  }
  const trimmed = ccNum.trim();
  if (trimmed.length <= 4) {
    return `•••• ${trimmed}`;
  }
  return `•••• ${trimmed.slice(-4)}`;
}

/**
 * Format a decimal string (e.g. "180.50") as USD currency ("$180.50").
 */
export function formatCurrency(amount: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") {
    return "—";
  }
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) {
    return `$${amount}`;
  }
  return usdFormatter.format(numeric);
}

/**
 * Full human-readable title for a monitoring rule ID.
 */
export function formatRuleTitle(ruleId: string): string {
  switch (ruleId) {
    case "RULE_01_CARD_VELOCITY_1H":
      return "High Card Velocity in 1 Hour";
    case "RULE_02_UNUSUAL_AMOUNT_14D":
      return "Unusual Amount vs. 14-Day Card Average";
    case "RULE_03_REPEATED_SIMILAR_MERCHANT_1H":
      return "Repeated Similar-Amount Payment at Same Merchant (1h)";
    default:
      return ruleId;
  }
}

/**
 * Compact badge label for the alert queue list.
 */
export function formatRuleBadge(ruleId: string): string {
  switch (ruleId) {
    case "RULE_01_CARD_VELOCITY_1H":
      return "R1 · Velocity 1h";
    case "RULE_02_UNUSUAL_AMOUNT_14D":
      return "R2 · Unusual Amt 14d";
    case "RULE_03_REPEATED_SIMILAR_MERCHANT_1H":
      return "R3 · Similar Merch 1h";
    default:
      return ruleId;
  }
}

const METRIC_LABELS: Record<string, string> = {
  amount: "Transaction amount",
  card_txn_count_1h: "Earlier card txns (1h)",
  card_txn_count_14d: "Earlier card txns (14d)",
  card_avg_amount_14d: "14-day average amount",
  unusual_amount_threshold_14d: "3× unusual-amount threshold",
  card_merchant_txn_count_1h: "Earlier same-merchant txns (1h)",
  card_merchant_similar_amount_count_1h: "Earlier similar-amount txns (1h)",
  similar_amount_lower_bound: "Lower bound (−10%)",
  similar_amount_upper_bound: "Upper bound (+10%)",
};

const CURRENCY_METRIC_KEYS = new Set([
  "amount",
  "card_avg_amount_14d",
  "unusual_amount_threshold_14d",
  "similar_amount_lower_bound",
  "similar_amount_upper_bound",
]);

/**
 * Split comma-separated observed_metrics (e.g. "amount=180.50, card_avg_amount_14d=45.00")
 * into readable plain-language items with formatted money values where applicable.
 */
export function formatObservedMetricsList(observedMetrics: string): string[] {
  if (!observedMetrics) {
    return [];
  }
  return observedMetrics
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((pair) => {
      const [rawKey, rawValue] = pair.split("=");
      if (!rawKey || rawValue === undefined) {
        return pair;
      }
      const key = rawKey.trim();
      const val = rawValue.trim();
      const label = METRIC_LABELS[key] ?? key;
      if (CURRENCY_METRIC_KEYS.has(key)) {
        return `${label}: ${formatCurrency(val)}`;
      }
      return `${label}: ${val}`;
    });
}

/**
 * Plain-language explanation of why a specific rule matched this transaction.
 */
export function describeRuleEvidencePlainly(
  evidence: RuleEvidence,
  alert: GoldAlert
): string {
  switch (evidence.rule_id) {
    case "RULE_01_CARD_VELOCITY_1H":
      return `This card had ${alert.card_txn_count_1h} earlier transaction${
        alert.card_txn_count_1h === 1 ? "" : "s"
      } in the 1-hour window before this payment (rule triggers at 3 or more earlier transactions).`;

    case "RULE_02_UNUSUAL_AMOUNT_14D":
      return `Payment of ${formatCurrency(
        alert.amount
      )} exceeds 3× the card's 14-day average of ${formatCurrency(
        alert.card_avg_amount_14d
      )} across ${alert.card_txn_count_14d} earlier transactions (threshold: ${formatCurrency(
        alert.unusual_amount_threshold_14d
      )}, minimum 5 earlier transactions).`;

    case "RULE_03_REPEATED_SIMILAR_MERCHANT_1H":
      return `This card had ${
        alert.card_merchant_similar_amount_count_1h
      } earlier payment${
        alert.card_merchant_similar_amount_count_1h === 1 ? "" : "s"
      } at ${alert.merchant} within ±10% (${formatCurrency(
        alert.similar_amount_lower_bound
      )} to ${formatCurrency(
        alert.similar_amount_upper_bound
      )}) in the prior 1 hour (rule triggers at 2 or more).`;

    default:
      return `Matched rule ${evidence.rule_id} (${evidence.window} window): ${evidence.threshold_definition}.`;
  }
}
