import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { pool } from "../db/pool.js";
import { ApiError } from "./errors.js";
import { isAllowedOrigin } from "../config.js";
export const hash = (v: string | Buffer) =>
  createHash("sha256").update(v).digest("hex");
export const auth: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.session;
  if (!token)
    throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  const { rows } = await pool.query(
    "SELECT u.id,u.email,u.name,s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
    [hash(token)],
  );
  if (!rows[0])
    throw new ApiError(
      401,
      "SESSION_EXPIRED",
      "Your session expired. Sign in again.",
    );
  res.locals.user = rows[0];
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    (req.get("X-CSRF-Token") !== rows[0].csrf_token ||
      !isAllowedOrigin(req.get("Origin")))
  )
    throw new ApiError(
      403,
      "CSRF_REJECTED",
      "Refresh your session before submitting.",
    );
  next();
};
