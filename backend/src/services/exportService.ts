import { csvCell, connectorStatus } from "../adapters/scheduleExport.js";
export async function exportsForProject(
  db: any,
  projectId: string,
  format?: string,
) {
  const rows = (
    await db.query(
      `SELECT e.*,a.external_activity_id,a.wbs_path,a.discipline,
    pr.code AS project_code,p.match_score,p.model_version,r.submitted_by,r.reporter_role,r.received_at,
    o.status AS delivery_status
    FROM progress_events e JOIN schedule_activities a ON a.id=e.activity_id
    JOIN projects pr ON pr.id=e.project_id JOIN staged_proposals p ON p.id=e.proposal_id
    JOIN report_events re ON re.id=p.report_event_id JOIN site_reports r ON r.id=re.site_report_id
    JOIN export_outbox o ON o.progress_event_id=e.id WHERE e.project_id=$1 ORDER BY e.committed_at,e.id`,
      [projectId],
    )
  ).rows;
  const records = rows.map((r: any) => ({
    schema_version: "plan2field-enterprise-v1",
    ProjectId: r.project_code,
    ActivityId: r.external_activity_id,
    WBS: r.wbs_path,
    Discipline: r.discipline,
    ActualStartDate: r.after_state.actual_start,
    ActualFinishDate: r.after_state.actual_finish,
    PhysicalPercentComplete: r.after_state.physical_percent_complete,
    ActualQuantity: r.after_state.accepted_quantity,
    ScheduleVersion: r.schedule_version_id,
    SourceEventId: r.id,
    IdempotencyKey: r.id,
    ApprovedBy: r.approved_by,
    ApprovedAt: r.committed_at,
    ReporterId: r.submitted_by,
    ReporterRole: r.reporter_role,
    SubmittedAt: r.received_at,
    AIMatchScore: r.match_score,
    ScoreBasis: "UNCALIBRATED_CROSS_ENCODER",
    Model: r.model_version,
    DeliveryStatus: r.delivery_status,
  }));
  const columns = [
    "schema_version",
    "ProjectId",
    "ActivityId",
    "WBS",
    "Discipline",
    "ActualStartDate",
    "ActualFinishDate",
    "PhysicalPercentComplete",
    "ActualQuantity",
    "ScheduleVersion",
    "SourceEventId",
    "IdempotencyKey",
    "ApprovedBy",
    "ApprovedAt",
    "ReporterId",
    "ReporterRole",
    "SubmittedAt",
    "AIMatchScore",
    "ScoreBasis",
    "Model",
    "DeliveryStatus",
  ];
  if (format === "csv")
    return [
      columns.join(","),
      ...records.map((r: any) => columns.map((k) => csvCell(r[k])).join(",")),
    ].join("\r\n");
  return {
    label: "Enterprise Export",
    schema_version: "plan2field-enterprise-v1",
    connector_status: connectorStatus,
    target_mapping: {
      primavera_p6:
        "ProjectId / ActivityId; actual dates and physical percent fields",
      sap_ps:
        "Map WBS / ActivityId to the target WBS element / network activity before import",
    },
    import_note:
      "Approved event snapshots in commit order. Middleware mapping required; not a native XER or SAP IDoc. No external acknowledgement is implied.",
    records,
  };
}
