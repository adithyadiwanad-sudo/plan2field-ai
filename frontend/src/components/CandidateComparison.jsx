import { score } from "../lib/scoreFormatting";
export default function CandidateComparison({ candidates, value, onChange }) {
  return (
    <fieldset className="candidate-list">
      <legend>Candidate activities</legend>
      {candidates.map((a, index) => (
        <label
          key={a.id}
          className={"candidate " + (value === a.id ? "selected" : "")}
        >
          <input
            type="radio"
            name="candidate"
            value={a.id}
            checked={value === a.id}
            onChange={() => onChange(a.id)}
          />
          <span>
            <b>{a.description}</b>
            <small>
              {a.external_activity_id} · Line {a.line_number || "unknown"} ·{" "}
              {a.area || "Area unknown"}
            </small>
            <small>
              {a.wbs_path} · {a.discipline}
            </small>
            <small>{a.reasons?.join(" · ")}</small>
          </span>
          <span className="match-score">
            {score(a.rerank_score)}
            <small>Match score</small>
          </span>
        </label>
      ))}
      {!candidates.length && (
        <p>
          No compatible candidate. Request clarification or reject this event.
        </p>
      )}
      <p className="muted">
        Raw cross-encoder score; uncalibrated, not a probability. Candidate
        selection is revalidated by the server.
      </p>
    </fieldset>
  );
}
