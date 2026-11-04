-- Preserve original dataset files for assessment and reproducibility.
CREATE SCHEMA IF NOT EXISTS workspace.sentinel_sources;

CREATE VOLUME IF NOT EXISTS
  workspace.sentinel_sources.originals;