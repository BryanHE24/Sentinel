# Sentinel Coding Standards

## 1. Readability and Learning

- Follow `.ace/standards/pyspark-associate-level.md`. It overrides this file for PySpark style.
- Prefer straightforward SQL/PySpark that a learner can explain.
- Treat cell, function, and fixture length targets as preferences for readability, not rigid rules.
- Use descriptive names and explicit transformations.
- Keep implementation simple and focused on the current requirement.
- Avoid unnecessary abstractions, repeated computation, and checks.
- Never hide complexity in large helper modules or copy pipeline logic into separate tests.
- Do not add shared Python modules or `sys.path` edits for notebook logic;
  keep step functions in the notebook that uses them.
- Preserve essential validation, earlier-only history, and alert evidence.
- Add concise comments explaining each cell's purpose and key decisions.
- Avoid comments that merely repeat obvious syntax.
- Remove abandoned code once replacement verification passes in Databricks; Git preserves its history.

## 2. Repository Organization

- Preserve existing tracked notebooks in .ipynb format.
- Use numbered snake_case names for ordered notebooks.
- Do not rename existing files without updating their references.
- Keep source assessment in explorations/.
- Keep replay preparation and release utilities in scripts/.
- Keep ingestion and transformation notebooks in pipelines/.
- Keep in-notebook self-tests calling the actual transformation functions in `pipelines/`, and cross-table equivalence checks in `tests/` (preserve legacy test files and modules until Databricks validation passes).
- Keep basic count and uniqueness checks in pipeline notebooks.
- Keep project decisions, plans, and findings in docs/.
- Keep downloaded datasets and generated data out of Git.

## 3. Notebook Structure

- Begin with a Markdown cell describing purpose, inputs, and outputs.
- Markdown explains purpose, reasoning, and a small example.
- Use short cells with one clear purpose (`read → transform → save → verify`).
- Organize pipeline cells into configuration, step functions, self-test, real execution, persistence,
  and basic count/uniqueness checks where applicable.
- Define imports and configuration before using them.
- Ensure a fresh session can run the notebook from top to bottom.
- Document cells that write, replace, or release data.
- Clear sensitive or bulky outputs before committing notebooks.
- Verify that VS Code preserves notebook metadata and cell structure.

## 4. Python and PySpark

- Follow PEP 8 and use snake_case for variables and functions.
- Use `from pyspark.sql import functions as F` consistently.
- Prefer clear Spark SQL or DataFrame expressions over Python UDFs.
- No `lambda` inside higher-order functions (`F.filter`, `F.transform`), no `rangeBetween` epoch-second tricks,
  no `to_json` fingerprints. Use `F.array_compact`, struct field projection (`col("arr.field")`),
  self-joins with `INTERVAL`, and `F.collect_set(F.struct(...))` per `.ace/standards/pyspark-associate-level.md`.
- Keep transformations readable inline or in small step functions rather than wrapped in heavy helpers.
- Reuse computed DataFrames or saved intermediate tables (`workspace.sentinel_gold.transaction_features`) instead of recomputing transformations across notebooks.
- Avoid collecting full datasets into driver memory.
- Use small, explicit samples for inspection.
- Use descriptive names for thresholds, paths, and table references.
- Use print and display for concise interactive verification.
- Never print credentials or unnecessary personal data.

## 5. SQL and Data Types

- Use uppercase SQL keywords and readable multiline formatting.
- Select explicit columns in curated Silver and Gold outputs.
- Preserve identifiers as strings.
- Represent monetary amounts using `DECIMAL(18,2)`.
- Validate `amt` as ordinary numeric text with an optional leading minus sign and at most two decimal places (`^-?[0-9]+(\.[0-9]{1,2})?$`) plus `try_cast(amt AS DECIMAL(18, 2))`.
- Record malformed, out-of-range, or >2-decimal amount strings under `invalid_amount` (merging the legacy `unparseable_or_out_of_range_amount` and `amount_precision_changed` reasons; non-ordinary numeric strings such as `+5`, `.50`, or `1e3` are also rejected as `invalid_amount`), and record `<= 0` amounts under `non_positive_amount`.
- Use `try_cast` where malformed input must be classified without failing in ANSI mode.
- Use `TIMESTAMP_NTZ` for the source transaction clock time.
- Do not assume a source timezone or repair `unix_time` without evidence.

## 6. Silver Quality and Row Accounting

- Preserve Bronze as the traceable ingestion record.
- Define required fields and validation reasons explicitly.
- Preserve all applicable validation reasons for rejected rows using `F.array_compact(F.array(...))`.
- Account for every input row as accepted, quarantined,
  or explicitly recorded as a duplicate.
- Define duplicate handling before applying deduplication.
- Do not arbitrarily choose between conflicting transaction records (including when one copy has invalid fields).
- Keep accepted transaction IDs unique.
- Retain source references needed to investigate rejected records.
- Verify saved outputs with basic count and uniqueness checks.

## 7. Historical Features

- Define each feature's entity, time window, and output grain.
- Use only events strictly earlier than the transaction being assessed (`prev_event_time < event_time` and `prev_event_time >= event_time - INTERVAL ...`).
- Exclude equal-time events unless a verified ordering is established.
- Define inclusive and exclusive window boundaries explicitly.
- Handle insufficient history explicitly (`0` counts and `NULL` 14-day average).
- Never replace missing history with an unexplained default.
- Persist transaction features to `workspace.sentinel_gold.transaction_features` so downstream monitoring rules read a table rather than importing a shared module.
- Verify that transformations preserve one feature row per transaction.
- Test that adding future events does not change earlier features.

## 8. Monitoring Rules and Gold Outputs

- Give each rule a stable identifier and explicit version.
- Store thresholds and window definitions as named configuration.
- Freeze rule configuration before releasing evaluation batches.
- Exclude fraud labels from features, monitoring rules, and AI context.
- Produce one alert per flagged transaction for the active ruleset.
- Preserve all matching rules and their versions.
- Record observed values, thresholds, and supporting evidence.
- Identify alerts deterministically (`alert_id = sha2(ruleset_version || '|' || trans_num, 256)`) and prevent duplicate output rows via full-snapshot `overwrite` and uniqueness assertions.
- Treat alerts as requests for review, not proof of fraud.

## 9. Writes and Incremental Processing

- Document whether each write appends, merges, or replaces data.
- Restrict overwrite operations to explicitly rebuildable outputs.
- Keep released landing files unchanged.
- Reuse the same checkpoint for the same ingestion stream.
- Never delete checkpoints as a routine rerun procedure.
- Verify reruns do not add unintended duplicate rows.
- Do not claim business-key deduplication from checkpoint behavior alone.
- Keep evaluation labels and ingestion state outside landing inputs.

## 10. Verification

- Keep small self-tests (calling the actual step functions) and basic count/uniqueness checks in pipeline notebooks.
- Keep cross-table equivalence checks in `tests/` (and preserve existing test notebooks until Databricks verification passes).
- Test missing required fields, malformed values, multiple errors on a single row, and duplicate IDs (including conflicting duplicates with an invalid occurrence).
- Test rules below, at, and above their thresholds.
- Test time boundaries, equal timestamps, and insufficient history.
- Check row reconciliation, key uniqueness, and join grain.
- Verify persisted counts against expected batch counts.
- Record the actual runtime, inputs, and results of executed checks.
- Mark unexecuted checks as pending.
- Local linting does not prove Databricks execution succeeded.
- Configure ACE verification commands before using its automated loop.

## 11. Development Workflow

- Read existing code and applicable decisions before editing.
- Check regression guards before modifying protected behavior.
- Explain → implement → run → inspect → document → commit.
- Edit primarily in VS Code.
- Push changes, pull in Databricks, then execute.
- Pull locally after any changes committed from Databricks.
- Use focused commits with descriptive messages.
- Never commit secrets, tokens, or credentials.

Last updated: 2026-11-09
