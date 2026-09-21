import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Check, MessageSquare, X, ClipboardCheck } from "lucide-react";
import { proposals, proposalAction } from "../api/proposals";
import { api } from "../api/client";
import CandidateComparison from "./CandidateComparison";
import ProposalDiff from "./ProposalDiff";
import ErrorState from "./ErrorState";
export default function ReviewerQueue() {
  const { projectId } = useParams(),
    client = useQueryClient();
  const [status, setStatus] = useState("PENDING"),
    [selected, setSelected] = useState(null);
  const query = useQuery({
    queryKey: ["proposals", projectId, status],
    queryFn: () => proposals(projectId, status),
    refetchInterval: 10000,
  });
  const p = query.data?.find((p) => p.id === selected) || query.data?.[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">HUMAN-IN-THE-LOOP</span>
          <h1>Review queue</h1>
          <p>Turn field evidence into trusted project actuals.</p>
        </div>
        <select
          aria-label="Filter review status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {[
            "PENDING",
            "CLARIFICATION_REQUESTED",
            "APPROVED",
            "REJECTED",
            "STALE",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      {query.isPending ? (
        <p>Loading proposals…</p>
      ) : query.error ? (
        <ErrorState error={query.error} retry={query.refetch} />
      ) : !p ? (
        <div className="panel empty">
          <ClipboardCheck size={36} />
          <h2>Queue is clear</h2>
          <p>Processed reports will appear here for review.</p>
        </div>
      ) : (
        <div className="review-layout">
          <aside className="panel proposal-list">
            {query.data.map((row) => (
              <button
                key={row.id}
                className={row.id === p.id ? "selected" : ""}
                onClick={() => setSelected(row.id)}
              >
                <span className="status">
                  {row.routing_status.replaceAll("_", " ")}
                </span>
                <b>
                  {row.proposed_changes.event_type} · {row.reporting_date}
                </b>
                <p>{row.original_text || row.transcript}</p>
                <small>
                  Report {row.report_id.slice(0, 8)} · {row.source_type}
                </small>
              </button>
            ))}
          </aside>
          <ReviewDetail
            key={p.id + ":" + p.proposal_version}
            p={p}
            projectId={projectId}
            onChange={() => client.invalidateQueries()}
          />
        </div>
      )}
    </>
  );
}
function ReviewDetail({ p, projectId, onChange }) {
  const [preview, setPreview] = useState(null),
    [previewError, setPreviewError] = useState(null),
    [previewBusy, setPreviewBusy] = useState(false);
  const [candidate, setCandidate] = useState(p.selected_activity_id || ""),
    [event, setEvent] = useState(p.proposed_changes),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [dirty, setDirty] = useState(false);
  const activity = useQuery({
    queryKey: ["activity", projectId, candidate],
    queryFn: () => api(`/projects/${projectId}/activities/${candidate}`),
    enabled: !!candidate,
  });
  function edit(key, value) {
    setEvent({ ...event, [key]: value });
    setDirty(true);
  }
  async function action(name) {
    setBusy(true);
    setError(null);
    try {
      await proposalAction(
        projectId,
        p.id,
        name,
        name === "approve"
          ? { proposal_version: p.proposal_version }
          : name
            ? { proposal_version: p.proposal_version, reason }
            : {
                proposal_version: p.proposal_version,
                selected_activity_id: candidate,
                proposed_changes: event,
              },
      );
      await onChange();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const editable = ["PENDING", "CLARIFICATION_REQUESTED"].includes(
    p.lifecycle_status,
  );
  useEffect(() => {
    if (!candidate || !editable) return;
    let active = true;
    setPreview(null);
    setPreviewBusy(true);
    const timer = setTimeout(
      () =>
        api(`/projects/${projectId}/proposals/${p.id}/validate`, {
          method: "POST",
          body: { selected_activity_id: candidate, proposed_changes: event },
        })
          .then((r) => {
            if (active) {
              setPreview(r.after);
              setPreviewError(null);
            }
          })
          .catch((e) => {
            if (active) setPreviewError(e);
          })
          .finally(() => {
            if (active) setPreviewBusy(false);
          }),
      300,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [candidate, event, editable, p.id, projectId]);
  return (
    <section className="panel review-detail">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">REPORT EVIDENCE</span>
          <h2>{event.event_type.toLowerCase()} observation</h2>
        </div>
        <span className="status">{p.lifecycle_status}</span>
      </div>
      <blockquote>{p.original_text || p.transcript}</blockquote>
      {p.transcript && p.original_text && <p>{p.transcript}</p>}
      {p.source_type === "VOICE" && (
        <audio
          controls
          src={`/api/projects/${projectId}/reports/${p.report_id}/audio`}
        />
      )}
      <p className="muted">
        Extraction: deterministic-v1 · Proposal v{p.proposal_version} · Schedule{" "}
        {p.schedule_version_id.slice(0, 8)}
      </p>
      <CandidateComparison
        candidates={p.candidate_matches}
        value={candidate}
        onChange={(id) => {
          setCandidate(id);
          setDirty(true);
        }}
      />
      <div className="form-grid">
        <label>
          Event date
          <input
            type="date"
            value={event.event_date || ""}
            onChange={(e) => edit("event_date", e.target.value || null)}
          />
        </label>
        <label>
          Line identifier
          <input
            value={event.line_number || ""}
            onChange={(e) => edit("line_number", e.target.value || null)}
          />
        </label>
        <label>
          Operation
          <select
            value={event.action || ""}
            onChange={(e) => edit("action", e.target.value || null)}
          >
            <option value="">Unknown</option>
            {[
              "ERECTION",
              "FABRICATION",
              "TESTING",
              "WELDING",
              "INSPECTION",
              "CIVIL",
              "INSULATION",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Components
          <input
            value={event.component_ids.join(", ")}
            onChange={(e) =>
              edit(
                "component_ids",
                e.target.value
                  .split(",")
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean),
              )
            }
          />
        </label>
        <label>
          Quantity
          <input
            type="number"
            min="0"
            value={event.quantity ?? ""}
            onChange={(e) =>
              edit(
                "quantity",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
          />
        </label>
        <label>
          Quantity mode
          <select
            value={event.quantity_mode || ""}
            onChange={(e) => edit("quantity_mode", e.target.value || null)}
          >
            <option value="">Not applicable</option>
            {["COMPONENT_SET", "CUMULATIVE", "INCREMENTAL"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        {event.event_type === "CORRECTION" && (
          <label>
            Accepted event to correct
            <select
              value={event.correction_of_event_id || ""}
              onChange={(e) =>
                edit("correction_of_event_id", e.target.value || null)
              }
            >
              <option value="">Select accepted event</option>
              {activity.data?.events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.effective_date} · {e.event_type} · {e.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Reconciliation reason
          <input
            value={event.reconciliation_reason || ""}
            onChange={(e) => edit("reconciliation_reason", e.target.value)}
          />
        </label>
      </div>
      <p className="notice">
        {p.reason_codes.join(" · ") || p.explanation}
        {p.missing_fields.length > 0 && (
          <>
            <br />
            Missing: {p.missing_fields.join(", ")}
          </>
        )}
      </p>
      <ProposalDiff activity={activity.data} event={event} preview={preview} />
      {previewBusy && <p role="status">Validating proposed actuals…</p>}
      {previewError && <ErrorState error={previewError} />}
      {error && <ErrorState error={error} />}
      <label>
        Clarification or rejection reason
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain what needs to be confirmed…"
        />
      </label>
      <div className="review-actions">
        <button
          className="secondary"
          disabled={busy || !editable || !candidate}
          onClick={() => action("")}
        >
          Save & revalidate
        </button>
        <button
          className="primary"
          disabled={
            busy ||
            !editable ||
            dirty ||
            previewBusy ||
            !!previewError ||
            !candidate ||
            p.missing_fields.length > 0
          }
          onClick={() => action("approve")}
        >
          <Check size={16} />
          Approve
        </button>
        <button
          disabled={busy || !editable || reason.trim().length < 3}
          onClick={() => action("clarify")}
        >
          <MessageSquare size={16} />
          Clarify
        </button>
        <button
          disabled={busy || !editable || reason.trim().length < 3}
          onClick={() => action("reject")}
        >
          <X size={16} />
          Reject
        </button>
      </div>
      {dirty && (
        <p className="muted">Save and revalidate your edits before approval.</p>
      )}
    </section>
  );
}
