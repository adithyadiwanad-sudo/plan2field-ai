import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import AuditTimeline from "./AuditTimeline";
import ErrorState from "./ErrorState";
export default function ProjectAudit({ projectId, role }) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const client = useQueryClient();
  const q = useQuery({
    queryKey: ["audit", projectId],
    queryFn: () => api(`/projects/${projectId}/audit`),
    enabled: open,
  });
  return (
    <details
      className="panel composer"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Project audit trail & approved closeout</summary>
      {open && (
        <>
          <h2 style={{ marginTop: 20 }}>Audit trail</h2>
          {q.error ? (
            <ErrorState error={q.error} />
          ) : q.data ? (
            <AuditTimeline events={q.data} />
          ) : (
            <p>Loading audit…</p>
          )}
          {["REVIEWER", "ADMIN"].includes(role) && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError(null);
                try {
                  await api(`/projects/${projectId}/closeout`, {
                    method: "POST",
                    body: { reason },
                  });
                  setMessage(
                    "Closeout approved. Historical records created with source provenance.",
                  );
                  client.invalidateQueries();
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h3>Approve project closeout</h3>
              <p>
                This action closes the project and creates historical records
                from accepted dates. Every activity must have actual and
                baseline start/finish dates. Synthetic projects remain
                synthetic.
              </p>
              <label>
                Closeout deviation/context statement
                <textarea
                  required
                  minLength={5}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button disabled={busy}>Approve closeout</button>
              {error && <ErrorState error={error} />}
              <p role="status">{message}</p>
            </form>
          )}
        </>
      )}
    </details>
  );
}
