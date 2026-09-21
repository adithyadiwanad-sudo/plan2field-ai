# Render API and Vercel demo authentication

The frontend reads `VITE_API_BASE_URL` at build time. When unset, it uses `https://plan2field-backend.onrender.com/api`. Auth always calls `/auth/me`, `/auth/login` and `/auth/logout` through that client. Exports and audio URLs use the same configured base. Requests include cookies and preserve CSRF headers; non-JSON error pages produce a readable configuration/availability error.

On startup the app restores an active session. Only an HTTP 401 triggers login with the requested public demo account. Concurrent startup checks share one request. The login form is bypassed; `/login` redirects to the default project after authentication. OIL-DEMO-01 is selected when active, otherwise the first accessible active project is used. Database UUIDs remain the route identifiers.

## Deployment settings

Vercel frontend:

```text
VITE_API_BASE_URL=https://plan2field-backend.onrender.com/api
```

Render backend:

```text
NODE_ENV=production
APP_ORIGIN=https://plan2field-ai.vercel.app
COOKIE_SECURE=true
```

For several trusted frontend origins, use comma-separated `APP_ORIGINS`; it overrides the single origin allowlist. Cross-origin preflight and credentials are enabled only for configured origins. Production cookies are HttpOnly, Secure and SameSite=None; writes still require a valid CSRF token and trusted Origin. The requested demo account must already exist in the database with the configured password. No user passwords were reset by this change.

Optional `VITE_DEMO_EMAIL` and `VITE_DEMO_PASSWORD` override the public demo defaults. These values are included in the browser bundle; never use a private account for this auto-login flow. Browser policies that block third-party cookies may require a same-site API domain or proxy.

Redeploy both applications to apply the client and server changes. Vite environment changes require a rebuild. `frontend/vercel.json` supplies SPA deep-link fallback when the Vercel project root is `frontend`; the existing root service configuration is preserved.

## Local development and checks

`scripts/run_local.py frontend` explicitly defaults `VITE_API_BASE_URL=/api` for the local proxy. Running Vite directly without that setting uses the Render fallback, as requested.

Validated commands: `npm run build` and `npm test` (14 backend tests, 7 frontend tests). Browser smoke helpers now expect automatic authentication. This code change does not itself deploy to Render or Vercel.

The resumed enterprise verification also passed against Neon: six discipline tags, ACT-24-SPOOL-01 auto-linking, staged +2-day variance, explicit unmatched routing, audit snapshots and unchanged actuals.

## Files changed

- Frontend: `src/api/client.js`, new `src/api/auth.js`, `src/App.jsx`, new `src/vite-env.d.ts`, `src/components/ReviewerQueue.jsx`, `src/pages/ProjectDashboard.jsx`, `src/pages/ReportDetail.jsx`, new `.env.example`, new `vercel.json`, new `tests/api-client.test.js`.
- Backend: `src/app.ts`, `src/config.ts`, `src/middleware/auth.ts`, new `src/middleware/cors.ts`, `src/routes/auth.ts`, new `tests/unit/cors.test.ts`.
- Support: `scripts/run_local.py`, `tests/cloud-smoke.mjs`, `tests/e2e/helpers.js`, `tests/ui-smoke.mjs`, `README.md`, this document.
