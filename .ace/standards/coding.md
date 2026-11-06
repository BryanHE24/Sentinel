# Sentinel Coding Standards

## 1. Readability and Learning

- Prefer straightforward SQL/PySpark that a learner can explain.
- Use descriptive names and explicit transformations.
- Keep implementation simple and focused on the current requirement.
- Avoid unnecessary abstractions, repeated computation, and checks.
- Do not simplify by hiding large code blocks in helper modules.
- Preserve essential validation, earlier-only history, and alert evidence.
- Add concise comments explaining each cell's purpose and key decisions.
- Avoid comments that merely repeat obvious syntax.
- Remove abandoned code; Git preserves its history.

## 2. Repository Organization

- Preserve existing tracked notebooks in .ipynb format.
- Use numbered snake_case names for ordered notebooks.
- Do not rename existing files without updating their references.
- Keep source assessment in explorations/.
- Keep replay preparation and release utilities in scripts/.
- Keep ingestion and transformation notebooks in pipelines/.
- Keep synthetic tests and detailed verification in tests/.
- Keep basic count and uniqueness checks in pipeline notebooks.
- Keep project decisions, plans, and findings in docs/.
- Keep downloaded datasets and generated data out of Git.

## 3. Notebook Structure

- Begin with a Markdown cell describing purpose, inputs, and outputs.
- Markdown explains purpose, reasoning, and a small example.
- Use short cells with one clear purpose.
- Organize pipeline cells into configuration, transformation, persistence,
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
- Keep transformations readable inline rather than wrapped in heavy helpers.
- Reuse computed DataFrames instead of recomputing the same transformations.
- Avoid collecting full datasets into driver memory.
- Use small, explicit samples for inspection.
- Use descriptive names for thresholds, paths, and table references.
- Use print and display for concise interactive verification.
- Never print credentials or unnecessary personal data.

## 5. SQL and Data Types

- Use uppercase SQL keywords and readable multiline formatting.
- Select explicit columns in curated Silver and Gold outputs.
- Preserve identifiers as strings.
- Represent monetary amounts using an appropriate DECIMAL type.
- Validate source precision before accepting conversions that round.
- Use TRY_CAST where malformed input must be classified.
- Record failed conversions as validation failures.
- Use TIMESTAMP_NTZ for the source transaction clock time.
- Do not assume a source timezone or repair unix_time without evidence.

## 6. Silver Quality and Row Accounting

- Preserve Bronze as the traceable ingestion record.
- Define required fields and validation reasons explicitly.
- Preserve all applicable validation reasons for rejected rows.
- Account for every input row as accepted, quarantined,
  or explicitly recorded as a duplicate.
- Define duplicate handling before applying deduplication.
- Do not arbitrarily choose between conflicting transaction records.
- Keep accepted transaction IDs unique.
- Retain source references needed to investigate rejected records.
- Verify saved outputs with basic count and uniqueness checks.

## 7. Historical Features

- Define each feature's entity, time window, and output grain.
- Use only events strictly earlier than the transaction being assessed.
- Exclude equal-time events unless a verified ordering is established.
- Define inclusive and exclusive window boundaries explicitly.
- Handle insufficient history explicitly.
- Never replace missing history with an unexplained default.
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
- Keep alert identifiers stable across equivalent reruns.
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

- Keep basic count and uniqueness checks in pipeline notebooks.
- Keep synthetic fixture tests and detailed verification in tests/.
- Test invalid fields, malformed values, and duplicate IDs.
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

Last updated: 2026-11-06
