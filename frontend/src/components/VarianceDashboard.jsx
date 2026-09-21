import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowUpRight, List, ChartNoAxesGantt } from "lucide-react";
import { displayDate, signed } from "../lib/dates";
import GanttChart from "./GanttChart";
export default function VarianceDashboard({ data, project }) {
  const [search, setSearch] = useState(""),
    [view, setView] = useState("table");
  const rows = data.activities.filter((a) =>
    (a.description + " " + a.external_activity_id + " " + a.wbs_path)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">LIVE SCHEDULE</span>
          <h2>Execution progress</h2>
          <p>Approved actuals against the protected baseline</p>
        </div>
        <div className="segmented">
          <button
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            <List size={16} /> Table
          </button>
          <button
            aria-pressed={view === "gantt"}
            onClick={() => setView("gantt")}
          >
            <ChartNoAxesGantt size={16} /> Gantt
          </button>
        </div>
      </div>
      <div className="table-toolbar">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Search activities"
            placeholder="Search activities, ID or WBS…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span>{rows.length} activities · Calendar-day variance</span>
      </div>
      {view === "gantt" ? (
        <GanttChart activities={rows} reportingDate={project?.reporting_date} />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Activity / WBS</th>
                <th>Baseline dates</th>
                <th>Actual dates</th>
                <th>Physical progress</th>
                <th>Start Δ</th>
                <th>Finish Δ</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link className="activity-link" to={`activities/${a.id}`}>
                      {a.description}
                      <ArrowUpRight size={13} />
                    </Link>
                    <small>{a.external_activity_id}</small>
                    <small className="wbs">{a.wbs_path}</small>
                  </td>
                  <td>
                    {displayDate(a.baseline_start)}
                    <small>{displayDate(a.baseline_finish)}</small>
                  </td>
                  <td>
                    {displayDate(a.actual_start)}
                    <small>{displayDate(a.actual_finish)}</small>
                  </td>
                  <td>
                    <div className="progress-label">
                      <b>{Number(a.physical_percent_complete).toFixed(1)}%</b>
                      <span>
                        {a.accepted_quantity} / {a.planned_total_quantity}{" "}
                        {a.quantity_unit}
                      </span>
                    </div>
                    <progress max="100" value={a.physical_percent_complete} />
                    <small>{a.measurement_method.replaceAll("_", " ")}</small>
                  </td>
                  <td className={a.start_variance_days > 0 ? "late" : ""}>
                    {signed(a.start_variance_days)}
                  </td>
                  <td>{signed(a.finish_variance_days)}</td>
                  <td>
                    <span
                      className={
                        "status " +
                        (a.actual_finish
                          ? "accepted"
                          : a.actual_start
                            ? "active"
                            : "")
                      }
                    >
                      {a.actual_finish
                        ? "Complete"
                        : a.actual_start
                          ? "In progress"
                          : "Not started"}
                    </span>
                    <small>{a.pending_reviews || 0} pending reviews</small>
                    <small>
                      {a.last_accepted_update
                        ? "Updated " +
                          new Date(a.last_accepted_update).toLocaleDateString()
                        : "No accepted update"}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="empty">
              No activities to display. Import and activate a schedule to begin.
            </div>
          )}
        </div>
      )}
      <div className="panel-foot">
        <Shield /> Baselines are protected. Physical progress does not imply
        elapsed duration or a forecast.
      </div>
    </section>
  );
}
function Shield() {
  return <span aria-hidden="true">◇</span>;
}
