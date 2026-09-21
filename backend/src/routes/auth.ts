import { Router } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { auth, hash } from "../middleware/auth.js";
import { ApiError } from "../middleware/errors.js";
import { config } from "../config.js";
import {throttled} from '../middleware/requestId.js';
export const authRouter = Router();
authRouter.post(
  "/login",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, handler:throttled }),
  async (req, res) => {
    if (req.get("Origin") !== config.origin)
      throw new ApiError(403, "ORIGIN_REJECTED", "Invalid request origin.");
    const d = z
      .object({
        email: z.string().email(),
        password: z.string().min(1).max(256),
      })
      .parse(req.body);
    const u = (
      await pool.query("SELECT * FROM users WHERE email=$1", [
        d.email.toLowerCase(),
      ])
    ).rows[0];
    const [salt, key] = (u?.password_hash || "dummy:" + "00".repeat(64)).split(
      ":",
    );
    const actual = scryptSync(d.password, salt, 64);
    if (!u || !timingSafeEqual(actual, Buffer.from(key, "hex")))
      throw new ApiError(
        401,
        "INVALID_LOGIN",
        "Email or password is incorrect.",
      );
    const token = randomBytes(32).toString("hex"),
      csrf = randomBytes(24).toString("hex");
    await pool.query(
      "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+interval '12 hours')",
      [hash(token), u.id, csrf],
    );
    res
      .cookie("session", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: config.secure,
        maxAge: 43200000,
        path: "/",
      })
      .json({ id: u.id, email: u.email, name: u.name, csrf_token: csrf });
  },
);
authRouter.get("/me", auth, (_req, res) => res.json(res.locals.user));
authRouter.post("/logout", auth, async (req, res) => {
  await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
    hash(req.cookies.session),
  ]);
  res.clearCookie("session", { path: "/" }).status(204).end();
});
