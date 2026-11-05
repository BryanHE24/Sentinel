# Active Context: Sentinel

## Session Metadata

- Last updated: 2026-11-05
- Active role: Architect
- Mode: PLANNING

## Project

Sentinel is a fintech transaction monitoring and investigation platform.

Transactions are validated, enriched with earlier activity, and assessed
using monitoring rules. Alerts provide evidence for analyst review.
An alert does not automatically establish fraud or block a transaction.

## Current Objective

Configure ACE for Sentinel, then implement Phase 2:
trusted data, historical features, monitoring rules, and Gold evidence.

## Development Workflow

- Edit code and documentation in VS Code.
- Preserve existing notebooks in .ipynb format.
- Commit and push to GitHub.
- Pull the same branch in the Databricks Git folder.
- Execute notebooks using Serverless notebook compute.
- Inspect actual results before recording verification as passed.
- Pull locally before editing if changes were committed in Databricks.

Work one step at a time:
explain → implement → run → inspect → document → commit.

## Phase 1: Completed and Verified

- Assessed 1,852,394 records across fraudTrain.csv and fraudTest.csv.
- Selected 71,934 transactions across 42 dates.
- Initial history: January 1–14, 2019; 24,144 transactions.
- Rule development: January 15–28; 23,731 transactions.
- Evaluation: January 29–February 11; 24,059 transactions.
- Prepared daily Parquet batches and a count manifest.
- Stored fraud labels separately from operational replay inputs.
- Released January 1: 2,414 transactions.
- Ingested the released batch into Bronze using Auto Loader.
- Verified 2,414 unique transaction IDs.
- Reran ingestion with the same checkpoint; no rows were added.
- Phase 1 final commit: a81ba70.

## Existing Notebooks

- explorations/01_source_assesment.ipynb
- scripts/02_prepare_replay.ipynb
- scripts/03_release_replay.ipynb
- pipelines/01_bronze_transactions.ipynb

The assessment filename above reflects the existing repository spelling.

## Phase 2 Status

Silver implementation was discussed, but execution has not been confirmed.

Planned work:
1. Silver typing, validation, quarantine, and duplicate handling.
2. Historical features using strictly earlier events.
3. Three versioned monitoring rules.
4. Gold alerts and supporting evidence.
5. Transformation, join-grain, and rule-boundary tests.

## Established Decisions

- Use trans_num as the transaction identifier.
- Preserve cc_num as a string.
- Use trans_date_trans_time parsed as TIMESTAMP_NTZ for event ordering.
- The source timezone is unspecified.
- Preserve unix_time in Bronze; its discrepancy remains unexplained.
- Exclude fraud labels from monitoring features, rules, and AI inputs.
- Keep evaluation batches unreleased until thresholds are frozen.

## Implementation Requirements

- Use descriptive names and focused notebook cells.
- Explain purpose and important decisions in comments.
- Account for every input row.
- Preserve one accepted row per transaction ID.
- Prevent future events from entering historical features.
- Preserve intended row counts when joining data.
- Distinguish proposed checks from executed checks.

## Next Steps

1. Customize coding standards for SQL, PySpark, and notebooks.
2. Configure verification commands appropriate to Sentinel.
3. Record the Phase 2 implementation plan.
4. Continue Silver implementation and inspect its results.

## Verification Limitations

ACE's generated test command has not been configured for Sentinel.
Local checks do not establish that Databricks execution succeeded.
The automated ACE loop is not configured for this project.