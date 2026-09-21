import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, apiUrl } from "../api/client";
import ErrorState from "../components/ErrorState";
export default function ReportDetail() {
  const { projectId, reportId } = useParams();
  const [message, setMessage] = useState("");
  const q = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => api(`/projects/${projectId}/reports/${reportId}`),
    refetchInterval: 5000,
  });
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <p>Loading report…</p>;
  const r = q.data;
  return (
    <>
      <span className="eyebrow">SOURCE EVIDENCE</span>
      <h1>Field report</h1>
      <section className="panel composer">
        <span className="status">{r.processing_status}</span>
        <p>{r.original_text}</p>
        <p>{r.transcript}</p>
        {r.source_type === "VOICE" && (
          <audio
            controls
            crossOrigin="use-credentials"
            src={apiUrl(`/projects/${projectId}/reports/${reportId}/audio`)}
          />
        )}
        <p>
          Captured {r.captured_at} · Received {r.received_at}
        </p>
        <p>Extraction provider: {r.extraction_provider}</p>
        {r.error_details && <div className="error">{r.error_details}</div>}
        <pre>{JSON.stringify(r.events, null, 2)}</pre>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api(
                `/projects/${projectId}/reports/${reportId}/clarifications`,
                {
                  method: "POST",
                  body: {
                    original_text: e.currentTarget.text.value,
                    reporting_date: r.reporting_date,
                    captured_at: new Date().toISOString(),
                    idempotency_key: crypto.randomUUID(),
                  },
                },
              );
              setMessage("Clarification queued as new evidence.");
            } catch (e) {
              setMessage(e.message);
            }
          }}
        >
          <label>
            Clarification
            <textarea name="text" required />
          </label>
          <button>Submit clarification</button>
          <p role="status">{message}</p>
        </form>
      </section>
    </>
  );
}
