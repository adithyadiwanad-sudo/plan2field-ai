import type { RequestHandler } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { ApiError } from "./errors.js";
export const projectAccess: RequestHandler = async (req, res, next) => {
  const id = z.string().uuid().parse(req.params.projectId);
  const { rows } = await pool.query(
    "SELECT role FROM project_memberships WHERE project_id=$1 AND user_id=$2",
    [id, res.locals.user.id],
  );
  if (!rows[0])
    throw new ApiError(
      403,
      "FORBIDDEN",
      "You do not have access to this project.",
    );
  res.locals.projectId = id;
  res.locals.role = rows[0].role;
  res.locals.user.role = rows[0].role;
  next();
};
export function reviewer(res: any) {
  if (!["REVIEWER", "ADMIN"].includes(res.locals.role))
    throw new ApiError(
      403,
      "REVIEWER_REQUIRED",
      "A project reviewer must perform this action.",
    );
}
