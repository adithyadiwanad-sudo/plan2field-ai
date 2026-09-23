import { transaction } from "../db/transactions.js";
import { normalizeMeasurement } from "./progressService.js";
import { eventSchema } from "../schemas/event.js";
import { revalidate } from "./proposalService.js";
import { lockActivity } from "../repositories/activityRepository.js";
import { audit } from "./auditService.js";
import { ApiError } from "../middleware/errors.js";
export async function approve(
  project: string,
  id: string,
  version: number,
  actor: string,
  requestId: string,
) {
  return transaction(async (c) => {
    // Project lock serializes activation and approvals; consistent project -> proposal -> activity order.
    const pr = (
      await c.query("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [project])
    ).rows[0];
    const p = (
      await c.query(
        "SELECT * FROM staged_proposals WHERE id=$1 AND project_id=$2 FOR UPDATE",
        [id, project],
      )
    ).rows[0];
    if (!p) throw new ApiError(404, "NOT_FOUND", "Proposal not found.");
    if (p.lifecycle_status === "APPROVED")
      return (
        await c.query("SELECT * FROM progress_events WHERE proposal_id=$1", [
          id,
        ])
      ).rows[0];
    if (pr.status === "CLOSED")
      throw new ApiError(
        409,
        "PROJECT_CLOSED",
        "This project has approved closeout records. Managed reopening is required before changing actuals.",
      );
    if (
      p.lifecycle_status !== "PENDING" ||
      p.proposal_version !== version ||
      p.schedule_version_id !== pr.active_schedule_version_id
    )
      throw new ApiError(
        409,
        "STALE_PROPOSAL",
        "The proposal or schedule changed. Refresh and revalidate.",
      );
    const a = await lockActivity(
      c,
      p.selected_activity_id,
      project,
      p.schedule_version_id,
    );
    if (!a || a.row_version !== p.expected_activity_row_version)
      throw new ApiError(
        409,
        "STALE_PROPOSAL",
        "Activity actuals changed. Refresh and revalidate the proposal.",
      );
    const e = normalizeMeasurement(eventSchema.parse(p.proposed_changes), a);
    const last = (
      await c.query(
        "SELECT * FROM progress_events WHERE activity_id=$1 ORDER BY effective_date DESC,committed_at DESC LIMIT 1",
        [a.id],
      )
    ).rows[0];
    if (e.event_type === "CORRECTION") {
      const old = (
        await c.query(
          "SELECT * FROM progress_events WHERE id=$1 AND activity_id=$2 AND project_id=$3",
          [e.correction_of_event_id, a.id, project],
        )
      ).rows[0];
      if (!old || !e.reconciliation_reason?.trim())
        throw new ApiError(
          422,
          "CORRECTION_REQUIRED",
          "A correction must reference this activity’s accepted event and explain the reconciliation.",
        );
    }
    if (
      e.quantity_mode &&
      e.quantity_mode !== "COMPONENT_SET" &&
      last &&
      !e.reconciliation_reason?.trim() &&
      (e.quantity_mode === "INCREMENTAL" ||
        e.event_date! <= last.effective_date)
    )
      throw new ApiError(
        422,
        "OVERLAP_REVIEW",
        "Aggregate observations require a reviewer reconciliation reason for overlap or out-of-order evidence.",
      );
    const { after } = await revalidate(c, a, e, pr.reporting_date);
    const accepted = (
      await c.query(
        "INSERT INTO progress_events(proposal_id,activity_id,project_id,schedule_version_id,event_type,effective_date,quantity_mode,quantity,unit,component_ids,before_state,after_state,correction_of_event_id,approved_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *",
        [
          id,
          a.id,
          project,
          a.schedule_version_id,
          e.event_type,
          e.event_date,
          e.quantity_mode,
          e.quantity,
          e.unit,
          JSON.stringify(e.component_ids),
          JSON.stringify(a),
          JSON.stringify(after),
          e.correction_of_event_id || null,
          actor,
        ],
      )
    ).rows[0];
    if (e.event_type === "CORRECTION")
      await c.query("DELETE FROM component_completions WHERE activity_id=$1", [
        a.id,
      ]);
    for (const component of after.component_ids)
      await c.query(
        "INSERT INTO component_completions(activity_id,external_id,progress_event_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [a.id, component, accepted.id],
      );
    await c.query(
      "UPDATE schedule_activities SET actual_start=$2,actual_finish=$3,accepted_quantity=$4,physical_percent_complete=$5,row_version=row_version+1,updated_at=now() WHERE id=$1",
      [
        a.id,
        after.actual_start,
        after.actual_finish,
        after.accepted_quantity,
        after.physical_percent_complete,
      ],
    );
    const approvedProposal = (
      await c.query(
        "UPDATE staged_proposals SET lifecycle_status='APPROVED',reviewed_by=$2,reviewed_at=now(),proposal_version=proposal_version+1 WHERE id=$1 RETURNING *",
        [id, actor],
      )
    ).rows[0];
    await c.query(
      "INSERT INTO proposal_revisions(proposal_id,version,snapshot,actor_id) VALUES($1,$2,$3,$4)",
      [id, p.proposal_version, JSON.stringify(p), actor],
    );
    await audit(c, project, actor, "APPROVED", id, requestId, a, after);
    await c.query(
      "UPDATE site_reports r SET processing_status=CASE WHEN EXISTS(SELECT 1 FROM report_events e JOIN staged_proposals p ON p.report_event_id=e.id WHERE e.site_report_id=r.id AND p.lifecycle_status IN ('PENDING','CLARIFICATION_REQUESTED','STALE')) THEN 'NEEDS_REVIEW' ELSE 'ACCEPTED' END WHERE r.id=(SELECT site_report_id FROM report_events WHERE id=$1)",
      [p.report_event_id],
    );
    await c.query(
      "INSERT INTO export_outbox(progress_event_id,payload,idempotency_key) VALUES($1,$2,$3)",
      [
        accepted.id,
        JSON.stringify({
          label: "Update proposal export",
          external_activity_id: a.external_activity_id,
          schedule_version: a.schedule_version_id,
          old: a,
          new: after,
          source_event: accepted.id,
          approval: { actor, at: accepted.committed_at },
          idempotency_reference: accepted.id,
          approval_status: "APPROVED",
          evidence: {
            latitude: approvedProposal.latitude,
            longitude: approvedProposal.longitude,
            geofence_status: approvedProposal.geofence_status,
            evidence_urls: approvedProposal.evidence_urls,
          },
          delay_reason: approvedProposal.delay_reason,
          affected_successor_ids: approvedProposal.affected_successor_ids,
        }),
        accepted.id,
      ],
    );
    return accepted;
  });
}
