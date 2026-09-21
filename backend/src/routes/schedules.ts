import { Router } from "express";
import { z } from "zod";
import { upload } from "./reports.js";
import { store } from "../adapters/storage.js";
import { hash } from "../middleware/auth.js";
import { reviewer } from "../middleware/projectAccess.js";
import { transaction } from "../db/transactions.js";
import { pool } from "../db/pool.js";
import { ApiError } from "../middleware/errors.js";
export const schedulesRouter = Router({ mergeParams: true });
schedulesRouter.post("/", upload.single("file"), async (req, res) => {
  reviewer(res);
  if (!req.file)
    throw new ApiError(400, "FILE_REQUIRED", "Select a schedule file.");
  const format = z.enum(["CSV", "XER", "XML"]).parse(req.body.format);
  const confirmed = req.body.baseline_confirmed === "true";
  const ref = await store(req.file.buffer);
  res.status(202).json(
    await transaction(async (c) => {
      const project = (
        await c.query("SELECT id,status FROM projects WHERE id=$1 FOR UPDATE", [
          res.locals.projectId,
        ])
      ).rows[0];
      if (project.status === "CLOSED")
        throw new ApiError(
          409,
          "PROJECT_CLOSED",
          "Managed reopening is required before activating a schedule in a closed project.",
        );
      const v = (
        await c.query(
          "INSERT INTO schedule_versions(project_id,version_number,source_format,source_filename,source_hash,imported_by) SELECT $1,COALESCE(MAX(version_number),0)+1,$2,$3,$4,$5 FROM schedule_versions WHERE project_id=$1 RETURNING *",
          [
            res.locals.projectId,
            format,
            req.file!.originalname,
            hash(req.file!.buffer),
            res.locals.user.id,
          ],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO jobs(type,payload,deduplication_key) VALUES($1,$2,$3)",
        [
          "IMPORT",
          JSON.stringify({
            version_id: v.id,
            storage_ref: ref,
            baseline_confirmed: confirmed,
            min_wbs_depth: z.coerce
              .number()
              .int()
              .min(0)
              .max(20)
              .default(0)
              .parse(req.body.min_wbs_depth),
          }),
          "import:" + v.id,
        ],
      );
      return v;
    }),
  );
});
schedulesRouter.get("/:importId", async (req, res) => {
  const v = (
    await pool.query(
      "SELECT * FROM schedule_versions WHERE id=$1 AND project_id=$2",
      [z.string().uuid().parse(req.params.importId), res.locals.projectId],
    )
  ).rows[0];
  if (!v) throw new ApiError(404, "NOT_FOUND", "Schedule import not found.");
  res.json(v);
});
schedulesRouter.post("/:importId/activate", async (req, res) => {
  reviewer(res);
  res.json(
    await transaction(async (c) => {
      const currentProject = (
        await c.query("SELECT id,status FROM projects WHERE id=$1 FOR UPDATE", [
          res.locals.projectId,
        ])
      ).rows[0];
      if (currentProject.status === "CLOSED")
        throw new ApiError(
          409,
          "PROJECT_CLOSED",
          "Managed reopening is required before activating a new schedule.",
        );
      const v = (
        await c.query(
          "SELECT * FROM schedule_versions WHERE id=$1 AND project_id=$2 AND import_status='VALIDATED'",
          [z.string().uuid().parse(req.params.importId), res.locals.projectId],
        )
      ).rows[0];
      if (!v)
        throw new ApiError(
          422,
          "IMPORT_NOT_READY",
          "A fully validated and embedded schedule is required.",
        );
      await c.query(
        "UPDATE projects SET active_schedule_version_id=$2 WHERE id=$1",
        [res.locals.projectId, v.id],
      );
      await c.query(
        "UPDATE staged_proposals SET lifecycle_status='STALE' WHERE project_id=$1 AND schedule_version_id<>$2 AND lifecycle_status='PENDING'",
        [res.locals.projectId, v.id],
      );
      return v;
    }),
  );
});
