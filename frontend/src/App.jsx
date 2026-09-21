import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, setCsrf } from "./api/client";
import AppShell from "./components/AppShell";
import LoginPage from "./pages/LoginPage";
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
    <Navigate to={`/projects/${(q.data.find((p) => p.status === "ACTIVE") || q.data[0]).id}`} replace />
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
    [loading, setLoading] = useState(true);
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
    api("/auth/me")
      .then(login)
      .catch(() => {
        if (!navigator.onLine) {
          const cached = sessionStorage.getItem("p2f-last-user");
          if (cached) setUser(JSON.parse(cached));
        }
      })
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="empty">Opening workspace…</div>;
  if (!user) return <LoginPage onLogin={login} />;
  return (
    <Routes>
      <Route path="/" element={<Home />} />
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
