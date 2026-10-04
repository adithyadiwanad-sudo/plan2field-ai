<div align="center">

# Plan2Field AI

### The field speaks. The schedule gets evidence.

**An intelligent field execution data layer for Oracle Primavera P6.**<br />
Turn site reports into traceable, planner-approved actual progress while protecting the baseline.

<p>
  <img src="https://img.shields.io/badge/SIH-2026-ff9933?style=flat-square" alt="Smart India Hackathon 2026" />
  <img src="https://img.shields.io/badge/Problem-SIH26122-153e35?style=flat-square" alt="Problem statement SIH26122" />
  <img src="https://img.shields.io/badge/React-19-149eca?style=flat-square&amp;logo=react&amp;logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Express-5-353535?style=flat-square&amp;logo=express" alt="Express 5" />
  <img src="https://img.shields.io/badge/Python-AI_worker-3776ab?style=flat-square&amp;logo=python&amp;logoColor=white" alt="Python AI worker" />
  <img src="https://img.shields.io/badge/pgvector-semantic_search-336791?style=flat-square&amp;logo=postgresql&amp;logoColor=white" alt="pgvector semantic search" />
  <a href="#verification"><img src="https://img.shields.io/badge/Build-locally_verified-238636?style=flat-square" alt="Build locally verified; not a CI status badge" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/License-not_specified-lightgrey?style=flat-square" alt="License not specified" /></a>
</p>

**[Live Prototype](https://plan2field-ai.vercel.app) · [Source Code](https://github.com/adithyadiwanad-sudo/plan2field-ai) · [Demo Walkthrough](docs/demo-script.md) · [Architecture](docs/architecture.md) · [API Contract](backend/openapi.yaml)**

**Team Avyakthra · 171927 · DBIT, Bengaluru**<br />
Smart India Hackathon 2026 — Grand Finale Shortlisting Phase

</div>

---

## In 45 seconds

**The problem:** Field teams describe work in site language; planners need dated, measured updates against exact WBS activities. Translating between the two takes manual reconciliation and risks linking the right observation to the wrong task.

**Our answer:** Capture the original report, retrieve semantically similar schedule activities, check engineering identifiers, and present an evidence-backed proposal. A planner approves before actuals or the export outbox change. Primavera remains the scheduling system of record.

| Capture | Understand | Verify | Hand off |
| :--- | :--- | :--- | :--- |
| Text, spreadsheets, audio adapters, GPS and photos | Semantic retrieval + reranking + discipline/identifier checks | Original evidence, candidate scores, variance and successor warnings | Approved actuals, immutable audit events and CSV/JSON proposals |

> **Judge's shortcut:** Open [Demo Login](https://plan2field-ai.vercel.app/login), choose **Field Engineer** to submit evidence, then **Project Planner** to inspect and approve it. Use **Switch demo role** in the sidebar. These controls are implemented in this repository; the hosted deployment may lag the source. [Demo account setup](docs/demo-login.md).

<p align="center">
  <img src="docs/screenshots/cloud-dashboard.png" width="100%" alt="Plan2Field project dashboard showing the synthetic Oil India demo schedule and actual progress" />
  <br /><sub>Recorded local browser session backed by Neon and synthetic fixtures. This is a saved verification screenshot, not a live deployment status indicator.</sub>
</p>

<details>
<summary><strong>Submission identity & presentation assets</strong></summary>

| Field | Submission |
| :--- | :--- |
| Problem statement | **SIH26122** |
| Title | Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Project Management: Real-Time Actual Progress Tracking |
| Nodal organization | Oil India Limited |
| Theme / category | Smart Automation / Software |
| Team | Avyakthra · Team ID **171927** |
| Institution | Don Bosco Institute of Technology (DBIT), Bengaluru |
| Lead developer | Adithya Diwanad |
| Presentation | [Four-minute demo script](docs/demo-script.md); slide deck and pitch video links have not yet been published here |

Event and team details are supplied by the team. All included schedules, field reports and historical records are **synthetic demonstration data**, not Oil India operational records.

</details>

## Why this layer exists

| Site-to-schedule problem | Plan2Field AI response | What the planner can inspect |
| :--- | :--- | :--- |
| “Spools erected” does not identify a unique schedule row | Semantic retrieval followed by line, asset, discipline and operation checks | Ranked candidates and conflict reasons |
| Civil, piping and electrical teams report differently | Six-discipline normalization into START, FINISH, PROGRESS and QUANTITY evidence | Extracted fields alongside original text |
| Repeated reports inflate completion | Stable request keys, component deduplication and explicit corrections | Accepted event history and before/after actuals |
| A late task hides its downstream exposure | Date variance plus immediate imported dependency lookup | Direct successor IDs and relationship type |
| Updates are difficult to defend later | Reporter identity, timestamps, photo/GPS metadata and planner actions | Linked evidence and immutable audit records |

**Value proposition:** Reduce rekeying and reconciliation while preserving planner accountability. **80–95% faster update cycles is a target for a future timed pilot, not a measured result.** The concrete safety property today is database-enforced baseline immutability on the protected application paths, backed by integration tests.

## Architecture: evidence to approved actuals

```text
1. CAPTURE                  2. NORMALIZE & MATCH
Text / CSV / XLSX ---------> Event primitives + discipline tags
Audio -> Whisper STT ----->     |
GPS + site photos -------->     +-- MiniLM embeddings (384 dimensions)
                                +-- pgvector cosine retrieval
                                +-- CrossEncoder reranking
                                +-- Identifier / operation / evidence checks
                                             |
3. VERIFY                                    v
                         +-------------------+-------------------+
                         |                                       |
                    AUTO_STAGED                       REVIEW_NEEDED
                    proposal ready                    low confidence / unmatched
                         |                                       |
                         +---------- Planner approval -----------+
                                             |
4. RECORD & EXPORT                           v
                  Transaction: actuals + event ledger + audit + outbox
                                             |
                                 Approved CSV / JSON export
                                             |
                       P6 / SAP / MS Project integration boundary
                       (external mapping / connector still required)

                 Imported baselines: READ-ONLY throughout
```

React talks to Express over authenticated REST. PostgreSQL stores schedule versions, evidence, job leases and proposals; the Python worker performs extraction and local model inference. [Architecture details](docs/architecture.md) · [Data dictionary](docs/data-dictionary.md).

### The two-tier gate: automatic staging, human acceptance

**Tier 1 — machine assessment.** Compatible candidates can become `AUTO_STAGED`. Missing identifiers, ambiguous candidates or weak scores require review. `UNMATCHED` and `LOW_CONFIDENCE` classifications expose **Planner Review Required** with original evidence and candidate explanations. Future intentions and negated work are not accepted as actual progress.

**Tier 2 — planner approval.** Both routes require an authorized planner before committing actuals and writing `export_outbox`. Approval checks proposal/activity versions and records the approving user. Outbox delivery stays `UNCONFIRMED`; downloading a file never pretends that P6 accepted it.

The implemented policy is [`conservative-v1`](ml_worker/config.py): raw CrossEncoder score **≥ 2.0**, top-two margin **≥ 1.0**, and no outstanding validation reasons. These scores are **not calibrated probabilities**. An “≥80% auto-stage / <80% review” policy is a future calibration target, not the current threshold. A cosine similarity percentage in the UI is not an 80% likelihood of correctness.

### Engineering safeguards

- **Protected baseline:** separate immutable baseline records, database triggers and restricted API/worker roles.
- **Atomic acceptance:** actuals, accepted event, audit and outbox commit together; failures roll back together.
- **Concurrent review protection:** stale versions fail visibly instead of silently overwriting another planner.
- **Accurate lineage:** authenticated user IDs drive `submitted_by` and approval records; roles come from project memberships.
- **Repeat-safe updates:** stable idempotency keys and component identities prevent duplicate submission or repeated component counting.
- **Evidence visibility:** GPS accuracy influences geofence status; missing site configuration stays `UNKNOWN`. Browser GPS is evidence, not tamper-proof attestation.

See [security and limitations](docs/security-and-limitations.md) and [field evidence design](docs/field-evidence.md).

## Features worth opening in the demo

| Feature | What works in this repository |
| :--- | :--- |
| **Multi-discipline capture** | Civil, Piping, Electrical, Mechanical, Instrumentation and HSSE tags; text/transcript and mapped spreadsheet normalization |
| **Noisy terminology matching** | Sentence-Transformers retrieval and CrossEncoder ranking, constrained by engineering identifiers and operation compatibility |
| **Micro-to-macro progress** | Multiple component events aggregate into an activity: S01 + S02 + S03 out of ten equal spools = **30%**; repeating S03 adds nothing. Unequal weights are supported. Arbitrary WBS roll-ups are not synthesized. |
| **Unplanned activity detection** | Unmatched evidence remains available for planner resolution; emergency descriptions never create baseline activities automatically |
| **Planner control center** | Candidate selection, revision/diff, protected baseline comparison, evidence previews and approval |
| **Delay visibility** | Six delay reasons, signed calendar-day variance and direct successor warnings from imported dependencies; no full CPM recalculation |
| **Institutional Memory** | Discipline-filtered historical comparables, recorded durations, delay causes and accepted progress patterns; synthetic history is excluded from operational comparables by default |
| **Export outbox** | Approved snapshots in CSV, JSON and **XER-style JSON** with provenance and stable event keys; XER-style JSON is not a native tab-delimited `.xer` file |
| **Offline capture** | IndexedDB pending reports, user isolation and explicit synchronization with stable request keys |

### RAG copilot: next stage

The current Historical Knowledge module retrieves structured comparables. **No LLaMA model or generative RAG assistant is configured.** The intended extension is a citation-backed copilot over authorized baseline activities, WBS codes and inspection evidence, with planner review retained. It is a roadmap item, separate from the working retrieval/reranking pipeline.

## Workflow comparison

*This compares workflows, not audited vendor feature sets. ERP and scheduling capabilities depend on product, configuration and integrations.*

| Requirement | Manual reports & spreadsheets | ERP / scheduler workflow | Plan2Field AI prototype |
| :--- | :--- | :--- | :--- |
| Connect free-text site language to a schedule task | Planner searches and rekeys | Usually requires structured identifiers or an integration | Semantic candidates plus engineering checks |
| Preserve source evidence with an update | Attachments and cross-references maintained manually | Configuration-dependent | Original report, identity, GPS/photos and proposal linkage |
| Resolve uncertainty visibly | Email/phone clarification | Workflow-dependent | Explicit low-confidence/unmatched queue |
| Aggregate repeated component observations | Manual reconciliation | Depends on measurement model | Component identities, weights and correction ledger |
| Protect approved baseline during actuals capture | Depends on file/process discipline | Native controls may exist | Immutable baseline tables and restricted runtime roles |
| Produce a reviewable handoff | Manual export preparation | Native or configured integration | Approved delta outbox; downstream connector required |

## Stack & repository map

| Layer | Technology | Responsibility |
| :--- | :--- | :--- |
| **Frontend** | React 19 · Vite · Tailwind CSS v4 · Lucide · TanStack Query | Capture, planner review, dashboard/Gantt and session-aware workspace |
| **Backend** | Node.js · Express 5 · TypeScript · Python worker | Authenticated APIs, asynchronous jobs, validation and transactions |
| **AI / retrieval** | Sentence-Transformers MiniLM · CrossEncoder · pgvector | **384-dimensional** vectors, exact cosine retrieval for the demo and reranking |
| **Audio / document adapters** | OpenAI Whisper `base` · FFmpeg · Tesseract | Local transcription and bounded printed-image OCR; no site-noise fine-tuning claimed |
| **Infrastructure** | Neon PostgreSQL · Vercel frontend · Render API · Docker Compose | Cloud database, deployment targets and local service topology |
| **Security / validation** | Zod · scrypt · HttpOnly cookies · CSRF · project RBAC | Payload checks, password verification and scoped authorization |
| **Interchange** | Bounded CSV / XER / XML imports; approved CSV / JSON exports | P6-oriented handoff and limited MS Project XML adapter; vendor mapping remains explicit |

The source uses **384**, not 1536, embedding dimensions. Models and revisions are pinned in [`ml_worker/config.py`](ml_worker/config.py); changing embedding models requires re-embedding the schedule. Extraction is currently the deterministic English vocabulary provider, not a general-purpose LLM.

```text
frontend/       React application, API client, offline capture and UI tests
backend/        Express APIs, approval/export services and database integration tests
ml_worker/      Extraction, local models, adapters, matching and evaluation
database/      Schema, additive migrations, runtime grants and synthetic fixtures
shared/         Shared contracts
scripts/        Bootstrap, cloud migration, model/service launch and verification
docs/          Architecture, evidence design, demo script and verification records
```

## Quickstart

### Option A · Full local stack with Docker

Requires Git, Docker with its Linux engine and Compose v2. First setup downloads images and model weights; no paid inference API key is required. The Compose path is supplied but has **not been verified as a clean startup on the development host**.

```powershell
git clone https://github.com/adithyadiwanad-sudo/plan2field-ai.git
cd plan2field-ai
# Fresh clone only: preserve an existing .env.
Copy-Item .env.example .env
# Edit .env: set private database passwords before bootstrap.
.\scripts\bootstrap.ps1 -DownloadModels
```

Open **http://localhost:8080/login**. Choose a demo role or sign in with the configured account. The seed requires `LOCAL_DEMO=true`; existing account passwords are preserved. Stop with `docker compose down` to retain data. [Windows setup](docs/setup-windows.md) · [Parser boundaries](docs/parser-support.md).

### Option B · Source development with Neon

<details>
<summary><strong>Node + Python setup and three development processes</strong></summary>

Commands below use PowerShell. The recorded host used Node 24 and Python 3.13; the Docker worker uses its separate Linux/Python 3.12 lock.

```powershell
npm ci
npm --prefix backend ci
npm --prefix frontend ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install uv==0.9.5
.\.venv\Scripts\uv.exe pip install --python .venv/Scripts/python.exe -r ml_worker/requirements.in --torch-backend cpu
```

Start from `.env.example` only if `.env` does not exist. Add/configure these **root** values using your own database credentials:

```dotenv
DATABASE_URL=postgresql://<owner>:<password>@<host>/<database>?sslmode=require
LOCAL_DEMO=true
MODEL_CACHE=./models
UPLOAD_DIR=./uploads
APP_ORIGIN=http://localhost:8080
FRONTEND_PORT=8080
```

For a **new dedicated demo database**, initialize schema/roles, download semantic models and seed:

```powershell
.\.venv\Scripts\python.exe scripts/cloud_database.py initialize
.\.venv\Scripts\python.exe ml_worker/scripts/download_models.py --semantic-only
.\.venv\Scripts\python.exe ml_worker/scripts/seed_data.py
```

Initialization saves restricted `API_DATABASE_URL` and `WORKER_DATABASE_URL` privately into `.env` and rotates those role passwords. For an already provisioned database, use `scripts/migrate_cloud.py` for additive migrations rather than rerunning initialization. Never commit `.env` or expose database credentials through `VITE_*` variables.

Run each service in a separate terminal:

```powershell
.\.venv\Scripts\python.exe scripts/run_local.py api
.\.venv\Scripts\python.exe scripts/run_local.py worker
.\.venv\Scripts\python.exe scripts/run_local.py frontend
```

The launchers provide restricted credentials and the local Vite `/api` proxy. API: **3001**. Frontend: **8080** with the settings above. For direct Vite development, `npm --prefix frontend run dev` requires `VITE_API_BASE_URL=/api` and a matching API origin; there is no root `npm run dev` command.

`--semantic-only` does not install Whisper weights. Audio also needs FFmpeg/ffprobe; OCR needs Tesseract. [Model setup](docs/setup-windows.md#models).

</details>

### Deployment boundary

| Service | Required configuration |
| :--- | :--- |
| Vercel frontend | `frontend` project root; `VITE_API_BASE_URL=https://plan2field-backend.onrender.com/api`; rebuild after environment changes |
| Render API | Restricted API database URL, allowed frontend origin(s), secure session cookies and persistent evidence storage |
| Python worker | Restricted worker database URL, pinned models and access to the same evidence storage |
| Neon | pgvector, numbered migrations and restricted runtime grants |

The API client includes session cookies and routes login through `/api/auth/login`. Cross-site cookie restrictions may require a same-site proxy/domain. See [Render/Vercel configuration](docs/render-vercel-auth.md). Check `/api/health/live` for API liveness and `/api/health/ready` for database, worker and semantic model readiness; voice/OCR are checked when used.

## Judge testing scenarios

Use the synthetic project **OIL-DEMO-01**. Record the displayed candidate, score, routing reason and resulting ledger entry rather than relying on a scripted confidence percentage.

| Field input | Candidate / expected result | Score evidence | Routing and acceptance check |
| :--- | :--- | :--- | :--- |
| “Line twenty-four spool erection started on 12 September 2026 in the north area.” | `ACT-24-SPOOL-01`; baseline start 10 Sep, proposed actual start 12 Sep | Inspect cosine and raw reranker scores; auto-stage eligibility uses ≥2.0 and margin ≥1.0 | Clean fixture has passed auto-link checks. Approve to persist **+2 calendar days** variance; baseline remains unchanged. |
| “Spool erection started in the north area on 12 September 2026.” | Competing line-specific erection activities; line identifier missing | No invented percentage; missing fields can force review regardless of score | Planner review required. Add the identifier, select, save and revalidate before approval. |
| “On line 24, spools S01, S02 and S03 are erected. Three out of ten are complete in total as of 15 September 2026.” | `ACT-24-SPOOL-01`; three distinct components | Inspect runtime scores; routing also depends on extracted measurement fields | After approval, **30% complete**, finish still null. Submit the same components again: accepted quantity must not increase. |

Exact per-report score values were not retained in the published evaluation artifact, so none are fabricated here. Fixture state changes after approvals; use a fresh synthetic schedule version for repeatable judging. [Full walkthrough](docs/demo-script.md).

<details>
<summary><strong>Additional adversarial checks</strong></summary>

- Submit an unknown line or incompatible discipline: inspect `UNMATCHED`, retained raw evidence and planner CTA.
- Submit “We will erect line 24 tomorrow”: future intent must not become an actual start.
- Switch to Field Engineer and attempt a planner-only action: the backend must reject it.
- Attach a photo and delay reason: inspect evidence and direct successors, then approve and inspect the export snapshot.
- Refresh or retry a submission: stable request keys must prevent duplicate accepted work.

</details>

## Verification

**Recorded development checks, not a live CI claim:**

| Evidence | Recorded result | Scope |
| :--- | :--- | :--- |
| Frontend/backend build | Passed | Vite production bundle and TypeScript compile |
| JavaScript unit tests | **26 passed** | 17 backend + 9 frontend |
| Python non-model suite | **28 passed** | Extraction, normalization, parsers and routing |
| Neon integration | Passed | Schema/grants, baseline protection, concurrency, rollback, evidence/outbox and role-specific auth/lineage |
| Local browser + Neon | Passed at recorded checkpoints | Seeded schedule, model proposals, dashboard and readiness |
| Isolated browser tests | Passed | Mocked API desktop/mobile layouts, GPS/photos and demo-role switching |

The [six-report model evaluation](docs/local-model-evaluation.json) used real models with **in-memory fixture retrieval**: hybrid top-1 accuracy was 1.0 on matchable examples, but keyword top-1 was also 1.0. Only one of six reports auto-staged. This small synthetic set does not establish operational accuracy or superiority over keyword search; later routing changes also make it a historical snapshot. [Evaluation interpretation](docs/model-evaluation.md).

```powershell
npm run build
npm test
.\.venv\Scripts\python.exe -m pytest ml_worker/tests -m "not models" -p no:cacheprovider
# Uses configured owner access; creates and removes only a random p2f_test_* database.
Push-Location backend
node --env-file=../.env scripts/test-database.mjs
Pop-Location
```

**Still to validate:** noisy-site Whisper performance, local OCR execution, clean Docker startup, calibrated probabilities and production-scale latency. Native P6/MS Project sync, CPM recalculation, 1536-dimensional embeddings and the LLaMA copilot are not implemented. [Verification history](docs/implementation-status.md) · [Evidence checks](docs/field-evidence.md) · [Demo-login checks](docs/demo-login.md).

## Research foundations

1. **Nanduri, S. K., & Delhi, V. S. K. (2026).** *Automated Schedule Enrichment from Daily Progress Reports: A Bi-Directional Neuro-Symbolic AI Approach.* EC³. DOI: [10.35490/EC3.2026.312](https://doi.org/10.35490/EC3.2026.312). The [official publication record](https://ec-3.org/publication/ec32026_312/) identifies both authors with IIT Bombay and describes combining neural language processing with symbolic constraints for schedule enrichment. This is relevant research context for our hybrid approach; Plan2Field does not reproduce that paper's system or inherit its experimental results.
2. **Reimers, N., & Gurevych, I. (2019).** [*Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks*](https://arxiv.org/abs/1908.10084). Foundation for semantically meaningful sentence embeddings compared by cosine similarity.
3. **Radford, A., et al. (2022).** [*Robust Speech Recognition via Large-Scale Weak Supervision*](https://arxiv.org/abs/2212.04356). Research behind Whisper; it does not establish accuracy on this project's site recordings.
4. **pgvector maintainers.** [*pgvector documentation*](https://github.com/pgvector/pgvector). PostgreSQL vector storage and similarity-search implementation reference.

## Team Avyakthra

**Team ID 171927 · Don Bosco Institute of Technology, Bengaluru**<br />
Lead developer: **Adithya Diwanad**

[Developer profile](https://github.com/adithyadiwanad-sudo) · [Repository](https://github.com/adithyadiwanad-sudo/plan2field-ai) · [Questions & issues](https://github.com/adithyadiwanad-sudo/plan2field-ai/issues)

### License

No project license file is currently included. A reuse license has not been declared; dependency and model licenses remain their own. The license badge reflects this status rather than implying an MIT/Apache grant.

---

<div align="center">
<strong>Every actual has evidence. Every approval has an owner. The baseline stays protected.</strong><br />
<sub>Plan2Field AI · Team Avyakthra · SIH26122</sub>
</div>
