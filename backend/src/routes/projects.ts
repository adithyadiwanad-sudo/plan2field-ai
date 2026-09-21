import { Router } from "express";
import { pool } from "../db/pool.js";
import { auth } from "../middleware/auth.js";
import { projectAccess } from "../middleware/projectAccess.js";
export const projectsRouter = Router();
projectsRouter.use(auth);
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
