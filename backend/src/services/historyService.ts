import { transaction } from "../db/transactions.js";
import { ApiError } from "../middleware/errors.js";
export async function closeout(
  project: string,
  actor: string,
  reason: string,
  requestId: string,
) {
  return transaction(async (c) => {
    const p = (
      await c.query("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [project])
    ).rows[0];
    if (p.status === "CLOSED") return { status: "CLOSED" };
    const incomplete = (
      await c.query(
        "SELECT count(*)::int AS n FROM schedule_activities a LEFT JOIN activity_baselines b ON b.activity_id=a.id WHERE a.project_id=$1 AND a.schedule_version_id=$2 AND (a.actual_finish IS NULL OR a.actual_start IS NULL OR b.baseline_start IS NULL OR b.baseline_finish IS NULL)",
        [project, p.active_schedule_version_id],
      )
    ).rows[0];
    if (incomplete.n || !p.active_schedule_version_id)
      throw new ApiError(
        422,
        "INCOMPLETE_CLOSEOUT",
        "All active activities need accepted start/finish dates and approved baseline dates.",
      );
    await c.query(
      "INSERT INTO historical_activity_records(project_id,activity_id,work_type,discipline,quantity,unit,context,baseline_duration,actual_duration,duration_basis,date_evidence,deviation_reason,provenance,approved_by,approved_at,closeout_version) SELECT a.project_id,a.id,a.activity_type,COALESCE(a.discipline,'UNKNOWN'),a.accepted_quantity,a.quantity_unit,jsonb_build_object('area',a.area),b.baseline_finish-b.baseline_start,a.actual_finish-a.actual_start,'CALENDAR_DAYS',jsonb_build_object('baseline_start',b.baseline_start,'baseline_finish',b.baseline_finish,'actual_start',a.actual_start,'actual_finish',a.actual_finish),$3,$4,$5,now(),1 FROM schedule_activities a JOIN activity_baselines b ON b.activity_id=a.id WHERE a.project_id=$1 AND a.schedule_version_id=$2 AND b.baseline_start IS NOT NULL AND b.baseline_finish IS NOT NULL ON CONFLICT DO NOTHING",
      [
        project,
        p.active_schedule_version_id,
        reason,
        p.provenance === "SYNTHETIC" ? "SYNTHETIC" : "VERIFIED",
        actor,
      ],
    );
    await c.query("UPDATE projects SET status='CLOSED' WHERE id=$1", [project]);
    await c.query(
      "INSERT INTO audit_events(project_id,actor_id,action,entity_type,entity_id,request_id,after_json) VALUES($1,$2,'APPROVED_CLOSEOUT','project',$1,$4,$3)",
      [
        project,
        actor,
        JSON.stringify({ reason, closeout_version: 1 }),
        requestId,
      ],
    );
    return { status: "CLOSED" };
  });
}
