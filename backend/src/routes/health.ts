import { Router } from "express";
import { pool } from "../db/pool.js";
export const healthRouter = Router();
healthRouter.get("/live", (_req, res) => res.json({ live: true }));
healthRouter.get("/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    const w = (
      await pool.query(
        "SELECT models_ready,heartbeat_at FROM worker_health WHERE heartbeat_at>now()-interval '90 seconds' ORDER BY heartbeat_at DESC LIMIT 1",
      )
    ).rows[0];
    res
      .status(w?.models_ready ? 200 : 503)
      .json({ database: true, models: !!w?.models_ready, worker: !!w });
  } catch {
    res.status(503).json({ database: false, models: false, worker: false });
  }
});
