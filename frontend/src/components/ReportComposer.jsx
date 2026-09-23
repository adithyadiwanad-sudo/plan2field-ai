import { useState } from "react";
import { Send, FileText, Mic } from "lucide-react";
import VoiceRecorder from "./VoiceRecorder";
import ErrorState from "./ErrorState";
import { captureLocation } from "../lib/geolocation";
export default function ReportComposer({ project, queue }) {
  const [type, setType] = useState("TEXT"),
    [discipline, setDiscipline] = useState(""),
    [text, setText] = useState(""),
    [file, setFile] = useState(null),
    [photos, setPhotos] = useState([]),
    [delayReason, setDelayReason] = useState(""),
    [date, setDate] = useState(project?.reporting_date || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [message, setMessage] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setMessage("Capturing current GPS location…");
      const location = await captureLocation();
      await queue.enqueue(project.id, {
        source_type: type,
        ...(discipline ? { discipline } : {}),
        original_text: text,
        reporting_date: date,
        captured_at: new Date().toISOString(),
        idempotency_key: crypto.randomUUID(),
        ...(file ? { file } : {}),
        ...location,
        ...(photos.length ? { photos } : {}),
        ...(delayReason ? { delay_reason: delayReason } : {}),
        ...(type === "SPREADSHEET"
          ? {
              mapping: JSON.stringify({
                text: "report_text",
                discipline: "discipline",
              }),
            }
          : {}),
      });
      setText("");
      setFile(null);
      setPhotos([]);
      setDelayReason("");
      e.target.reset();
      setMessage(
        "Report saved. " +
          (location.latitude == null
            ? "GPS unavailable or permission denied; geofence status is UNKNOWN. "
            : "GPS captured; geofence is checked against configured site coordinates. ") +
          "Offline evidence stays on this device until acknowledged.",
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
        <span className="pill">Multi-discipline ingestion</span>
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
        Discipline
        <select
          aria-label="Discipline"
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value)}
        >
          <option value="">Detect from each update / mixed disciplines</option>
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
      <p className="muted">
        Capture starts, finishes, physical percentages and measured quantities.
        CSV/XLSX accepts report_text and an optional discipline column per row.
      </p>
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
      <label>
        Site evidence photos (optional, up to 3 PNG/JPEG files, 5 MB each)
        <input
          aria-label="Site evidence photos"
          type="file"
          accept="image/png,image/jpeg"
          multiple
          onChange={(e) => {
            const selected = Array.from(e.target.files || []);
            if (
              selected.length > 3 ||
              selected.some((f) => f.size > 5 * 1024 * 1024)
            ) {
              setError(
                new Error(
                  "Attach at most three photos, each no larger than 5 MB.",
                ),
              );
              e.target.value = "";
              setPhotos([]);
              return;
            }
            setPhotos(selected);
            setError(null);
          }}
        />
      </label>
      <p className="muted">
        {photos.length} photo(s) attached. GPS is requested when submitting;
        denied or unavailable GPS does not block your report.
      </p>
      <label>
        Delay reason (optional)
        <select
          aria-label="Delay reason"
          value={delayReason}
          onChange={(e) => setDelayReason(e.target.value)}
        >
          <option value="">No delay reported</option>
          {[
            "MATERIAL_SHORTAGE",
            "MANPOWER_SHORTAGE",
            "EQUIPMENT_FAILURE",
            "WEATHER_ACCESS",
            "DESIGN_REWORK",
            "OTHER",
          ].map((r) => (
            <option key={r} value={r}>
              {r.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
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
