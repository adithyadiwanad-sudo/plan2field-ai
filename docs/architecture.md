# Architecture and decisions

Plan2Field AI is a local, production-oriented prototype for reviewable infrastructure actuals. It is not production-certified. All supplied demonstration data is synthetic.

## Authoritative state

PostgreSQL 17 with pgvector owns projects, schedule versions, reports, proposals, actuals, jobs, audit, exports and historical records. API and worker logins do not own tables. Immutable-table triggers complement grants. Baselines are inserted only during an explicitly confirmed import; progress APIs do not edit them. Exact search is appropriate for the 30-activity fixture.

The API uses Express 5, TypeScript, Zod, parameterized pg queries and Decimal.js calculations. React/JSX, Vite, Tailwind, Lucide, React Router and TanStack Query power the frontend. Nginx supplies the same-origin API proxy.

One-shot `bootstrap` and `seed` Compose services receive owner credentials for explicit setup only. Regular backend/worker services receive only their respective runtime PG credentials; they do not inherit the owner password from `.env`.

## Semantic inference

- Bi-encoder: `sentence-transformers/all-MiniLM-L6-v2`, revision `c9745ed1d9f207416be6d2e6f8de32d1f16199bf`, dimension **384**.
- Cross-encoder: `cross-encoder/ms-marco-MiniLM-L6-v2`, revision `c5ee24cb16019beea0893ab7796b1df96625c6b8`.
- Retrieval uses pgvector cosine distance; displayed similarity is `1 - distance`. Reranking uses raw logits with an identity activation.
- Model IDs, revisions, dimension, and SHA-256 activity-text hashes accompany embeddings. A local manifest must match the configured vector space. Model changes require re-embedding.
- `deterministic-v1` extracts the documented English demo vocabulary. It is separate from semantic inference. A keyword comparator is used only in the evaluation command.
- Provisional routing policy: raw reranker score >= 2 and runner-up margin >= 1, with all mandatory fields and hard gates satisfied. These are not calibrated probabilities. Every auto-staged proposal still requires reviewer approval.
- Missing local models cause explicit processing failure, never fabricated scores or a keyword fallback.

Official references checked during implementation: [Sentence Transformers retrieval/reranking](https://www.sbert.net/docs/sentence_transformer/usage/usage.html), [CrossEncoder API](https://www.sbert.net/docs/package_reference/cross_encoder/model.html), [pgvector](https://github.com/pgvector/pgvector), [bi-encoder pinned revision](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/commit/c9745ed1d9f207416be6d2e6f8de32d1f16199bf), [cross-encoder pinned revision](https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2/commit/c5ee24cb16019beea0893ab7796b1df96625c6b8).

## Transaction model

Approvals lock project, proposal and activity in that order. The project lock also serializes schedule activation. Optimistic proposal and activity versions reject stale changes with 409. A single transaction writes the immutable accepted event, component projection, actuals projection, audit record and export outbox. Repeated approvals return the original accepted event. Models run outside approval locks.

Component identities prevent duplicate counting. Weighted measurement uses approved component weights. A correction references an accepted event, states a reconciliation reason, appends a new ledger event and replaces the component projection. Aggregate quantity reports require explicit overlap reconciliation where applicable. Dates remain null unless supported by an approved dated START/FINISH observation. Full quantity alone never establishes actual finish.

## Jobs and storage

Workers claim jobs with `FOR UPDATE SKIP LOCKED`, 60-second leases, 20-second lease renewal, three attempts and delayed retry. Expired leases recover work. Report events and proposals have unique delivery keys; validated imports are idempotent. Upload HTTP requests return 202. Mounted storage uses server-generated UUID names; source filenames remain metadata only.

## Offline behavior

IndexedDB stores user-scoped pending payloads, including audio blobs and a stable UUID idempotency key. A service worker caches only the application shell/static resources, never API responses. A last-user/sessionStorage project cache supports an offline reload within an existing tab session. Before sync the API session must match the draft owner. Pending content is removed only after acknowledgement. Offline inference is not implemented. Browser background sync is not promised.

## Deliberate scope limits

No external scheduling connector is configured. JSON/CSV downloads are **Update proposal exports**, with unconfirmed external status. No CPM, working-day calculations, automatic forecasting, handwriting reliability claim, external LLM or paid service is included. General-purpose extraction and full vendor schedule dialects require further work and evaluation; see parser-support.md and security-and-limitations.md.
