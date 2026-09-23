import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { ApiError } from "../middleware/errors.js";
import { directSuccessors } from "../services/evidenceService.js";
export const page = (q: any) => ({
  limit: z.coerce.number().int().min(1).max(200).default(100).parse(q.limit),
  offset: z.coerce.number().int().min(0).default(0).parse(q.offset),
});
export const activitiesRouter = Router({ mergeParams: true });
activitiesRouter.get("/:activityId/successors", async (req, res) => {
  const id = z.string().uuid().parse(req.params.activityId);
  const a = (
    await pool.query(
      "SELECT schedule_version_id FROM schedule_activities WHERE id=$1 AND project_id=$2",
      [id, res.locals.projectId],
    )
  ).rows[0];
  if (!a) throw new ApiError(404, "NOT_FOUND", "Activity not found.");
  res.json({
    successors: await directSuccessors(
      pool,
      res.locals.projectId,
      a.schedule_version_id,
      id,
    ),
    scope: "IMMEDIATE_DEPENDENCIES_ONLY",
  });
});
export const activityQuery =
  "SELECT a.*,b.baseline_start,b.baseline_finish,b.provenance AS baseline_provenance,(a.actual_start-b.baseline_start) AS start_variance_days,(a.actual_finish-b.baseline_finish) AS finish_variance_days,(SELECT max(committed_at) FROM progress_events e WHERE e.activity_id=a.id) AS last_accepted_update,(SELECT count(*)::int FROM staged_proposals p WHERE p.selected_activity_id=a.id AND p.lifecycle_status='PENDING') AS pending_reviews,(SELECT count(*)::int FROM staged_proposals p WHERE p.selected_activity_id=a.id AND p.routing_status='AUTO_STAGED' AND p.lifecycle_status='PENDING') AS auto_linked FROM schedule_activities a LEFT JOIN activity_baselines b ON b.activity_id=a.id";
activitiesRouter.get("/", async (req, res) => {
  const p = page(req.query);
  res.json(
    (
      await pool.query(
        activityQuery +
          " WHERE a.project_id=$1 AND a.schedule_version_id=(SELECT active_schedule_version_id FROM projects WHERE id=$1) AND ($2='' OR a.description ILIKE $2 OR a.external_activity_id ILIKE $2) ORDER BY a.external_activity_id LIMIT $3 OFFSET $4",
        [
          res.locals.projectId,
          req.query.search
            ? "%" + String(req.query.search).slice(0, 200) + "%"
            : "",
          p.limit,
          p.offset,
        ],
      )
    ).rows,
  );
});
activitiesRouter.get("/:activityId", async (req, res) => {
  const id = z.string().uuid().parse(req.params.activityId),
    project = res.locals.projectId;
  const a = (
    await pool.query(activityQuery + " WHERE a.id=$1 AND a.project_id=$2", [
      id,
      project,
    ])
  ).rows[0];
  if (!a) throw new ApiError(404, "NOT_FOUND", "Activity not found.");
  a.events = (
    await pool.query(
      "SELECT * FROM progress_events WHERE activity_id=$1 AND project_id=$2 ORDER BY committed_at DESC",
      [id, project],
    )
  ).rows;
  a.components = (
    await pool.query("SELECT * FROM activity_components WHERE activity_id=$1", [
      id,
    ])
  ).rows;
  res.json(a);
});
