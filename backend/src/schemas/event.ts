import { z } from "zod";
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Invalid calendar date",
  );
export const eventSchema = z
  .object({
    event_type: z.enum([
      "START",
      "FINISH",
      "PROGRESS",
      "BLOCKER",
      "PLAN",
      "CORRECTION",
      "UNKNOWN",
    ]),
    event_date: date.nullable(),
    date_basis: z.string().default("EXPLICIT"),
    action: z.string().nullable(),
    line_number: z.string().nullable(),
    asset_tag: z.string().nullable().default(null),
    area: z.string().nullable(),
    discipline: z.string().nullable(),
    quantity: z.number().nonnegative().nullable(),
    unit: z.string().nullable(),
    quantity_mode: z
      .enum(["COMPONENT_SET", "CUMULATIVE", "INCREMENTAL"])
      .nullable(),
    component_ids: z.array(z.string()).max(1000).default([]),
    negated: z.boolean().default(false),
    future_intent: z.boolean().default(false),
    evidence: z.any().optional(),
    missing_fields: z.array(z.string()).default([]),
    blockers: z.array(z.string()).default([]),
    correction_of_event_id: z.string().uuid().nullable().optional(),
    reconciliation_reason: z.string().max(2000).optional(),
  })
  .strict();
export type Event = z.infer<typeof eventSchema>;
