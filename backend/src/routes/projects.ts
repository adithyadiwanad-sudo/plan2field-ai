import { Router } from "express";
import { pool } from "../db/pool.js";
import { auth } from "../middleware/auth.js";
import { projectAccess } from "../middleware/projectAccess.js";
import { reviewer } from "../middleware/projectAccess.js";
import { z } from "zod";
import { transaction } from "../db/transactions.js";
export const projectsRouter = Router();
projectsRouter.use(auth);
projectsRouter.patch(
  "/:projectId/geofence",
  projectAccess,
  async (req, res) => {
    reviewer(res);
    const d = z
      .object({
        latitude: z.number().finite().min(-90).max(90),
        longitude: z.number().finite().min(-180).max(180),
        radius_m: z.number().finite().positive().max(100000),
      })
      .strict()
      .parse(req.body);
    res.json(
      await transaction(async (c) => {
        const before = (
          await c.query(
            "SELECT site_latitude,site_longitude,geofence_radius_m FROM projects WHERE id=$1 FOR UPDATE",
            [res.locals.projectId],
          )
        ).rows[0];
        const after = (
          await c.query(
            "UPDATE projects SET site_latitude=$2,site_longitude=$3,geofence_radius_m=$4 WHERE id=$1 RETURNING site_latitude,site_longitude,geofence_radius_m",
            [res.locals.projectId, d.latitude, d.longitude, d.radius_m],
          )
        ).rows[0];
        await c.query(
          "INSERT INTO audit_events(project_id,actor_id,action,entity_type,entity_id,request_id,before_json,after_json) VALUES($1,$2,'GEOFENCE_CONFIGURED','project',$1,$3,$4,$5)",
          [
            res.locals.projectId,
            res.locals.user.id,
            res.locals.requestId,
            JSON.stringify(before),
            JSON.stringify(after),
          ],
        );
        return after;
      }),
    );
  },
);
projectsRouter.get("/", async (_req, res) =>
  res.json(
    (
      await pool.query(
        "SELECT p.*,m.role FROM projects p JOIN project_memberships m ON m.project_id=p.id WHERE m.user_id=$1 ORDER BY p.code",
        [res.locals.user.id],
      )
    ).rows,
  ),
);
projectsRouter.get("/:projectId", projectAccess, async (_req, res) =>
  res.json(
    (
      await pool.query("SELECT * FROM projects WHERE id=$1", [
        res.locals.projectId,
      ])
    ).rows[0],
  ),
);
