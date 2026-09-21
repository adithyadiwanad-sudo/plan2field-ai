import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { auth } from "../middleware/auth.js";
import { page } from "./activities.js";
export const historyRouter = Router();
historyRouter.use(auth);
historyRouter.get("/comparables", async (req, res) => {
  const p = page(req.query);
  const d = z
    .object({
      discipline: z.string().max(50).optional(),
      work_type: z.string().max(50).optional(),
      unit: z.string().max(30).optional(),
      quantity: z.coerce.number().positive().optional(),
      area: z.string().max(50).optional(),
      demo: z.enum(["true", "false"]).optional(),
    })
    .parse(req.query);
  const records = (
    await pool.query(
      "SELECT h.*,p.name AS project_name FROM historical_activity_records h JOIN projects p ON p.id=h.project_id JOIN project_memberships m ON m.project_id=p.id WHERE m.user_id=$1 AND (h.provenance='VERIFIED' OR ($2 AND h.provenance='SYNTHETIC')) AND ($3::text IS NULL OR h.discipline=$3) AND ($4::text IS NULL OR h.work_type=$4) AND ($5::text IS NULL OR h.unit=$5) AND ($8::numeric IS NULL OR h.quantity BETWEEN $8*0.75 AND $8*1.25) AND ($9::text IS NULL OR h.context->>'area'=$9) ORDER BY h.id LIMIT $6 OFFSET $7",
      [
        res.locals.user.id,
        d.demo === "true",
        d.discipline || null,
        d.work_type || null,
        d.unit || null,
        p.limit,
        p.offset,
        d.quantity || null,
        d.area || null,
      ],
    )
  ).rows;
  const groups = new Map<string, number[]>();
  for (const r of records) {
    const key = [
      r.discipline,
      r.work_type,
      r.unit,
      r.duration_basis,
      r.calendar_reference || "none",
      r.provenance,
    ].join(" / ");
    groups.set(key, [...(groups.get(key) || []), r.actual_duration]);
  }
  const summaries = [...groups.entries()].map(([basis, values]) => {
    values.sort((a, b) => a - b);
    const n = values.length;
    return {
      basis,
      count: n,
      median:
        n >= 3
          ? (values[Math.floor((n - 1) / 2)] + values[Math.ceil((n - 1) / 2)]) /
            2
          : null,
      min: values[0],
      max: values[n - 1],
    };
  });
  const causes = new Map<string, number>();
  for (const r of records) {
    if (r.actual_duration > r.baseline_duration && r.deviation_reason?.trim()) {
      const key = [
        r.discipline,
        r.provenance,
        r.deviation_reason.trim().toLowerCase(),
      ].join(" / ");
      causes.set(key, (causes.get(key) || 0) + 1);
    }
  }
  res.json({
    delay_causes: [...causes.entries()]
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count),
    summary_scope:
      "Current filtered page; calendar-day durations, not a forecast",
    records,
    summaries,
    message: records.length
      ? "Comparables; assess scope and context before use."
      : "Insufficient verified history",
    count: records.length,
  });
});
