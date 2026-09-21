import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import AuditTimeline from "../components/AuditTimeline";
import ErrorState from "../components/ErrorState";
import { displayDate } from "../lib/dates";
export default function ActivityDetail() {
  const { projectId, activityId } = useParams();
  const q = useQuery({
    queryKey: ["activity", projectId, activityId],
    queryFn: () => api(`/projects/${projectId}/activities/${activityId}`),
  });
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <p>Loading activity…</p>;
  const a = q.data;
  return (
    <>
      <span className="eyebrow">{a.external_activity_id}</span>
      <h1>{a.description}</h1>
      <p>
        {a.wbs_path} · Row version {a.row_version}
      </p>
      <div className="panel composer">
        <h2>{a.physical_percent_complete}% physical complete</h2>
        <progress max="100" value={a.physical_percent_complete} />
        <p>
          {a.accepted_quantity} / {a.planned_total_quantity} {a.quantity_unit} ·{" "}
          {a.measurement_method}
        </p>
        <p>
          Baseline: {displayDate(a.baseline_start)} —{" "}
          {displayDate(a.baseline_finish)}
        </p>
        <p>
          Actual: {displayDate(a.actual_start)} — {displayDate(a.actual_finish)}
        </p>
        <p>Forecast finish: {displayDate(a.forecast_finish)}</p>
        <h2>Accepted event ledger</h2>
        <AuditTimeline events={a.events} />
      </div>
    </>
  );
}
