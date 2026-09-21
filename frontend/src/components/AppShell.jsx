import {
  NavLink,
  Outlet,
  useParams,
  useNavigate,
  Navigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardCheck,
  FilePlus2,
  History,
  Layers3,
  ArrowUpRight,
  LogOut,
  HardHat,
  Upload,
  ShieldCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { projects } from "../api/projects";
import { api } from "../api/client";
export default function AppShell({ user, onLogout }) {
  const { projectId } = useParams(),
    navigate = useNavigate();
  const query = useQuery({ queryKey: ["projects"], queryFn: projects });
  const fallback =
    query.data?.find((p) => p.status === "ACTIVE") || query.data?.[0];
  const current =
    query.data?.find((p) => p.id === projectId) ||
    (!projectId ? fallback : null);
  if (query.isPending) return <p className="empty">Loading workspace…</p>;
  if (query.error)
    return (
      <p className="empty">
        Unable to load workspace.{" "}
        <button onClick={() => query.refetch()}>Retry</button>
      </p>
    );
  if (!fallback)
    return <p className="empty">No project memberships are available.</p>;
  if (projectId && !current)
    return <Navigate to={`/projects/${fallback.id}`} replace />;
  const base = `/projects/${current.id}`;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Layers3 />
          </span>
          <span>
            Plan2Field<span className="ai-label"> AI</span>
            <small>PROJECT INTELLIGENCE</small>
          </span>
        </a>
        <div className="workspace-label">
          WORKSPACE <span>LOCAL</span>
        </div>
        <label className="sr-only" htmlFor="project">
          Project
        </label>
        <select
          id="project"
          value={current?.id || ""}
          onChange={(e) => navigate(`/projects/${e.target.value}`)}
        >
          <option value="" disabled>
            Select project
          </option>
          {query.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code}
            </option>
          ))}
        </select>
        <div className="nav-label">PROJECT CONTROLS</div>
        <nav>
          {[
            [base, "Overview", LayoutDashboard, true],
            [base + "/reports/new", "Submit report", FilePlus2],
            [base + "/review", "Review queue", ClipboardCheck],
            [base + "/import", "Schedule import", Upload],
            ["/history", "Historical knowledge", History],
          ].map(([to, label, Icon, end]) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={19} />
              {label}
              <ArrowUpRight size={13} className="nav-arrow" />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <ShieldCheck size={22} />
          <strong>Evidence before actuals</strong>
          <p>Every accepted update has a reviewable source and audit trail.</p>
          <span className="local-dot" /> Local inference
        </div>
        <div className="user">
          <span className="avatar">{user.name?.slice(0, 2).toUpperCase()}</span>
          <span>
            {user.name}
            <small>Project workspace</small>
          </span>
          <button
            aria-label="Sign out"
            onClick={async () => {
              await api("/auth/logout", { method: "POST" });
              onLogout();
            }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            <HardHat size={16} /> Infrastructure execution{" "}
            <span className="slash">/</span> {current?.code || "Knowledge base"}
          </span>
          <span className="pill">SYNTHETIC DEMO DATA</span>
        </header>
        <div className="main-content">
          <Outlet context={{ user, current }} />
        </div>
        <footer>
          Plan2Field AI · SIH26122 prototype{" "}
          <span>Internal actuals · External system not connected</span>
        </footer>
      </main>
    </div>
  );
}
