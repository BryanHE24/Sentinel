# Project Context & Preferences

> Stable decisions captured in the **Discuss Phase**. The Architect and Developer
> treat everything here as a constraint during Plan and Execute.
> Unlike ACTIVE_CONTEXT.md (per session), this file changes rarely.

---

## Developer profile (read this first)

- **Goal of the project**: a learning and portfolio prototype that demonstrates Databricks Data Engineer Associate skills alongside a clean analyst investigation UI.
- **Level**: basic to intermediate PySpark and SQL.
- **Explainability is a requirement**: the developer must be able to explain every cell
  in an interview, so a simple correct solution beats a clever one.
- **Style rule**: follow `.ace/standards/pyspark-associate-level.md`. Treat line, row, and check counts as readable preferences rather than rigid rules. Never hide complexity in large helper modules or copy pipeline transformation logic into separate test notebooks.
  When a requirement seems to need advanced code, propose the simpler equivalent and ask.
- **Exam alignment**: prefer features covered by the Associate exam
  (Auto Loader, Delta Lake, Medallion layers, Unity Catalog, Lakeflow Jobs, Lakeflow Declarative Pipelines)
  over clever DataFrame code.

---

## Data layer

- **Platform**: Databricks (Serverless notebook compute, Unity Catalog catalog `workspace`).
- **Layers**: Bronze (`workspace.sentinel_bronze.transactions`) → Silver (`workspace.sentinel_silver.transactions`, `workspace.sentinel_silver.quarantine`) → Gold (`workspace.sentinel_gold.transaction_features`, `workspace.sentinel_gold.alerts`).
- **Table flow**: each pipeline notebook follows `read → transform → save` and writes a table. New pipeline code defines step functions inside the notebook that uses them rather than importing shared Python modules.
- **Lakeflow Job**: an existing Lakeflow Job orchestrates the pipeline; once notebook `03_historical_features` is validated, update the Job task sequence to run `01_bronze_transactions → 02_silver_transactions → 03_historical_features → 04_monitoring_rules` (Bronze → Silver → Historical features → Monitoring/Gold).
- **Write mode**: derived tables (Silver transactions/quarantine, Gold transaction_features, Gold alerts) are rebuilt with `overwrite`; Bronze is `append` through Auto Loader.
- **Query language**: PySpark DataFrame API for transformations, plain SQL for DDL and checks.

---

## Testing

- **Where**: a small hand-made self-test fixture inside each pipeline notebook, run on the actual transformation function that processes real data, plus `tests/00_refactor_equivalence_check.ipynb` for cross-table equivalence verification.
- **Pipeline checks**: concise `assert` checks after each save (row counts, unique keys, manifest reconciliation, no `is_fraud`).
- **Legacy tests & modules**: preserve `pipelines/historical_features.py`, `tests/02_silver_transactions_tests.ipynb`, and `tests/04_monitoring_rules_tests.ipynb` until Databricks validation and equivalence checks pass.

---

## Code style

- **Language**: Python (PySpark) and SQL
- **Notebook layout**: header → config → step functions with a Markdown explanation each → self-test → real run → save → checks
- **Naming**: snake_case, descriptive names, thresholds as named constants in the config cell

---

## Project-specific decisions

| Decision | Choice | Rationale | Date |
|---|---|---|---|
| PySpark complexity | Associate level only (`.ace/standards/pyspark-associate-level.md`) | Developer must understand and explain all code | 2026-11-09 |
| Amount validation policy | Ordinary numeric text with at most 2 decimals (`^-?[0-9]+(\.[0-9]{1,2})?$`) + `try_cast(amt AS DECIMAL(18, 2))` | Replaces double decimal cast; merges `unparseable_or_out_of_range_amount` and `amount_precision_changed` into `invalid_amount`; rejects non-ordinary numeric strings like `+5`, `.50`, `1e3` | 2026-11-09 |
| Duplicate detection | `collect_set(struct(*BUSINESS_COLUMNS))` over a `trans_num` window | No JSON fingerprint, handles `NULL` values natively, keeps invalid occurrences in conflict detection | 2026-11-09 |
| Null removal in arrays | `F.array_compact(F.array(...))` | Replaces `F.filter(..., lambda ...)` higher-order lambdas | 2026-11-09 |
| Feature calculation | Self-join with `<` and `>=` on timestamps (`INTERVAL 1 HOUR`, `INTERVAL 14 DAYS`), conditional `count(when(...))` | Easier to explain than epoch-second `rangeBetween(-3600, -1)` and `collect_list` array lambdas | 2026-11-09 |
| Gold features table | Saved as `workspace.sentinel_gold.transaction_features` | Notebook 04 reads a persisted table instead of importing `historical_features.py` | 2026-11-09 |
| Alert ID & duplicate prevention | `alert_id = sha2(ruleset_version || '|' || trans_num, 256)` identifies alerts; `overwrite` mode + uniqueness checks prevent duplicate output rows | Accurate distinction between deterministic ID generation and deduplication | 2026-11-09 |
| Rule thresholds & labels | Keep `ruleset-v1.0-frozen` thresholds unchanged; keep `is_fraud` outside monitoring | Preserves Phase 2 evaluation baseline integrity | 2026-11-09 |
