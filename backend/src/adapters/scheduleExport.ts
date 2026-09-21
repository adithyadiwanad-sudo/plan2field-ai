export interface ScheduleAdapter {
  name: string;
  send(
    payload: unknown,
    idempotencyKey: string,
  ): Promise<{ acknowledgement: unknown }>;
}
export const connectorStatus = "External scheduling system not connected";
export function csvCell(value: unknown) {
  let s =
    typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
