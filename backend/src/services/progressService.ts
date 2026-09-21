import { Decimal } from "decimal.js";
import type { Event } from "../schemas/event.js";
import { ApiError } from "../middleware/errors.js";
const fail = (message: string): never => {
  throw new ApiError(422, "INVALID_PROGRESS", message);
};
export function validateSelection(e: Event, a: any) {
  if (!e.action) fail("Confirm the operation before approval.");
  if (a.line_number && !e.line_number)
    fail("Confirm the full line identifier before approval.");
  if (
    e.line_number &&
    e.line_number.toUpperCase() !== a.line_number?.toUpperCase()
  )
    fail("Line identifier conflicts with the selected activity.");
  if (e.asset_tag && e.asset_tag.toUpperCase() !== a.asset_tag?.toUpperCase())
    fail("Asset tag conflicts with the selected activity.");
  for (const [k, v] of [
    ["action", a.activity_type],
    ["discipline", a.discipline],
    ["area", a.area],
  ] as const) {
    if (e[k] && e[k]!.toUpperCase() !== v?.toUpperCase())
      fail(`${k} conflicts with selected activity.`);
  }
  if (
    e.negated ||
    e.future_intent ||
    ["PLAN", "UNKNOWN", "BLOCKER"].includes(e.event_type)
  )
    fail("This event does not establish actual progress.");
  if (!e.event_date) fail("An explicit event date is required.");
}
export function calculateProgress(
  a: any,
  e: Event,
  components: any[],
  completed: string[],
) {
  validateSelection(e, a);
  let quantity = new Decimal(a.accepted_quantity),
    percent = new Decimal(a.physical_percent_complete);
  let ids = [...new Set(completed)];
  let start = a.actual_start,
    finish = a.actual_finish;
  if (e.event_type === "START") {
    if (start && start !== e.event_date)
      fail("Start already exists; submit an explicit correction.");
    start = e.event_date;
  }
  if (["PROGRESS", "FINISH", "CORRECTION"].includes(e.event_type)) {
    if (e.event_type === "CORRECTION" && !e.correction_of_event_id)
      fail("Select the accepted event being corrected.");
    if (e.unit && e.unit !== a.quantity_unit)
      fail("Quantity unit does not match.");
    if (e.quantity_mode === "COMPONENT_SET") {
      if (!components.length) fail("No approved component definitions exist.");
      if (
        e.event_type !== "CORRECTION" &&
        new Decimal(a.accepted_quantity).gt(completed.length)
      )
        fail(
          "Prior aggregate progress has no component attribution. Reconcile with an explicit correction first.",
        );
      const known = new Set(components.map((c) => c.external_id));
      if (
        !e.component_ids.length ||
        e.component_ids.some((id) => !known.has(id))
      )
        fail("Unknown or missing components.");
      ids =
        e.event_type === "CORRECTION"
          ? [...new Set(e.component_ids)]
          : [...new Set([...ids, ...e.component_ids])];
      quantity = new Decimal(ids.length);
      const total = components.reduce(
        (s, c) => s.plus(c.weight),
        new Decimal(0),
      );
      percent = components
        .filter((c) => ids.includes(c.external_id))
        .reduce((s, c) => s.plus(c.weight), new Decimal(0))
        .div(total)
        .mul(100);
    } else if (e.quantity_mode) {
      if (a.measurement_method === "WEIGHTED_COMPONENTS")
        fail("Weighted progress requires component identities.");
      if (e.quantity === null || !e.unit)
        fail("Quantity and unit are required.");
      if (completed.length && e.event_type !== "CORRECTION")
        fail(
          "This activity already has component evidence. Supply component IDs or explicitly reconcile a correction.",
        );
      if (e.event_type === "CORRECTION") ids = [];
      quantity =
        e.quantity_mode === "INCREMENTAL"
          ? quantity.plus(e.quantity!)
          : new Decimal(e.quantity!);
      if (quantity.lt(a.accepted_quantity) && e.event_type !== "CORRECTION")
        fail("A lower cumulative count needs an explicit correction.");
      percent = quantity.div(a.planned_total_quantity).mul(100);
    } else if (e.event_type !== "FINISH") fail("Quantity mode is required.");
  }
  if (quantity.gt(a.planned_total_quantity) || quantity.lt(0))
    fail("Quantity is outside the approved scope.");
  if (e.event_type === "CORRECTION" && finish && !percent.eq(100))
    fail(
      "A finished activity cannot be partially reopened by a quantity correction. Managed reopening is outside this prototype.",
    );
  if (e.event_type === "FINISH") {
    if (!percent.eq(100))
      fail("Finish requires all approved scope to be complete.");
    if (!start) fail("An approved actual start is required before finish.");
    finish = e.event_date;
  }
  if (finish && start && finish < start) fail("Finish precedes start.");
  return {
    actual_start: start,
    actual_finish: finish,
    accepted_quantity: quantity.toString(),
    physical_percent_complete: percent.toString(),
    component_ids: ids,
  };
}
