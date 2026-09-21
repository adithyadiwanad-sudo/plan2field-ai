import { day, displayDate, signed } from "../lib/dates";
export default function GanttChart({ activities, reportingDate }) {
  const dates = activities
    .flatMap((a) => [
      a.baseline_start,
      a.baseline_finish,
      a.actual_start,
      a.actual_finish,
    ])
    .filter(Boolean);
  if (!dates.length)
    return <div className="empty">No dates available for the Gantt view.</div>;
  if (reportingDate) dates.push(reportingDate);
  const min = Math.min(...dates.map(day)) - 1,
    max = Math.max(...dates.map(day)) + 1,
    width = max - min;
  const left = (v) => ((day(v) - min) / width) * 100;
  return (
    <div className="gantt">
      <div className="gantt-legend">
        <span>▬ Baseline</span>
        <span>▬ Actual / elapsed actual period</span>
        <span>│ Reporting date: {displayDate(reportingDate)}</span>
      </div>
      {activities.map((a) => (
        <div className="gantt-row" key={a.id}>
          <div>
            <b>{a.external_activity_id}</b>
            <small>
              {a.discipline} · {a.wbs_path}
            </small>
            <small>
              Start Δ {signed(a.start_variance_days)} · Finish Δ{" "}
              {signed(a.finish_variance_days)}
            </small>
            <small>
              {Number(a.physical_percent_complete).toFixed(1)}% physical
              complete
            </small>
          </div>
          <div className="gantt-track">
            {reportingDate && (
              <i
                className="reporting-line"
                style={{ left: left(reportingDate) + "%" }}
              />
            )}
            {a.baseline_start && a.baseline_finish && (
              <span
                className="bar baseline"
                title={`Baseline ${a.baseline_start} to ${a.baseline_finish}`}
                style={{
                  left: left(a.baseline_start) + "%",
                  width:
                    Math.max(
                      0.3,
                      ((day(a.baseline_finish) - day(a.baseline_start)) /
                        width) *
                        100,
                    ) + "%",
                }}
              />
            )}
            {a.actual_start && (
              <span
                className="bar actual"
                title={`${a.actual_finish ? "Actual period" : "Elapsed actual period, not completed work"}: ${a.actual_start} to ${a.actual_finish || reportingDate}`}
                style={{
                  left: left(a.actual_start) + "%",
                  width:
                    Math.max(
                      0.3,
                      ((day(
                        a.actual_finish || reportingDate || a.actual_start,
                      ) -
                        day(a.actual_start)) /
                        width) *
                        100,
                    ) + "%",
                }}
              />
            )}
          </div>
        </div>
      ))}
      <p className="muted">
        Use Table for exact date values. Calendar-day axis; no CPM
        recalculation.
      </p>
    </div>
  );
}
