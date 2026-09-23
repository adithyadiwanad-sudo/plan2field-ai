# Field evidence, direct successors and approved P6 updates

Migration `003_field_evidence.sql` is additive and has been applied to Neon. Fresh Docker initialization and cloud migration scripts include it. Protected baselines, accepted progress and model embeddings are preserved.

## Capture and geofencing

Report submission requests fresh browser geolocation with an eight-second timeout. Denied, unavailable or uncertain GPS does not prevent submission. Coordinates, accuracy, photos and the selected delay reason are saved together in the offline draft and reused during retries. Original voice/spreadsheet/scan input still uses the `file` multipart field; optional photos use up to three repeated `photos` fields. Each evidence photo is PNG/JPEG, limited to 5 MB, and checked by its file signature. The server ignores any client-supplied geofence status.

Configure a real project location using authenticated `PATCH /api/projects/:projectId/geofence` with `{ "latitude": number, "longitude": number, "radius_m": number }`. Reviewer/admin membership and CSRF validation are required; configuration changes are audited. No Oil India site location has been invented or configured. Until supplied, reports show UNKNOWN.

The server uses the great-circle distance and GPS accuracy radius. VERIFIED means the entire accuracy circle lies within the configured fence; OUT_OF_BOUNDS means it lies entirely outside; overlap or missing configuration/accuracy is UNKNOWN. The site configuration used is retained in report metadata. These checks concern browser-reported coordinates, not tamper-proof location attestation.

`evidence_urls` contains attachment descriptors with a private API-relative URL, storage UUID, MIME type, SHA-256, upload timestamp and report capture timestamp. The latter is not an EXIF/photo capture assertion. Image bytes are available only through `GET /api/projects/:projectId/reports/:reportId/evidence/:evidenceId` after session and membership checks. Existing upload storage must be mounted persistently on the deployed API; this change does not provision a Render disk or object storage.

## Planner review and successor impact

Cards display geofence badges, discipline and cosine similarity multiplied by 100. Similarity is explicitly not a calibrated probability. Detail cards show authenticated thumbnails, timestamps, selected delay cause and direct-successor warnings.

Supported delay reasons: MATERIAL_SHORTAGE, MANPOWER_SHORTAGE, EQUIPMENT_FAILURE, WEATHER_ACCESS, DESIGN_REWORK, OTHER.

The proposal trigger copies evidence and calculates `affected_successor_ids` from imported `activity_relationships` (including parsed TASKPRED records), restricted to the proposal's project and schedule version. Delay reasons, positive proposed START/FINISH variance, or positive accepted date variance activate impact lookup. Re-selecting a candidate recalculates the stored immediate successors. Pending legacy proposals receive the additive metadata during migration.

`GET /api/projects/:projectId/activities/:activityId/successors` returns internal UUIDs, external P6 activity IDs, relationship types, lag and source metadata. Review previews use the currently selected activity. These are dependency warnings: no recursive impact propagation, successor date shift or CPM recalculation is asserted.

## Approval and export

Approval retains the existing atomic transaction: validate actuals, append progress and audit records, mark the proposal APPROVED, and create exactly one export outbox record. The outbox now snapshots evidence, delay reason and affected successors. Delivery status remains UNCONFIRMED because no external P6 acknowledgement has occurred. Delay-only BLOCKER evidence still requires clarification into valid actual progress before approval; a delay flag alone does not change actuals.

Review queue buttons download approved-only updates via `/api/projects/:projectId/exports?format=csv` or `format=xer-json`; the existing `format=json` remains supported. XER JSON uses a TASK array with task_code, actual dates and physical percentage plus evidence and idempotency references. It is an integration JSON envelope, not a native tab-delimited .xer file or a live P6 sync. Apply approved snapshots in commit order with idempotency deduplication.

## Verification

- Production frontend/backend builds passed.
- 17 backend and 9 frontend unit tests passed; 28 Python parser/extraction/routing checks passed.
- Live Neon: schema suite passed (1 test); approval/HTTP suite passed (10 tests including its parent). Includes geofence/photo persistence, retry conflicts, direct-only successors, selection changes, private photo access, outbox/XER JSON, baseline protection and rollback.
- Isolated Edge UI smoke passed using explicitly mocked API fixtures and simulated GPS: multipart capture, badge/thumbnail rendering, successor warning, export links and mobile layout. No real device GPS accuracy is claimed.
- Render/Vercel application deployments have not been changed by this implementation. Deploy both services to expose the new routes and UI.
