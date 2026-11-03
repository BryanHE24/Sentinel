# Build journal

## Phase 1 — Foundation and data assessment

### Starting decisions

- Preserve original source files outside Git.
- Profile data before defining cleaning transformations.
- Preserve original transaction event dates during replay.
- Exclude fraud labels from monitoring features and AI evidence.
- Keep application records separate from pipeline outputs.

### Completed

- Created the initial repository structure.

### Validation

- Application deployment, connectivity, profiling, and ingestion
  have not yet been verified.

### Local application skeleton

- Created a React and TypeScript frontend with Vite.
- Created a Node.js and Express backend.
- Configured the backend to serve the compiled frontend.
- Verified that the frontend can call /api/health locally.
- SQL, AI, and Databricks deployment remain unverified.

### SQL connectivity verified

- Added the SQL warehouse as an app resource with Can use permission.
- Connected using the app service principal and OAuth.
- Normalized the workspace host to support values with or without https://.
- Verified /api/health/sql returns status: ok and connectionCheck: 1.
- Table access remains to be verified after creating Sentinel datasets.