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
      return "Rule 1 · Card Velocity (1h)";
    case "RULE_02_UNUSUAL_AMOUNT_14D":
      return "Rule 2 · Unusual Amount vs. 14d Average";
    case "RULE_03_REPEATED_SIMILAR_MERCHANT_1H":
      return "Rule 3 · Repeated Similar Merchant Payment (1h)";
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

/**
 * Split comma-separated observed_metrics (e.g. "amount=180.50, card_avg_amount_14d=45.00")
 * into readable items with formatted money values where applicable.
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
      if (key === "amount" || key === "card_avg_amount_14d") {
        return `${key}: ${formatCurrency(val)}`;
      }
      return `${key}: ${val}`;
    });
}
