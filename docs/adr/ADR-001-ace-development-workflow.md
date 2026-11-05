# ADR-001: Use ACE for Sentinel development

## Status

Accepted — 2026-11-05.

## Context

Sentinel combines Databricks notebooks and application development.
We need consistent coding standards, persistent project context,
and verification supported by actual execution results.

## Decision

Use ACE Framework 2.7.0 to organize AI-assisted development.

- Maintain project state in docs/context/ACTIVE_CONTEXT.md.
- Follow Sentinel-specific standards in .ace/standards/coding.md.
- Record implementation plans before changing pipeline behavior.
- Record significant architectural decisions in docs/adr/.
- Check applicable regression guards before modifying protected behavior.

Edit primarily in VS Code, commit and push to GitHub,
then pull and execute in the Databricks Git folder.

Preserve existing notebooks in .ipynb format.

## Verification

Use manual Databricks execution initially.
Record actual inputs, outputs, and verification results.

ACE's automated verification gate remains unconfigured.
Do not run the automated loop until meaningful verification
commands have been configured and tested.

Local checks do not establish that Databricks execution succeeded.

## Consequences

Development context and standards are versioned with the code.
Databricks remains the execution environment for data workloads.

The AI assistant must read the relevant ACE files.
Installing ACE alone does not guarantee that an assistant loads them.