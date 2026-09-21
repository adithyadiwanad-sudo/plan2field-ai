# API examples

The full contract is `backend/openapi.yaml` (OpenAPI 3.1, JSON-formatted valid YAML). All endpoints are under `/api`. Local same-origin UI is preferred; no cross-origin CORS service is configured.

## Authentication

`POST /auth/login` with an allowed `Origin` and JSON:

```json
{"email":"reviewer@plan2field.local","password":"your configured local password"}
```

The response sets a session cookie and returns `csrf_token`. Subsequent mutations require that cookie, the allowed Origin, and `X-CSRF-Token`. GET `/auth/me` refreshes the known token. POST `/auth/logout` ends the session.

## Text report

`POST /projects/{projectId}/reports`, JSON or multipart form. Returns **202**, including the persisted report ID. Repeating the exact body/key returns the original report; changing payload with that key returns 409.

```json
{
  "source_type":"TEXT",
  "original_text":"Line twenty-four spool erection started on 12 September 2026 in the north area.",
  "reporting_date":"2026-09-15",
  "captured_at":"2026-09-15T09:30:00.000Z",
  "idempotency_key":"b4f546be-eef8-4c18-9b8e-b5ae9acb17c4"
}
```

For VOICE/SCAN/SPREADSHEET use multipart `file`. Spreadsheet mapping is a JSON string, e.g. `{"text":"report_text"}`. Poll GET `/reports/{reportId}` for processing status, transcript, extracted events and failure details. Authorized voice playback is GET `/reports/{reportId}/audio`.

## Review

GET `/projects/{projectId}/proposals?status=PENDING&limit=100&offset=0`.

POST `/proposals/{proposalId}/validate` takes `selected_activity_id` and `proposed_changes`; it validates the prospective actuals without writing them. PATCH `/proposals/{proposalId}` also requires `proposal_version`; it preserves the old revision and updates the expected activity version. See `shared/event.schema.json` for event fields.

POST `/proposals/{proposalId}/approve`:

```json
{"proposal_version":1}
```

The server locks and revalidates everything, then atomically writes actuals, ledger, audit and outbox. Already-approved retries return the original accepted event. Stale schedule/activity/proposal versions return 409 `STALE_PROPOSAL`.

POST `/clarify` or `/reject`:

```json
{"proposal_version":1,"reason":"Please confirm the full line identifier from the field record."}
```

## Import/history/export

- POST `/projects/{projectId}/schedule-imports`: multipart file, format CSV/XER/XML, baseline_confirmed=true, optional min_wbs_depth. GET its ID for preview; POST `/{importId}/activate` only accepts a VALIDATED version.
- GET `/projects/{projectId}/variance`, `/audit`, `/exports`; exports accept `format=csv`, otherwise JSON. External status remains unconfirmed.
- GET `/history/comparables?work_type=ERECTION&unit=spool&quantity=12&area=NORTH&demo=true`; quantity restricts scope to ±25%. Synthetic is excluded when demo is false/omitted. Summary groups separate unit, work type, duration/calendar basis and provenance.
- POST `/projects/{projectId}/closeout` with `{"reason":"Approved closeout context and deviation explanation"}` creates historical records only when all active activities have accepted start/finish and baseline dates.

Errors contain `code, message, fieldErrors, requestId`; no public stack trace. List pagination uses limit (1–200) and offset (>=0). Project membership is checked even when a valid-looking resource UUID is supplied.
