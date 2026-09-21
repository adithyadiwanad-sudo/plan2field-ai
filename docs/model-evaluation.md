# Model evaluation

## Actual checks

Real local CPU model smoke test passed using the pinned MiniLM bi-encoder and cross-encoder. It verified a 384-dimensional embedding and that an erection report ranked its piping activity above a concrete distractor. No external inference API was used.

The recorded [evaluation JSON](local-model-evaluation.json) contains **six synthetic held-out reports**, only **two** of which have an unambiguous target activity. The policy was not tuned after this evaluation.

| Measure | Recorded result |
|---|---:|
| Keyword baseline top-1, matchable records | 2/2 |
| Bi-encoder top-1, matchable records | 1/2 |
| Retrieval + gates + reranker top-1, matchable records | 2/2 |
| Retrieval recall at 30 | 2/2 (all 30 fixture activities retrieved) |
| Auto-staged | 1/6 |
| Correct auto-staged | 1/1 |
| Human review | 2/6 |
| Rejected | 3/6 |
| Event-type exact match | 6/6 |

These denominators are far too small for a reliable accuracy claim. Retrieving all fixture activities makes recall at 30 a weak retrieval test. The keyword baseline also matched both positive examples; these data do not establish superiority over that baseline.

The measurement used **IN_MEMORY_FIXTURE_ONLY** cosine retrieval with real installed model weights. It does **not** validate pgvector, database persistence, job execution or browser-to-approval integration. The default evaluation command uses PostgreSQL and remains blocked here by the missing database runtime.

Recorded environment: Windows 11 build 26200; Intel64 Family 6 Model 154 Stepping 3; CPU Torch; two inference threads. Setup was 13.288 s and median per-report time 0.0468 s for this small local run, excluding initial model setup from per-report latency. This is not a deployment performance target or transcription benchmark. Full timing details are in the JSON.

## Score interpretation

Cosine similarity and raw cross-encoder logits are uncalibrated. `score_type=HEURISTIC`, `calibrated_probability=null`. Provisional auto-staging requires score >=2, separation >=1, valid mandatory fields and no hard contradictions. Staging never commits actuals. Missing identifiers, aggregate overlap or correction evidence routes to review. No match rejects instead of inventing an activity.

## Remaining evaluation work

Run the default pgvector evaluation and real-stack browser scenarios after Docker is installed. Broaden held-out engineering reports across tags, units, corrections, negation, multiple events, noise and source formats. Quantify all critical fields, calibration, retrieval truncation, OCR/transcription, latency distributions, and cross-project/version isolation. No operational recommendation or predictive performance is inferred from synthetic history.
