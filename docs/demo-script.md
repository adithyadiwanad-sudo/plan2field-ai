# Four-minute demonstration

**Preflight:** start the actual Compose stack, check readiness, seed/reset the known synthetic project, sign in and open the overview. Confirm model availability and allow queued reports to finish before presenting. All dates and records are synthetic; no Oil India internal data or live scheduling connector is implied.

## 0:00–0:25 — Schedule and baseline

Show OIL-DEMO-01 and reporting date 15 September 2026. Open ACT-24-SPOOL-01: approved baseline 10–20 September, ten equal spools, zero initial actuals. Explain the separate protected baseline and reviewer-controlled actuals.

## 0:25–1:20 — Clean start and +2 days

Submit: “Line twenty-four spool erection started on 12 September 2026 in the north area.” Open review. Show original evidence, normalized line 24, actual candidate scores and the erection operation. Explain that the score is uncalibrated. If policy routes to review, show that honestly. Approve. The dashboard should show start 12 September and **+2 calendar days**, with baseline unchanged.

## 1:20–2:10 — Ambiguous report

Submit: “Spool erection started in the north area on 12 September 2026.” Show multiple plausible candidates and missing line. Enter the confirmed full line ID, select the matching candidate, save/revalidate, then approve. Until that approval, actuals remain unchanged.

## 2:10–3:10 — Partial progress and duplicate replay

Submit: “On line 24, spools S01, S02 and S03 are erected. Three out of ten are complete in total as of 15 September 2026.” Review the component set and proposed quantity, then approve. Show **3/10 = 30%** and no actual finish. Resubmit the same component observation, revalidate if the activity version changed, and approve; quantity stays three. Distinguish semantic component deduplication from exact request-key retry handling.

## 3:10–3:40 — Historical comparables

Open Historical knowledge. Initially show “Insufficient verified history.” Enable the clearly labelled synthetic demo toggle. Filter ERECTION/spool; show quantity, duration basis, context, date evidence and deviation reason. These records do not establish predictive accuracy or crew productivity.

## 3:40–4:00 — Audit and persistence

Open the accepted activity ledger or project audit. Show before/after values, reviewer and source event. Reload the overview to show persistence **only when the real stack has been verified**. Finish by showing the unconnected external scheduling status and the update-proposal export.

If a dependency fails, show the visible failure and explain it; do not substitute mocked screenshots or invented confidence/latency as the live result. The local layout screenshots are test artifacts, not demo evidence of database writes.
