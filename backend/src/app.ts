import express from "express";
import { cors } from "./middleware/cors.js";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { requestId, throttled } from "./middleware/requestId.js";
import { errors } from "./middleware/errors.js";
import { auth } from "./middleware/auth.js";
import { projectAccess, reviewer } from "./middleware/projectAccess.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { projectsRouter } from "./routes/projects.js";
import { activitiesRouter, activityQuery, page } from "./routes/activities.js";
import { reportsRouter } from "./routes/reports.js";
import { proposalsRouter } from "./routes/proposals.js";
import { schedulesRouter } from "./routes/schedules.js";
import { historyRouter } from "./routes/history.js";
import { pool } from "./db/pool.js";
import { closeout } from "./services/historyService.js";
import { connectorStatus } from "./adapters/scheduleExport.js";
import { exportsForProject } from "./services/exportService.js";
export const app = express();
app.use(
  requestId,
  cors,
  helmet(),
  cookieParser(),
  express.json({ limit: "100kb" }),
  rateLimit({ windowMs: 60000, limit: 180, handler: throttled }),
);
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/history", historyRouter);
const root = "/api/projects/:projectId";
app.use(root, auth, projectAccess);
app.use(root + "/activities", activitiesRouter);
app.use(root + "/reports", reportsRouter);
app.use(root + "/proposals", proposalsRouter);
app.use(root + "/schedule-imports", schedulesRouter);
app.get(root + "/variance", async (req, res) => {
  const p = page(req.query);
  const rows = (
    await pool.query(
      activityQuery +
        " WHERE a.project_id=$1 AND a.schedule_version_id=(SELECT active_schedule_version_id FROM projects WHERE id=$1) ORDER BY a.external_activity_id LIMIT $2 OFFSET $3",
      [res.locals.projectId, p.limit, p.offset],
    )
  ).rows;
  const pending = (
    await pool.query(
      "SELECT count(*)::int AS n FROM staged_proposals WHERE project_id=$1 AND lifecycle_status='PENDING'",
      [res.locals.projectId],
    )
  ).rows[0].n;
  res.json({
    activities: rows,
    pending_reviews: pending,
    variance_basis: "Calendar days",
    connector_status: connectorStatus,
  });
});
app.get(root + "/audit", async (req, res) => {
  const p = page(req.query);
  res.json(
    (
      await pool.query(
        "SELECT * FROM audit_events WHERE project_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        [res.locals.projectId, p.limit, p.offset],
      )
    ).rows,
  );
});
app.get(root + "/exports", async (req, res) => {
  const result = await exportsForProject(
    pool,
    res.locals.projectId,
    req.query.format === "csv" ? "csv" : undefined,
  );
  if (req.query.format === "csv") {
    res.type("text/csv").attachment("enterprise-proposals.csv").send(result);
  } else res.attachment("enterprise-proposals.json").json(result);
});
app.post(root + "/closeout", async (req, res) => {
  reviewer(res);
  res.json(
    await closeout(
      res.locals.projectId,
      res.locals.user.id,
      z.string().trim().min(5).max(2000).parse(req.body.reason),
      res.locals.requestId,
    ),
  );
});
app.use((_req, res) =>
  res.status(404).json({
    code: "NOT_FOUND",
    message: "Endpoint not found",
    fieldErrors: {},
    requestId: res.locals.requestId,
  }),
);
app.use(errors);
