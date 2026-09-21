import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import ErrorState from "../components/ErrorState";
export default function HistoryPage() {
  const [demo, setDemo] = useState(false),
    [discipline, setDiscipline] = useState(""),
    [unit, setUnit] = useState(""),
    [work, setWork] = useState("");
  const [quantity, setQuantity] = useState(""),
    [area, setArea] = useState("");
  const q = useQuery({
    queryKey: ["history", demo, unit, work, quantity, area, discipline],
    queryFn: () =>
      api(
        `/history/comparables?demo=${demo}${discipline ? "&discipline=" + discipline : ""}${unit ? "&unit=" + encodeURIComponent(unit) : ""}${work ? "&work_type=" + encodeURIComponent(work) : ""}${quantity ? "&quantity=" + encodeURIComponent(quantity) : ""}${area ? "&area=" + encodeURIComponent(area) : ""}`,
      ),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">HISTORICAL KNOWLEDGE</span>
          <h1>Institutional Memory</h1>
          <p>Comparable records with visible provenance and date evidence.</p>
        </div>
      </div>
      <section className="panel composer">
        <div className="form-grid">
          <label>
            Discipline
            <select
              aria-label="Discipline"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
            >
              <option value="">All disciplines</option>
              {[
                "CIVIL",
                "PIPING",
                "ELECTRICAL",
                "MECHANICAL",
                "INSTRUMENTATION",
                "HSSE",
              ].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Comparable quantity (±25%)
            <input
              type="number"
              min="0.01"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label>
            Area
            <input
              value={area}
              onChange={(e) => setArea(e.target.value.toUpperCase())}
            />
          </label>
          <label>
            Work type
            <select value={work} onChange={(e) => setWork(e.target.value)}>
              <option value="">All work types</option>
              <option>ERECTION</option>
              {[
                "FABRICATION",
                "CIVIL",
                "INSTALLATION",
                "TESTING",
                "CALIBRATION",
                "ALIGNMENT",
                "ENERGIZATION",
                "HSSE",
              ].map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </label>
          <label>
            Unit
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. spool"
            />
          </label>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={demo}
            onChange={(e) => setDemo(e.target.checked)}
          />
          Include synthetic demo comparables
        </label>
        <p className="notice">
          Synthetic records are illustrative and excluded by default. No
          predictive accuracy or crew productivity is inferred.
        </p>
        {q.error ? (
          <ErrorState error={q.error} />
        ) : q.isPending ? (
          <p>Loading history…</p>
        ) : (
          <>
            <h2>{q.data.message}</h2>
            <p>{q.data.count} comparable records in this page</p>
            {q.data.summaries?.map((s) => (
              <p className="notice" key={s.basis}>
                {s.basis}: {s.count} records · Range {s.min}–{s.max} days ·{" "}
                {s.median === null
                  ? "Insufficient records for median"
                  : `Median ${s.median} days`}
              </p>
            ))}
            <h3>Recurring delay causes</h3>
            <p className="muted">{q.data.summary_scope}</p>
            {!q.data.delay_causes?.length && (
              <p>No recorded delay causes in this selection.</p>
            )}
            {q.data.delay_causes?.map((c) => (
              <p key={c.cause}>
                {c.cause} · {c.count} record{c.count === 1 ? "" : "s"}
              </p>
            ))}
            {q.data.records.map((r) => (
              <article className="history-record" key={r.id}>
                <span className="pill">{r.provenance}</span>
                <h3>
                  {r.project_name} · {r.discipline} · {r.work_type}
                </h3>
                <p>
                  {r.quantity} {r.unit} · Baseline {r.baseline_duration} /
                  actual {r.actual_duration}{" "}
                  {r.duration_basis.toLowerCase().replaceAll("_", " ")}
                </p>
                <p>{r.deviation_reason}</p>
                {r.context?.progress_pattern?.length > 0 && (
                  <details>
                    <summary>Verified progress pattern</summary>
                    {r.context.progress_pattern.map((e) => (
                      <p key={e.source_event_id}>
                        {e.effective_date} · {e.event_type} ·{" "}
                        {e.physical_percent}% physical complete
                      </p>
                    ))}
                  </details>
                )}
                <small>Context: {JSON.stringify(r.context)}</small>
                <details>
                  <summary>Date evidence</summary>
                  <pre>{JSON.stringify(r.date_evidence, null, 2)}</pre>
                </details>
              </article>
            ))}
          </>
        )}
      </section>
    </>
  );
}
