# SIH26122 enterprise evidence update

## Ingestion and normalization

Text, spreadsheet rows and speech transcripts share event extraction. The six disciplines are Civil, Piping, Electrical, Mechanical, Instrumentation and HSSE. Explicit text tags take priority; a submission hint or optional spreadsheet `discipline` column supplies otherwise missing context. Mixed reports keep a tag per extracted event. Unknown disciplines remain visible rather than being guessed from an unrelated activity.

START, FINISH and PROGRESS retain dates and original evidence offsets. PROGRESS may carry a measured quantity, component IDs or `physical_percent`. Percentage normalization uses the approved total quantity only for `QUANTITY` measurement; component-based scope still requires component evidence. Quantity and percentage evidence cannot be mixed in one accepted update. English deterministic vocabulary remains bounded; this is not general multilingual extraction.

## Matching and review

Real Sentence-Transformers embeddings query Neon pgvector; a local CrossEncoder ranks retrieved descriptions. Hard discipline, identifier and operation conflicts prevent selection. Incompatible suggestions remain visible with scores and reasons. No compatible activity produces `UNMATCHED`; below-threshold or ambiguous compatible results produce `LOW_CONFIDENCE`. Both stay in the planner queue. Future intent and negation remain non-actual evidence.

Scores are raw, uncalibrated model scores, not probabilities. High-confidence results are `AUTO_LINKED` / `AUTO_STAGED`; proposed date variance is stored in calendar days. Approval is still required before actuals change. Baselines remain protected by grants and immutable triggers.

## Traceability and memory

Migration `002_enterprise_evidence.sql` adds a generated discipline column per event, explicit match classification, staged variance, and a reporter-role snapshot captured on submission. Database triggers append submission and AI-staging audit snapshots. Existing planner revisions and audit records retain before/after selections and changes. New planner audits also snapshot the actor's role. Older reporter roles remain `UNKNOWN`: current membership is not proof of a historical role.

Approved closeout records preserve discipline, actual and baseline calendar-day duration, stated deviation reason, and accepted progress-event patterns. Institutional Memory filters disciplines and groups recurring delay reasons separately by discipline and provenance. Statistics describe the current filtered page; synthetic history is excluded by default. Missing execution evidence is never invented for demo history.

## Enterprise Export contract

`GET /api/projects/:id/exports?format=json|csv` downloads only approved progress-event snapshots, ordered by commit time. Flat fields include `ProjectId`, `ActivityId`, `WBS`, `Discipline`, `ActualStartDate`, `ActualFinishDate`, `PhysicalPercentComplete`, `ActualQuantity`, `ScheduleVersion`, `SourceEventId`, `IdempotencyKey`, reporter/approval metadata and raw model score.

P6 middleware can map these to project/activity actual fields. SAP PS middleware must resolve the source WBS and activity to target WBS/network activity identifiers. Files are versioned integration proposals, not native XER files or SAP IDocs. No live connector or external acknowledgement is claimed. Correction snapshots supersede earlier progress when applied in commit order; use source event IDs for idempotency. Baseline fields are not exported as writes.

## Migration and runtime

Existing Neon database: `python scripts/migrate_cloud.py` using the workspace virtual environment and owner URL in private `.env`. This additive migration preserves all existing actuals and baselines. Fresh Docker volumes also run it after the initial schema and roles. Existing Docker volumes need the additive SQL applied explicitly.

Local launch: `scripts/run_local.py api`, `worker`, and `frontend` in separate terminals. The frontend port is configurable through `FRONTEND_PORT`; `APP_ORIGIN` must match. This workspace uses port 8080, leaving the separate project on 5173 untouched.

Voice transcript normalization is tested, but actual recording/transcription still requires FFmpeg and Whisper weights. No new voice/OCR accuracy claim is made. Imported WBS paths are displayed as supplied; missing Primavera hierarchy levels and planned physical percentages are not synthesized from elapsed time.
