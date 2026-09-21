import { useState } from "react";
import { Send, FileText, Mic } from "lucide-react";
import VoiceRecorder from "./VoiceRecorder";
import ErrorState from "./ErrorState";
export default function ReportComposer({ project, queue }) {
  const [type, setType] = useState("TEXT"),
    [text, setText] = useState(""),
    [file, setFile] = useState(null),
    [date, setDate] = useState(project?.reporting_date || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [message, setMessage] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await queue.enqueue(project.id, {
        source_type: type,
        original_text: text,
        reporting_date: date,
        captured_at: new Date().toISOString(),
        idempotency_key: crypto.randomUUID(),
        ...(file ? { file } : {}),
        ...(type === "SPREADSHEET"
          ? { mapping: JSON.stringify({ text: "report_text" }) }
          : {}),
      });
      setText("");
      setFile(null);
      setMessage(
        "Report saved. Online submissions are queued for processing; offline reports stay on this device until acknowledged.",
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel composer" onSubmit={submit}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">NEW FIELD EVIDENCE</span>
          <h2>What happened on site?</h2>
        </div>
        <span className="pill">deterministic-v1</span>
      </div>
      <div className="segmented">
        {["TEXT", "VOICE", "SPREADSHEET", "SCAN"].map((v) => (
          <button
            type="button"
            key={v}
            aria-pressed={type === v}
            onClick={() => {
              setType(v);
              setFile(null);
            }}
          >
            {v}
          </button>
        ))}
      </div>
      <label>
        Reporting date
        <input
          required
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      {type === "VOICE" ? (
        <VoiceRecorder onAudio={setFile} />
      ) : type !== "TEXT" ? (
        <label>
          {type === "SCAN"
            ? "Printed diary · PNG / JPEG"
            : "Progress CSV / XLSX · column: report_text"}
          <input
            type="file"
            required
            accept={type === "SCAN" ? ".png,.jpg,.jpeg" : ".csv,.xlsx"}
            onChange={(e) => setFile(e.target.files[0])}
          />
        </label>
      ) : (
        <label>
          Field report
          <textarea
            required
            rows="7"
            placeholder="Include operation, full line or asset tag, area, date, and completed component IDs…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      )}
      <div className="notice">
        Reports become staged proposals. A reviewer must approve them before
        actuals change.
      </div>
      {error && <ErrorState error={error} />}
      <p role="status">{message}</p>
      <button className="primary" disabled={busy || (type !== "TEXT" && !file)}>
        <Send size={17} />
        {busy ? "Saving report…" : "Submit report"}
      </button>
    </form>
  );
}
