import { useParams, useOutletContext, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Plus,
  Layers3,
  ClipboardCheck,
  Activity,
  CalendarDays,
} from "lucide-react";
import { api } from "../api/client";
import VarianceDashboard from "../components/VarianceDashboard";
import ErrorState from "../components/ErrorState";
import ProjectAudit from "../components/ProjectAudit";
import { displayDate } from "../lib/dates";
export default function ProjectDashboard() {
  const { projectId } = useParams(),
    { current } = useOutletContext();
  const q = useQuery({
    queryKey: ["variance", projectId],
    refetchInterval: 10000,
    queryFn: () => api(`/projects/${projectId}/variance?limit=200`),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PROJECT OVERVIEW</span>
          <h1>
            From field evidence.
            <br />
            <span className="muted-heading">To trusted progress.</span>
          </h1>
          <p>
            {current?.name || "Project schedule and actuals"} ·{" "}
            {current?.timezone || "Asia/Kolkata"}
          </p>
        </div>
        <Link className="primary" to="reports/new">
          <Plus size={18} /> Submit field report
        </Link>
      </div>
      <div className="date-strip">
        <CalendarDays size={17} /> Reporting date{" "}
        <b>{displayDate(current?.reporting_date)}</b>
        <span>Baseline protected · Reviewer approval required</span>
      </div>
      {q.isPending ? (
        <div className="panel empty">Loading project actuals…</div>
      ) : q.error ? (
        <ErrorState error={q.error} retry={q.refetch} />
      ) : (
        <>
          <div className="stats">
            {[
              [
                Layers3,
                "Schedule activities",
                q.data.activities.length,
                "Active schedule version",
              ],
              [
                Activity,
                "Activities started",
                q.data.activities.filter((a) => a.actual_start).length,
                "From accepted field evidence",
              ],
              [
                ClipboardCheck,
                "Awaiting review",
                q.data.pending_reviews,
                "Your approval keeps actuals trusted",
              ],
            ].map(([Icon, label, value, note]) => (
              <article key={label}>
                <div>
                  <span>{label}</span>
                  <Icon size={19} />
                </div>
                <strong>{value.toString().padStart(2, "0")}</strong>
                <small>{note}</small>
              </article>
            ))}
          </div>
          <VarianceDashboard data={q.data} project={current} />
          <div className="bottom-grid">
            <section className="panel callout">
              <span className="eyebrow">THE APPROVAL LOOP</span>
              <h2>Every update has a source.</h2>
              <p>
                Compare candidates, check dates and quantities, then approve a
                traceable change.
              </p>
              <Link to="review">
                Open review queue <ArrowUpRight size={16} />
              </Link>
            </section>
            <section className="panel callout">
              <span className="eyebrow">SCHEDULE CONNECTION</span>
              <h2>Internal actuals, persisted.</h2>
              <p>
                External scheduling system not connected. Download field-level
                update proposals for review.
              </p>
              <a href={`/api/projects/${projectId}/exports?format=csv`}>
                Enterprise Export · CSV <ArrowUpRight size={16} />
              </a>
              <a
                className="secondary"
                href={`/api/projects/${projectId}/exports?format=json`}
              >
                Enterprise Export · JSON
              </a>
            </section>
          </div>
          <ProjectAudit projectId={projectId} role={current?.role} />
        </>
      )}
    </>
  );
}
