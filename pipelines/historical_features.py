"""Shared point-in-time historical feature transformations for Sentinel."""

from decimal import Decimal
from pyspark.sql import DataFrame
from pyspark.sql import functions as F
from pyspark.sql.window import Window

ONE_HOUR_SECONDS = 3600
FOURTEEN_DAYS_SECONDS = 14 * 86400  # 1,209,600 seconds
DEFAULT_SIMILAR_AMOUNT_TOLERANCE_PCT = Decimal("0.10")

FEATURE_COLUMNS = [
    "card_txn_count_1h",
    "card_txn_count_14d",
    "card_avg_amount_14d",
    "card_merchant_txn_count_1h",
    "card_merchant_similar_amount_count_1h",
]


def compute_historical_features(
    df: DataFrame,
    similar_amount_tolerance_pct: Decimal = DEFAULT_SIMILAR_AMOUNT_TOLERANCE_PCT,
) -> DataFrame:
    """
    Compute point-in-time historical features per transaction (1 row per trans_num).

    Windows include the lower boundary (-1h or -14d) and strictly exclude
    the current timestamp (offset 0) and all future events (offset > 0):
    - card_txn_count_1h: prior card payments in [event_time - 1h, event_time)
    - card_txn_count_14d: prior card payments in [event_time - 14d, event_time)
    - card_avg_amount_14d: prior card average amount in [event_time - 14d, event_time),
      or NULL when card_txn_count_14d == 0
    - card_merchant_txn_count_1h: prior card+merchant payments in [event_time - 1h, event_time)
    - card_merchant_similar_amount_count_1h: prior card+merchant payments in
      [event_time - 1h, event_time) whose amount is within +/- similar_amount_tolerance_pct
      of the current transaction amount
    """
    tolerance_dec = Decimal(str(similar_amount_tolerance_pct))
    lower_factor = F.lit(Decimal("1.00") - tolerance_dec)
    upper_factor = F.lit(Decimal("1.00") + tolerance_dec)

    with_epoch = df.withColumn(
        "_event_seconds",
        F.expr("TIMESTAMPDIFF(SECOND, TIMESTAMP_NTZ '1970-01-01 00:00:00', event_time)"),
    )

    card_1h_window = (
        Window.partitionBy("cc_num")
        .orderBy("_event_seconds")
        .rangeBetween(-ONE_HOUR_SECONDS, -1)
    )
    card_14d_window = (
        Window.partitionBy("cc_num")
        .orderBy("_event_seconds")
        .rangeBetween(-FOURTEEN_DAYS_SECONDS, -1)
    )
    card_merchant_1h_window = (
        Window.partitionBy("cc_num", "merchant")
        .orderBy("_event_seconds")
        .rangeBetween(-ONE_HOUR_SECONDS, -1)
    )

    avg_14d_raw = F.avg("amount").over(card_14d_window)
    prior_merchant_amounts_1h = F.collect_list("amount").over(card_merchant_1h_window)

    return (
        with_epoch.withColumn(
            "card_txn_count_1h",
            F.count(F.lit(1)).over(card_1h_window).cast("long"),
        )
        .withColumn(
            "card_txn_count_14d",
            F.count(F.lit(1)).over(card_14d_window).cast("long"),
        )
        .withColumn(
            "card_avg_amount_14d",
            F.when(
                F.col("card_txn_count_14d") > 0,
                F.round(avg_14d_raw, 2).cast("decimal(18,2)"),
            ).otherwise(F.lit(None).cast("decimal(18,2)")),
        )
        .withColumn(
            "card_merchant_txn_count_1h",
            F.count(F.lit(1)).over(card_merchant_1h_window).cast("long"),
        )
        .withColumn(
            "_prior_merchant_amounts_1h",
            prior_merchant_amounts_1h,
        )
        .withColumn(
            "card_merchant_similar_amount_count_1h",
            F.size(
                F.filter(
                    F.col("_prior_merchant_amounts_1h"),
                    lambda prior_amt: (prior_amt >= (F.col("amount") * lower_factor))
                    & (prior_amt <= (F.col("amount") * upper_factor)),
                )
            ).cast("long"),
        )
        .drop("_event_seconds", "_prior_merchant_amounts_1h")
    )


def assert_feature_grain_and_null_semantics(
    input_df: DataFrame, feature_df: DataFrame
) -> dict[str, int]:
    """Verify 1:1 transaction grain, NULL average semantics, and count invariants."""
    metrics = (
        feature_df.agg(
            F.count("*").alias("output_rows"),
            F.countDistinct("trans_num").alias("distinct_trans_num"),
            F.sum(F.when(F.col("card_txn_count_14d") == 0, 1).otherwise(0)).alias(
                "no_14d_history_rows"
            ),
            F.sum(F.when(F.col("card_txn_count_14d") > 0, 1).otherwise(0)).alias(
                "with_14d_history_rows"
            ),
            F.sum(
                F.when(
                    (F.col("card_txn_count_14d") == 0)
                    & F.col("card_avg_amount_14d").isNotNull(),
                    1,
                ).otherwise(0)
            ).alias("invalid_non_null_avg_when_no_history"),
            F.sum(
                F.when(
                    (F.col("card_txn_count_14d") > 0)
                    & F.col("card_avg_amount_14d").isNull(),
                    1,
                ).otherwise(0)
            ).alias("invalid_null_avg_when_history_exists"),
            F.sum(
                F.when(
                    (F.col("card_merchant_similar_amount_count_1h") < 0)
                    | (
                        F.col("card_merchant_similar_amount_count_1h")
                        > F.col("card_merchant_txn_count_1h")
                    )
                    | (F.col("card_merchant_txn_count_1h") > F.col("card_txn_count_1h")),
                    1,
                ).otherwise(0)
            ).alias("invalid_count_hierarchy_rows"),
        )
        .collect()[0]
        .asDict()
    )

    input_rows = input_df.count()
    if metrics["output_rows"] != input_rows:
        raise AssertionError(
            f"Row count mismatch: input={input_rows}, output={metrics['output_rows']}"
        )
    if metrics["distinct_trans_num"] != input_rows:
        raise AssertionError(
            f"Duplicate trans_num detected: output={metrics['output_rows']}, distinct={metrics['distinct_trans_num']}"
        )
    if metrics["invalid_non_null_avg_when_no_history"] != 0:
        raise AssertionError(
            "Found non-NULL card_avg_amount_14d when card_txn_count_14d == 0"
        )
    if metrics["invalid_null_avg_when_history_exists"] != 0:
        raise AssertionError(
            "Found NULL card_avg_amount_14d when card_txn_count_14d > 0"
        )
    if metrics["invalid_count_hierarchy_rows"] != 0:
        raise AssertionError(
            "Count hierarchy violated: expected 0 <= similar_merchant_1h <= merchant_1h <= card_1h"
        )

    return {k: int(v or 0) for k, v in metrics.items()}
