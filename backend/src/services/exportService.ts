import { csvCell, connectorStatus } from "../adapters/scheduleExport.js";
export async function exportsForProject(
  db: any,
  projectId: string,
  format?: string,
) {
  const records = (
    await db.query(
      "SELECT o.* FROM export_outbox o JOIN progress_events e ON e.id=o.progress_event_id WHERE e.project_id=$1 ORDER BY e.committed_at DESC LIMIT 200",
      [projectId],
    )
  ).rows;
  if (format === "csv")
    return [
      "id,status,payload",
      ...records.map((r: any) =>
        [r.id, r.status, r.payload].map(csvCell).join(","),
      ),
    ].join("\r\n");
  return {
    label: "Update proposal export",
    connector_status: connectorStatus,
    records,
  };
}
