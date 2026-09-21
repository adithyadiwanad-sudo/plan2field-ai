import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import ErrorState from "../components/ErrorState";
export default function ScheduleImport() {
  const { projectId } = useParams(),
    client = useQueryClient();
  const [id, setId] = useState(""),
    [error, setError] = useState(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["import", id],
    queryFn: () => api(`/projects/${projectId}/schedule-imports/${id}`),
    enabled: !!id,
    refetchInterval: (data) =>
      ["QUEUED", "EMBEDDING"].includes(data.state.data?.import_status)
        ? 2000
        : false,
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SCHEDULE FOUNDATION</span>
          <h1>Import a schedule</h1>
          <p>Validate source activities before activating a new version.</p>
        </div>
      </div>
      <form
        className="panel composer"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const form = new FormData(e.currentTarget);
            const r = await api(`/projects/${projectId}/schedule-imports`, {
              method: "POST",
              body: form,
            });
            setId(r.id);
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Source format
          <select name="format">
            <option>CSV</option>
            <option>XER</option>
            <option>XML</option>
          </select>
        </label>
        <label>
          Schedule file
          <input type="file" name="file" required accept=".csv,.xer,.xml" />
        </label>
        <label>
          Minimum WBS depth
          <input
            type="number"
            name="min_wbs_depth"
            defaultValue="0"
            min="0"
            max="20"
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            name="baseline_confirmed"
            value="true"
            required
          />
          I confirm the mapped baseline fields represent an approved baseline.
          Original source provenance will be retained.
        </label>
        <p className="notice">
          XER/XML support a restricted, documented subset with explicit
          measurement fields. Unsupported calendars and relationships are
          reported; no lossless round-trip claim.
        </p>
        <button className="primary" disabled={busy}>
          Upload & validate
        </button>
      </form>
      {error && <ErrorState error={error} />}
      <p role="status">{message}</p>
      {q.data && (
        <section className="panel composer">
          <h2>Import: {q.data.import_status}</h2>
          <p>
            Version {q.data.version_number} · {q.data.source_filename}
          </p>
          <pre>{JSON.stringify(q.data.validation_summary, null, 2)}</pre>
          <button
            className="primary"
            disabled={q.data.import_status !== "VALIDATED"}
            onClick={async () => {
              try {
                await api(
                  `/projects/${projectId}/schedule-imports/${id}/activate`,
                  { method: "POST", body: {} },
                );
                await client.invalidateQueries();
                setMessage(
                  "Schedule activated. Previous schedule versions are preserved.",
                );
              } catch (e) {
                setError(e);
              }
            }}
          >
            Activate validated schedule
          </button>
        </section>
      )}
    </>
  );
}
