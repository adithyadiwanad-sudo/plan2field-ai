# Security, reliability and limitations

## Implemented controls

- Parameterized SQL; project membership checks before every project route; scoped resource lookups and composite project/version foreign keys.
- Scrypt password hashes; hashed opaque session tokens; HttpOnly/SameSite=Strict cookies; explicit Origin and CSRF-token checks on mutations. `COOKIE_SECURE=true` is required behind HTTPS. Login throttling and general request limiting are enabled.
- Table-owner credentials are used only for explicit schema/bootstrap/seed/test operations. Runtime API/worker roles are separate, and cannot update/delete baselines, audit or progress ledger rows. Immutable triggers also reject those operations.
- Consistent approval lock order, version checks, unique proposal commits, report request-key hashes and unique component completion projections. Reconciliation/correction events retain previous accepted evidence.
- Upload limits, generated UUID storage names, non-shell FFmpeg calls, ffprobe duration/audio-stream checks, XML entity protection, archive expansion limits and OCR timeout.
- Models use pinned public revisions, local-files-only loading and no trusted remote code. Report content never becomes commands, SQL, paths, HTTP destinations or agent instructions.
- Offline drafts are filtered by account; sync rechecks the server session identity before upload. API responses are not service-worker cached.
- Export outbox rows remain UNCONFIRMED; no scheduling connector is configured.

## Important practical limits

1. **Not production-certified.** No penetration test, RLS policy, security audit, disaster-recovery drill, tenant-scale benchmark or infrastructure hardening has run. Project isolation is enforced by API checks plus structural DB constraints; a compromised runtime DB credential has broader SELECT access than an individual application user.
2. **Runtime verification blocked.** Docker/PostgreSQL/WSL are absent here. SQL constraints, transaction integration and clean Compose startup are supplied but unverified until run against real PostgreSQL. Do not treat TypeScript/unit checks as database proof.
3. **Voice/OCR unverified locally.** FFmpeg/Tesseract and Whisper weights are absent on this host. Docker installs the binaries and the explicit download step fetches Whisper. Silence checks do not establish transcription accuracy. Handwriting/PDF and general document layouts are unsupported.
4. **Bounded extraction.** Deterministic English rules cover the demo vocabulary. A general local LLM provider is explicitly disabled; its file supplies validation boundaries only. Missing/uncertain evidence stays reviewable. No word-matching substitute powers the semantic pipeline.
5. **Physical measurement.** Weighted components use whole-component acceptance. Partial acceptance within an individual weighted component/stage, multi-stage quantities and managed reopening of finished activities are not exposed. Aggregate/component evidence mixing requires an explicit correction; incremental overlaps cannot be perfectly deduplicated without component identities.
6. **Offline scope.** A warmed production application shell and same tab session can capture after losing connectivity. Starting a new unauthenticated browser session offline is unsupported. Browser storage can be cleared/evicted and is not encrypted by this app. A person sharing the same OS/browser profile may access developer tools; application account filtering is not OS-level data isolation. No universal background-sync claim.
7. **Operational controls.** Local single-worker inference and bounded uploads are intended for the prototype. Native model inference has no hard per-call CPU deadline; FFmpeg/OCR do. Configure container CPU/memory quotas and broader monitoring for deployment. Worker retry and lease recovery need crash/load testing. Upload files can be orphaned when a DB transaction fails; retention/garbage collection is not automated.
8. **UI scale and authorization.** List APIs are paginated; the overview currently fetches up to 200 activities and report/review pages up to 100. Large-schedule UI paging needs expansion. Server role checks are authoritative even if a control is visible to an engineer.
9. **Historical data.** Closeout requires accepted dates and baseline evidence. Synthetic records remain synthetic and are excluded by default. Verified status reflects explicit authorized closeout, not an independent certification. Comparables do not establish crew productivity or predictive accuracy.
10. **No external synchronization.** Exports are review artifacts, not tested P6 import packages. Baseline reapproval, schedule calendar calculations, CPM and forecasts are outside the progress API.

Use the local loopback binding for this prototype. Production deployment, paid services and external data transmission were not performed.
