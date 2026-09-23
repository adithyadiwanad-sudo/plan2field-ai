import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { demoRoles, loginDemo } from "../api/auth";
import { projects } from "../api/projects";
import { api, setCsrf } from "../api/client";
import ErrorState from "../components/ErrorState";
export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function signIn(demoEmail) {
    setBusy(true); setError(null);
    try {
      const user = demoEmail ? await loginDemo(demoEmail) : await api("/auth/login", { method: "POST", body: {email, password} });
      setCsrf(user.csrf_token);
      onLogin(user);
      const list = await projects();
      const project = list.find(p => p.code === "OIL-DEMO-01" && p.status === "ACTIVE") || list.find(p => p.status === "ACTIVE") || list[0];
      const role = user.memberships?.find(m => m.project_id === project?.id)?.role;
      navigate(project ? `/projects/${project.id}${role === "ENGINEER" ? "/reports/new" : role === "REVIEWER" || role === "ADMIN" ? "/review" : ""}` : "/", { replace: true });
    } catch (e) { setError(e); }
    finally { setBusy(false); }
  }
  return <div className="login">
    <section className="login-story">
      <div className="brand"><b>Plan2Field AI</b></div>
      <span className="eyebrow">INTELLIGENT PROJECT CONTROLS</span>
      <h1>The field moves.<br />Your schedule<br />should know.</h1>
      <p>Bring field evidence, activity matching and human review into one connected workspace.</p>
      <div className="login-diagram"><span>01 · FIELD REPORT</span><i>↓</i><span>02 · SEMANTIC MATCH</span><i>↓</i><span>03 · REVIEWED ACTUALS</span></div>
      <small>SIH26122 · Oil India Limited challenge<br />Independent prototype · Synthetic demonstration data</small>
    </section>
    <section className="login-form"><form onSubmit={e => {e.preventDefault(); signIn();}}>
      <span className="eyebrow">YOUR PROJECT WORKSPACE</span><h2>Welcome back.</h2>
      <p>Sign in to turn observations into trusted actuals.</p>
      <section className="my-6 rounded-xl border border-blue-200 bg-blue-50 p-5" aria-labelledby="demo-heading">
        <h3 id="demo-heading" className="mb-3 text-lg font-bold">⚡ Quick Demo Login</h3>
        <div className="grid gap-3">{demoRoles.map(preset => <button key={preset.email} type="button" disabled={busy}
          className={`${preset.color} rounded-lg px-4 py-3 font-semibold text-white! disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2`}
          onClick={() => signIn(preset.email)}>{preset.label}</button>)}</div>
        <p className="mt-3 text-sm text-slate-600">Click to instantly inspect role-specific workflows for SIH judging evaluation.</p>
      </section>
      <label>Email address<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <ErrorState error={error} />}
      {busy && <p role="status">Signing in…</p>}
      <button className="primary" disabled={busy}>Sign in to workspace</button>
      <p className="login-note">Demo accounts use synthetic project data. Each role retains its own permissions and audit identity.</p>
    </form></section>
  </div>;
}
