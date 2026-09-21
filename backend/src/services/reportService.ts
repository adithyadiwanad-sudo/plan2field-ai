import { transaction } from "../db/transactions.js";
import { hash } from "../middleware/auth.js";
import { ApiError } from "../middleware/errors.js";
import { store } from "../adapters/storage.js";
export async function submitReport(
  project: string,
  user: string,
  data: any,
  file?: Express.Multer.File,
) {
  const payloadHash = hash(
    JSON.stringify(data) + (file ? hash(file.buffer) : ""),
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
    const ref = file ? await store(file.buffer) : null;
    const report = (
      await c.query(
        "INSERT INTO site_reports(project_id,submitted_by,source_type,original_text,storage_ref,content_hash,reporting_date,captured_at,idempotency_key,request_payload_hash,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
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
          }),
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
