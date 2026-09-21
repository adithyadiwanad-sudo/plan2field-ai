import { eventSchema } from "../schemas/event.js";
import { calculateProgress, normalizeMeasurement } from "./progressService.js";
import { ApiError } from "../middleware/errors.js";
export async function revalidate(
  c: any,
  activity: any,
  changes: any,
  reportingDate: string,
) {
  const event = normalizeMeasurement(eventSchema.parse(changes), activity);
  if (event.event_date && event.event_date > reportingDate)
    throw new ApiError(
      422,
      "FUTURE_ACTUAL",
      "Actual evidence cannot be later than the project reporting date.",
    );
  if (event.event_type === "CORRECTION") {
    const old = (
      await c.query(
        "SELECT id FROM progress_events WHERE id=$1 AND activity_id=$2 AND project_id=$3",
        [event.correction_of_event_id, activity.id, activity.project_id],
      )
    ).rows[0];
    if (!old || !event.reconciliation_reason?.trim())
      throw new ApiError(
        422,
        "CORRECTION_REQUIRED",
        "Select this activity’s accepted event and explain the correction.",
      );
  }
  if (event.quantity_mode && event.quantity_mode !== "COMPONENT_SET") {
    const last = (
      await c.query(
        "SELECT effective_date FROM progress_events WHERE activity_id=$1 AND quantity_mode IS NOT NULL ORDER BY effective_date DESC LIMIT 1",
        [activity.id],
      )
    ).rows[0];
    if (
      last &&
      !event.reconciliation_reason?.trim() &&
      (event.quantity_mode === "INCREMENTAL" ||
        event.event_date! <= last.effective_date)
    )
      throw new ApiError(
        422,
        "OVERLAP_REVIEW",
        "Explain reconciliation for incremental or out-of-order aggregate evidence.",
      );
  }
  const components = (
    await c.query("SELECT * FROM activity_components WHERE activity_id=$1", [
      activity.id,
    ])
  ).rows;
  const completed = (
    await c.query(
      "SELECT external_id FROM component_completions WHERE activity_id=$1",
      [activity.id],
    )
  ).rows.map((r: any) => r.external_id);
  return {
    event,
    after: calculateProgress(activity, event, components, completed),
  };
}
