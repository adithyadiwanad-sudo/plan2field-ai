import { useState } from "react";
import { Layers3, ArrowRight, ShieldCheck } from "lucide-react";
import { api } from "../api/client";
import ErrorState from "../components/ErrorState";
export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  return (
    <div className="login">
      <section className="login-story">
        <div className="brand">
          <Layers3 />
          <b>Plan2Field AI</b>
        </div>
        <span className="eyebrow">INTELLIGENT PROJECT CONTROLS</span>
        <h1>
          The field moves.
          <br />
          Your schedule
          <br />
          should know.
        </h1>
        <p>
          Bring field evidence, activity matching and human review into one
          connected workspace.
        </p>
        <div className="login-diagram">
          <span>01 · FIELD REPORT</span>
          <i>↓</i>
          <span>02 · SEMANTIC MATCH</span>
          <i>↓</i>
          <span>03 · REVIEWED ACTUALS</span>
        </div>
        <small>
          SIH26122 · Oil India Limited challenge
          <br />
          Independent prototype · Synthetic demonstration data
        </small>
      </section>
      <section className="login-form">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              onLogin(
                await api("/auth/login", {
                  method: "POST",
                  body: { email, password },
                }),
              );
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <span className="eyebrow">YOUR PROJECT WORKSPACE</span>
          <h2>Welcome back.</h2>
          <p>Sign in to turn observations into trusted actuals.</p>
          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <ErrorState error={error} />}
          <button className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in to workspace"}
            <ArrowRight size={18} />
          </button>
          <p className="login-note">
            <ShieldCheck size={18} /> Local demo accounts are created through
            the explicit setup script. Use the email and password configured in
            your .env file.
          </p>
        </form>
      </section>
    </div>
  );
}
