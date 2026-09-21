# Data dictionary

UUIDs identify entities; system timestamps are TIMESTAMPTZ, schedule/report days are DATE, measured quantities are NUMERIC and variable evidence is JSONB. See executable `database/schema.sql` for constraints.

| Tables | Purpose / invariants |
|---|---|
| projects | Timezone, reporting date, active version and status; active version belongs to the same project |
| users / memberships / sessions | Scrypt hash; project ENGINEER/REVIEWER/ADMIN roles; hashed expiring session token with CSRF token |
| schedule_versions | Source hash/name/format, import status, parser version and validation preview; older versions retained |
| schedule_activities | External identity, WBS/context, approved measurement definition, current actuals projection and row_version |
| activity_baselines | Separately protected approved baseline dates/quantity/provenance; no runtime update or delete |
| activity_relationships | Same-project/version predecessor/successor, type, lag and original source units |
| activity_components | Unique component/stage identities and approved positive weights |
| activity_embeddings | 384-d vector, model ID/revision, content hash; exact cosine search filtered by project/version/model |
| site_reports | Original text/transcript/file reference, capture and receipt times, reporting date, processing errors and stable request-key hash |
| report_events | Validated extraction, source offsets/row/page references and extraction-version uniqueness |
| staged_proposals | Candidates/raw scores, selected activity, proposed event, expected row version, independent routing/lifecycle states |
| proposal_revisions | Append-only pre-edit proposal snapshots keyed by revision |
| progress_events | Immutable accepted event with before/after state, effective date, approval and correction reference; one commit per proposal |
| component_completions | Current distinct component projection; corrections rebuild this projection while retaining the ledger |
| audit_events | Immutable actor/action/request and before/after evidence |
| jobs / worker_health | Deduplicated job, retries, leases and worker/model heartbeat |
| export_outbox | Accepted update payload, idempotency reference, unconfirmed external state |
| historical_activity_records | Closed activity scope/context/date evidence, duration basis and SYNTHETIC/IMPORTED_UNVERIFIED/VERIFIED provenance |

Routing: AUTO_STAGED / REVIEW_NEEDED / REJECTED. Lifecycle: PENDING / CLARIFICATION_REQUESTED / APPROVED / REJECTED / STALE / SUPERSEDED. AUTO_STAGED never means APPROVED.

Positive date variance means late; negative means early. Missing dates produce null, not zero. Baseline and actual durations use elapsed calendar days (`finish - start`), not inclusive counts or working days. Physical percentage is independent of duration.
