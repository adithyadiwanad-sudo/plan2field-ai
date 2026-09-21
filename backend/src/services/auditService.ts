export async function audit(
  c: any,
  project: string,
  actor: string,
  action: string,
  id: string,
  requestId: string,
  before: any,
  after: any,
) {
  await c.query(
    "INSERT INTO audit_events(project_id,actor_id,action,entity_type,entity_id,request_id,before_json,after_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      project,
      actor,
      action,
      "proposal",
      id,
      requestId,
      JSON.stringify(before),
      JSON.stringify(after),
    ],
  );
}
