import { useOutletContext, useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "../api/client";
import useOfflineReports from "../hooks/useOfflineReports";
import ReportComposer from "../components/ReportComposer";
import SyncStatus from "../components/SyncStatus";
import ErrorState from "../components/ErrorState";
export default function SubmitReport() {
  const { user, current } = useOutletContext(),
    { projectId } = useParams(),
    client = useQueryClient();
  const synced = useCallback(
    () => client.invalidateQueries({ queryKey: ["reports", projectId] }),
    [client, projectId],
  );
  const queue = useOfflineReports(user.id, synced);
  const q = useQuery({
    queryKey: ["reports", projectId],
    queryFn: () => api(`/projects/${projectId}/reports`),
    refetchInterval: 5000,
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FIELD CAPTURE</span>
          <h1>Submit a report</h1>
          <p>Preserve the evidence. Keep the schedule informed.</p>
        </div>
      </div>
      <SyncStatus queue={queue} />
      <div className="submit-grid">
        {current ? (
          <ReportComposer project={current} queue={queue} />
        ) : (
          <p>Loading project…</p>
        )}
        <section className="panel report-list">
          <h2>Recent reports</h2>
          {q.error && <ErrorState error={q.error} />}{" "}
          {!q.data?.length && <p>No submitted reports yet.</p>}
          {q.data?.map((r) => (
            <Link key={r.id} to={`../${r.id}`} relative="path">
              <span className="status">
                {r.processing_status.replaceAll("_", " ")}
              </span>
              <p>
                {r.original_text || r.transcript || r.source_type + " report"}
              </p>
              <small>
                {r.reporting_date} · {r.id.slice(0, 8)}
              </small>
              {r.error_details && <p className="late">{r.error_details}</p>}
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
