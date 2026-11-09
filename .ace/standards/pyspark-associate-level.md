# PySpark Associate-Level Standard

> Sentinel is a learning and portfolio project for the Databricks Data Engineer
> Associate path. The developer must be able to explain every line out loud.
> This standard overrides any "clever" or "senior" habit, and any generic skill
> that suggests more sophistication.
> Last updated: 2026-11-09

---

## 1. The explain test (applies to every cell)

Code is acceptable only if the developer can explain it in two sentences,
without looking anything up, to another data engineer.

- A cell does one thing. Prefer around 25 lines of logic as a guideline (treat line counts as preferences, not rigid rules).
- A function is preferably around 30 lines and is used at least twice, or isolates one step
  that the notebook explains (for example "Step 2: find duplicates").
- Nest at most two function calls inside one expression where practical.
- Every code cell is preceded by a Markdown cell: what it does, why, and a 2-3 row example.
- Prefer several small named steps over one long chain.
- Never hide complexity in large helper modules or copy pipeline transformation logic into separate test files.

## 2. Allowed toolbox

Use these first. They match the Associate exam objectives.

| Area | Allowed |
| --- | --- |
| Reading and writing | `spark.read`, `spark.table`, Auto Loader (`cloudFiles`), `write.format("delta")`, `saveAsTable`, `mode("append" / "overwrite")`, `MERGE INTO` (SQL) |
| Columns | `select`, `withColumn`, `filter`, `F.col`, `F.lit`, `F.when().otherwise()`, `cast`, `alias` |
| Text and dates | `F.trim`, `F.nullif`, `F.concat`, `F.concat_ws`, `F.format_string`, `F.to_date`, `F.to_timestamp`, `F.date_sub`, `rlike` |
| Aggregation | `groupBy().agg()` with `count`, `sum`, `avg`, `min`, `max`, `countDistinct`, `count_if` |
| Joins | `join` (inner, left, left_anti) on clear conditions |
| Windows | `Window.partitionBy().orderBy()` with `row_number`, `lag`, `count`, `sum` |
| Arrays and structs | `F.array`, `F.array_compact`, `F.size`, `F.struct`, `F.collect_set`, `F.explode`, struct field projection (`col("arr.field")`) |
| Checks | `assert`, `.count()`, `display()` |
| Spark SQL | Any plain SQL in `spark.sql` or `%sql` that the developer can read |

## 3. Not allowed without the developer's approval

| Avoid | Use instead |
| --- | --- |
| Python UDFs | Built-in functions |
| `F.filter` / `F.transform` / `F.aggregate` with a `lambda` | `F.array_compact`, struct field access (`col("arr.field")`), or `explode` then `groupBy` |
| `rangeBetween` over epoch seconds, `-1` second tricks | A self-join with `<` and `>=` on timestamps and `INTERVAL`, or `lag` |
| `to_json(struct(...))` as a fingerprint | `F.collect_set(F.struct(...))` or compare the columns directly |
| Casting twice (wide and narrow decimal) to detect rounding | `rlike` on the text (`^-?[0-9]+(\.[0-9]{1,2})?$`) plus `try_cast` |
| Shared Python modules, `sys.path` edits, classes, decorators | Functions defined in the notebook that uses them |
| `F.expr("...")` strings | Column API. Exceptions: `try_cast` and `INTERVAL` |
| Long `when` chains (> 4-5 branches) where a simpler split exists | A lookup table plus `join`, or split into named steps |
| Building column names or SQL dynamically | One `for` loop over a named list is the maximum |

## 4. When a requirement seems to need advanced code

1. Stop. Do not add the advanced construct.
2. Write the simplest version that meets the intent of the requirement.
3. In the plan, state in one line what is simplified or relaxed (for example
   "amount format and precision are checked with a regex pattern instead of a second wide-decimal cast").
4. Ask the developer. This is a Discuss-phase decision, not a Developer-role decision.

If a standard in `.ace/standards/` contradicts this file for PySpark style, this file wins.

## 5. Notebook layout

1. Markdown header: reads, writes, flow in one line.
2. Config cell: table names, thresholds, column lists as named constants.
3. Step functions, each after a Markdown cell with a small example.
4. Self-test: a small hand-made fixture (prefer ~15-20 rows as a guideline, not a rigid limit), run on the actual transformation function used on real data.
5. Real run, then save, then concise `assert` checks (prefer ~5 checks: row counts, unique keys, no label leakage).
6. Keep table flow clear: read input table → transform → save output table.

Never copy pipeline transformation logic into a separate test file. Tests must call the actual transformation function that the pipeline runs.

## 6. Databricks-native first

Prefer a platform feature the exam covers over clever DataFrame code: Auto Loader,
Delta tables and `MERGE`, Unity Catalog, Lakeflow Spark Declarative Pipelines
(expectations for data quality), and Lakeflow Jobs with task dependencies.

## 7. Required AI behaviour

Before writing code, the AI answers in at most 5 bullets:
- What the notebook reads and writes.
- The steps, in plain English.
- Which tools from section 2 it will use.
- Anything it wants to use from section 3 (the expected answer is "nothing").
- What it simplified compared with the requirement.

After writing code, the AI adds an explain-check: one sentence per cell. If it cannot
explain a cell in two sentences, it rewrites the cell more simply.
