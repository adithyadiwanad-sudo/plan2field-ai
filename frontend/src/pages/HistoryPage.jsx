import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import ErrorState from "../components/ErrorState";
export default function HistoryPage() {
  const [demo, setDemo] = useState(false),
    [unit, setUnit] = useState(""),
    [work, setWork] = useState("");
  const [quantity, setQuantity] = useState(""),
    [area, setArea] = useState("");
  const q = useQuery({
    queryKey: ["history", demo, unit, work, quantity, area],
    queryFn: () =>
      api(
        `/history/comparables?demo=${demo}${unit ? "&unit=" + encodeURIComponent(unit) : ""}${work ? "&work_type=" + encodeURIComponent(work) : ""}${quantity ? "&quantity=" + encodeURIComponent(quantity) : ""}${area ? "&area=" + encodeURIComponent(area) : ""}`,
      ),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">HISTORICAL KNOWLEDGE</span>
          <h1>Learn from completed work.</h1>
          <p>Comparable records with visible provenance and date evidence.</p>
        </div>
      </div>
      <section className="panel composer">
        <div className="form-grid">
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
              <option>FABRICATION</option>
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
            {q.data.records.map((r) => (
              <article className="history-record" key={r.id}>
                <span className="pill">{r.provenance}</span>
                <h3>
                  {r.project_name} · {r.work_type}
                </h3>
                <p>
                  {r.quantity} {r.unit} · Baseline {r.baseline_duration} /
                  actual {r.actual_duration}{" "}
                  {r.duration_basis.toLowerCase().replaceAll("_", " ")}
                </p>
                <p>{r.deviation_reason}</p>
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
