import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { date } from "../schemas/event.js";
import { submitReport } from "../services/reportService.js";
import { pool } from "../db/pool.js";
import { read } from "../adapters/storage.js";
import { ApiError } from "../middleware/errors.js";
import { page } from "./activities.js";
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 4,
    fields: 25,
    fieldSize: 100000,
  },
});
export const reportSchema = z
  .object({
    source_type: z.enum(["TEXT", "VOICE", "SPREADSHEET", "SCAN"]),
    original_text: z.string().max(50000).default(""),
    reporting_date: date,
    captured_at: z.string().datetime(),
    idempotency_key: z.string().uuid(),
    discipline: z
      .enum([
        "CIVIL",
        "PIPING",
        "ELECTRICAL",
        "MECHANICAL",
        "INSTRUMENTATION",
        "HSSE",
      ])
      .optional(),
    mapping: z.string().max(2000).optional(),
    latitude: z.preprocess(
      (v) => (v == null || v === "" ? undefined : v),
      z.coerce.number().finite().min(-90).max(90).optional(),
    ),
    longitude: z.preprocess(
      (v) => (v == null || v === "" ? undefined : v),
      z.coerce.number().finite().min(-180).max(180).optional(),
    ),
    gps_accuracy_m: z.preprocess(
      (v) => (v == null || v === "" ? undefined : v),
      z.coerce.number().finite().min(0).max(999999).optional(),
    ),
    delay_reason: z
      .enum([
        "MATERIAL_SHORTAGE",
        "MANPOWER_SHORTAGE",
        "EQUIPMENT_FAILURE",
        "WEATHER_ACCESS",
        "DESIGN_REWORK",
        "OTHER",
      ])
      .optional(),
  })
  .refine(
    (d) => d.source_type !== "TEXT" || !!d.original_text.trim(),
    "Report text is required",
  )
  .refine((d) => (d.latitude == null) === (d.longitude == null), {
    message: "Latitude and longitude must be supplied together.",
    path: ["latitude"],
  });
export type ReportSubmission = z.infer<typeof reportSchema>;
export const reportsRouter = Router({ mergeParams: true });
reportsRouter.post(
  "/",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "photos", maxCount: 3 },
  ]),
  async (req, res) =>
    res
      .status(202)
      .json(
        await submitReport(
          res.locals.projectId,
          res.locals.user.id,
          reportSchema.parse(req.body),
          (req.files as Record<string, Express.Multer.File[]>)?.file?.[0],
          (req.files as Record<string, Express.Multer.File[]>)?.photos || [],
        ),
      ),
);
reportsRouter.get("/:reportId/evidence/:evidenceId", async (req, res) => {
  const reportId = z.string().uuid().parse(req.params.reportId),
    evidenceId = z.string().uuid().parse(req.params.evidenceId);
  const report = (
    await pool.query(
      "SELECT evidence_urls FROM site_reports WHERE id=$1 AND project_id=$2",
      [reportId, res.locals.projectId],
    )
  ).rows[0];
  const evidence = report?.evidence_urls.find((e: any) => e.id === evidenceId);
  if (!evidence)
    throw new ApiError(404, "NOT_FOUND", "Evidence photo not found.");
  res.setHeader("Cache-Control", "private, no-store");
  res.type(evidence.mime_type).send(await read(evidence.id));
});
reportsRouter.get("/", async (req, res) => {
  const p = page(req.query);
  res.json(
    (
      await pool.query(
        "SELECT * FROM site_reports WHERE project_id=$1 ORDER BY received_at DESC LIMIT $2 OFFSET $3",
        [res.locals.projectId, p.limit, p.offset],
      )
    ).rows,
  );
});
reportsRouter.get("/:reportId", async (req, res) => {
  const id = z.string().uuid().parse(req.params.reportId);
  const r = (
    await pool.query(
      "SELECT * FROM site_reports WHERE id=$1 AND project_id=$2",
      [id, res.locals.projectId],
    )
  ).rows[0];
  if (!r) throw new ApiError(404, "NOT_FOUND", "Report not found.");
  r.events = (
    await pool.query("SELECT * FROM report_events WHERE site_report_id=$1", [
      id,
    ])
  ).rows;
  res.json(r);
});
reportsRouter.get("/:reportId/audio", async (req, res) => {
  const r = (
    await pool.query(
      "SELECT storage_ref FROM site_reports WHERE id=$1 AND project_id=$2 AND source_type='VOICE'",
      [z.string().uuid().parse(req.params.reportId), res.locals.projectId],
    )
  ).rows[0];
  if (!r?.storage_ref) throw new ApiError(404, "NOT_FOUND", "Audio not found.");
  res.setHeader("Cache-Control", "no-store");
  res.type("application/octet-stream").send(await read(r.storage_ref));
});
reportsRouter.post("/:reportId/clarifications", async (req, res) => {
  const original = (
    await pool.query(
      "SELECT id FROM site_reports WHERE id=$1 AND project_id=$2",
      [z.string().uuid().parse(req.params.reportId), res.locals.projectId],
    )
  ).rows[0];
  if (!original) throw new ApiError(404, "NOT_FOUND", "Report not found.");
  res.status(202).json(
    await submitReport(
      res.locals.projectId,
      res.locals.user.id,
      reportSchema.parse({
        ...req.body,
        source_type: "TEXT",
        original_text: `Clarification of report ${original.id}: ${req.body.original_text}`,
      }),
    ),
  );
});
