# One-click demo login

Open `/login`, or choose **Switch demo role** from the workspace sidebar.

| Account | Project role | Landing page |
| --- | --- | --- |
| engineer@plan2field.ai | ENGINEER | Submit report |
| planner@plan2field.ai | REVIEWER | Planner review queue |

Both are public synthetic-demo accounts with password `ChangeThisDemoPassword123!`. They use the existing password-verifying `/api/auth/login` endpoint, HttpOnly session cookie, CSRF protection and project membership guards. No special authentication bypass exists. Manual login remains available; startup outside `/login` retains the existing automatic demo-session restoration.

Each account has a distinct stored user ID and PIPING profile discipline. Auth responses contain `id`, `userId`, `discipline` and project-specific `memberships`. On project routes, the server sets the role from the membership in both `res.locals.role` and `res.locals.user.role`. Report submission and approval continue using the authenticated user ID. A global role is intentionally not used to grant access across projects. Switching accounts clears the React Query cache.

## Setup

Apply `database/migrations/004_demo_profiles.sql` using `python scripts/migrate_cloud.py`. With `LOCAL_DEMO=true`, run `python ml_worker/scripts/seed_demo_accounts.py`, or the normal `ml_worker/scripts/seed_data.py` fixture seed. The standalone script needs the existing synthetic OIL-DEMO-01 project. Seeds preserve existing passwords and memberships rather than silently resetting user credentials. They grant no membership in the isolation project.

The migration and both account inserts have been applied to the configured Neon database. Redeploy the backend and frontend to publish the UI and enriched session profiles. The restricted API process does not need schema or account-creation privileges at startup.

## Verification

- Production build and JavaScript unit suite.
- Real PostgreSQL HTTP integration: correct/wrong passwords, session restoration, engineer denial on reviewer-only action, project isolation, submitted_by and reporter_role lineage.
- `node tests/demo-login-ui.mjs`: explicitly mocked API browser check for both presets, redirects, role switching, refresh session reuse and mobile layout.
