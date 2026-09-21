import { displayDate } from "../lib/dates";
export default function ProposalDiff({ activity, event, preview }) {
  if (!activity) return null;
  return (
    <div className="diff">
      <h3>Proposed update</h3>
      {preview && (
        <p>
          Validated result: {preview.accepted_quantity} {activity.quantity_unit}{" "}
          · {Number(preview.physical_percent_complete).toFixed(1)}% physical
          complete.{" "}
          {preview.actual_finish
            ? "Finished " + preview.actual_finish
            : "Actual finish remains unavailable."}
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Baseline</th>
            <th>Approved actual</th>
            <th>Proposed evidence</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Start</td>
            <td>{displayDate(activity.baseline_start)}</td>
            <td>{displayDate(activity.actual_start)}</td>
            <td>
              {event.event_type === "START"
                ? displayDate(event.event_date)
                : "No change"}
            </td>
          </tr>
          <tr>
            <td>Finish</td>
            <td>{displayDate(activity.baseline_finish)}</td>
            <td>{displayDate(activity.actual_finish)}</td>
            <td>
              {event.event_type === "FINISH"
                ? displayDate(event.event_date)
                : "No change"}
            </td>
          </tr>
          <tr>
            <td>Quantity</td>
            <td>
              {activity.planned_total_quantity} {activity.quantity_unit}
            </td>
            <td>{activity.accepted_quantity}</td>
            <td>
              {event.component_ids?.join(", ") ||
                event.quantity ||
                "No quantity change"}
              <small>{event.quantity_mode}</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
