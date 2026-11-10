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
 * Plain-language title for a monitoring rule ID.
 */
export function formatRuleTitle(ruleId: string): string {
  switch (ruleId) {
    case "RULE_01_CARD_VELOCITY_1H":
      return "Payment velocity · rule triggered";
    case "RULE_02_UNUSUAL_AMOUNT_14D":
      return "Unusual amount · rule triggered";
    case "RULE_03_REPEATED_SIMILAR_MERCHANT_1H":
      return "Similar merchant payments · rule triggered";
    default:
      return `${ruleId} · rule triggered`;
  }
}

/**
 * Compact plain-language signal label for the review queue table.
 */
export function formatRuleBadge(ruleId: string): string {
  switch (ruleId) {
    case "RULE_01_CARD_VELOCITY_1H":
      return "Payment velocity (1h)";
    case "RULE_02_UNUSUAL_AMOUNT_14D":
      return "Unusual amount (14d)";
    case "RULE_03_REPEATED_SIMILAR_MERCHANT_1H":
      return "Similar payments (1h)";
    default:
      return ruleId;
  }
}

const METRIC_LABELS: Record<string, string> = {
  amount: "Selected amount",
  card_txn_count_1h: "Earlier 1h payments",
  card_txn_count_14d: "Earlier 14d payments",
  card_avg_amount_14d: "Earlier 14d average",
  unusual_amount_threshold_14d: "3× threshold",
  card_merchant_txn_count_1h: "Earlier 1h merchant payments",
  card_merchant_similar_amount_count_1h: "Earlier 1h similar payments",
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
      return `Card had ${alert.card_txn_count_1h} earlier payment${
        alert.card_txn_count_1h === 1 ? "" : "s"
      } within the prior 1 hour. Rule: at least 3 earlier payments on the same card within 1 hour.`;

    case "RULE_02_UNUSUAL_AMOUNT_14D":
      return `Selected amount: ${formatCurrency(
        alert.amount
      )}. Earlier 14-day average: ${formatCurrency(
        alert.card_avg_amount_14d
      )} across ${alert.card_txn_count_14d} earlier payments. Rule: amount > 3× earlier 14-day average (${formatCurrency(
        alert.unusual_amount_threshold_14d
      )}), with at least 5 earlier payments.`;

    case "RULE_03_REPEATED_SIMILAR_MERCHANT_1H":
      return `Selected amount: ${formatCurrency(
        alert.amount
      )} at ${alert.merchant}. Card had ${
        alert.card_merchant_similar_amount_count_1h
      } earlier payment${
        alert.card_merchant_similar_amount_count_1h === 1 ? "" : "s"
      } within ±10% (${formatCurrency(
        alert.similar_amount_lower_bound
      )}–${formatCurrency(
        alert.similar_amount_upper_bound
      )}) at this merchant in the prior 1 hour. Rule: at least 2 similar earlier payments.`;

    default:
      return `Matched rule ${evidence.rule_id} (${evidence.window} window): ${evidence.threshold_definition}.`;
  }
}
