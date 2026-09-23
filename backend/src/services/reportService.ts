import { transaction } from "../db/transactions.js";
import { hash } from "../middleware/auth.js";
import { ApiError } from "../middleware/errors.js";
import { store } from "../adapters/storage.js";
import type { ReportSubmission } from "../routes/reports.js";
import { randomUUID } from "node:crypto";
import { geofence, photoType } from "./evidenceService.js";
export async function submitReport(
  project: string,
  user: string,
  data: ReportSubmission,
  file?: Express.Multer.File,
  photos: Express.Multer.File[] = [],
) {
  const payloadHash = hash(
    JSON.stringify(data) +
      (file ? hash(file.buffer) : "") +
      photos.map((p) => hash(p.buffer)).join(""),
  );
  return transaction(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      project + user + data.idempotency_key,
    ]);
    const existing = (
      await c.query(
        "SELECT * FROM site_reports WHERE project_id=$1 AND submitted_by=$2 AND idempotency_key=$3",
        [project, user, data.idempotency_key],
      )
    ).rows[0];
    if (existing) {
      if (existing.request_payload_hash !== payloadHash)
        throw new ApiError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "This request key was already used with different content.",
        );
      return existing;
    }
    if (data.source_type !== "TEXT" && !file)
      throw new ApiError(400, "FILE_REQUIRED", "Select a file.");
    if (photos.length > 3)
      throw new ApiError(
        400,
        "TOO_MANY_PHOTOS",
        "Attach at most three photos.",
      );
    const photoTypes = photos.map(photoType);
    const site = (
      await c.query(
        "SELECT site_latitude,site_longitude,geofence_radius_m FROM projects WHERE id=$1",
        [project],
      )
    ).rows[0];
    const reportId = randomUUID(),
      evidence = [];
    for (let i = 0; i < photos.length; i++) {
      const id = await store(photos[i].buffer);
      evidence.push({
        id,
        url: `/projects/${project}/reports/${reportId}/evidence/${id}`,
        mime_type: photoTypes[i],
        sha256: hash(photos[i].buffer),
        uploaded_at: new Date().toISOString(),
        captured_at: data.captured_at,
      });
    }
    const ref = file ? await store(file.buffer) : null;
    const report = (
      await c.query(
        "INSERT INTO site_reports(project_id,submitted_by,source_type,original_text,storage_ref,content_hash,reporting_date,captured_at,idempotency_key,request_payload_hash,metadata,id,latitude,longitude,gps_accuracy_m,geofence_status,evidence_urls,delay_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *",
        [
          project,
          user,
          data.source_type,
          data.original_text,
          ref,
          file ? hash(file.buffer) : hash(data.original_text || ""),
          data.reporting_date,
          data.captured_at,
          data.idempotency_key,
          payloadHash,
          JSON.stringify({
            filename: file?.originalname,
            mapping: data.mapping,
            discipline: data.discipline,
            geofence_context: site,
          }),
          reportId,
          data.latitude ?? null,
          data.longitude ?? null,
          data.gps_accuracy_m ?? null,
          geofence(site, data.latitude, data.longitude, data.gps_accuracy_m),
          JSON.stringify(evidence),
          data.delay_reason || null,
        ],
      )
    ).rows[0];
    await c.query(
      "INSERT INTO jobs(type,payload,deduplication_key) VALUES($1,$2,$3)",
      [
        "REPORT",
        JSON.stringify({ report_id: report.id }),
        "report:" + report.id,
      ],
    );
    return report;
  });
}
