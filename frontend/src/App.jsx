import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { setCsrf } from "./api/client";
import { restoreDemoSession } from "./api/auth";
import AppShell from "./components/AppShell";
import ProjectDashboard from "./pages/ProjectDashboard";
import SubmitReport from "./pages/SubmitReport";
import ReviewPage from "./pages/ReviewPage";
import ScheduleImport from "./pages/ScheduleImport";
import ActivityDetail from "./pages/ActivityDetail";
import ReportDetail from "./pages/ReportDetail";
import HistoryPage from "./pages/HistoryPage";
import ErrorState from "./components/ErrorState";
import { projects } from "./api/projects";
function Home() {
  const q = useQuery({ queryKey: ["projects"], queryFn: projects });
  if (q.error) return <ErrorState error={q.error} />;
  return q.data?.length ? (
    <Navigate
      to={`/projects/${(q.data.find((p) => p.code === "OIL-DEMO-01" && p.status === "ACTIVE") || q.data.find((p) => p.status === "ACTIVE") || q.data[0]).id}`}
      replace
    />
  ) : (
    <p className="empty">
      {q.isPending
        ? "Loading workspace…"
        : "No project memberships. Run the local demo seed or contact your administrator."}
    </p>
  );
}
export default function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [authError, setAuthError] = useState(null),
    [attempt, setAttempt] = useState(0);
  const client = useQueryClient();
  function login(u) {
    setCsrf(u.csrf_token);
    setUser(u);
    sessionStorage.setItem(
      "p2f-last-user",
      JSON.stringify({ id: u.id, name: u.name, email: u.email }),
    );
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    setAuthError(null);
    restoreDemoSession()
      .then((u) => {
        if (active) login(u);
      })
      .catch((error) => {
        if (!active) return;
        if (!navigator.onLine) {
          try {
            const cached = sessionStorage.getItem("p2f-last-user");
            if (cached) {
              setUser(JSON.parse(cached));
              return;
            }
          } catch {
            sessionStorage.removeItem("p2f-last-user");
          }
        }
        setAuthError(error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  if (loading) return <div className="empty">Opening workspace…</div>;
  if (!user)
    return (
      <div className="empty">
        <h1>Demo workspace</h1>
        {authError ? (
          <ErrorState
            error={authError}
            retry={() => setAttempt((a) => a + 1)}
          />
        ) : (
          <button onClick={() => setAttempt((a) => a + 1)}>
            Open demo workspace
          </button>
        )}
      </div>
    );
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route
        element={
          <AppShell
            user={user}
            onLogout={() => {
              setUser(null);
              setCsrf("");
              sessionStorage.removeItem("p2f-last-user");
              client.clear();
            }}
          />
        }
      >
        <Route path="/projects/:projectId" element={<ProjectDashboard />} />
        <Route
          path="/projects/:projectId/reports/new"
          element={<SubmitReport />}
        />
        <Route
          path="/projects/:projectId/reports/:reportId"
          element={<ReportDetail />}
        />
        <Route path="/projects/:projectId/review" element={<ReviewPage />} />
        <Route
          path="/projects/:projectId/import"
          element={<ScheduleImport />}
        />
        <Route
          path="/projects/:projectId/activities/:activityId"
          element={<ActivityDetail />}
        />
        <Route path="/history" element={<HistoryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
