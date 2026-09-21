import type { PoolClient } from "pg";
export async function lockActivity(
  c: PoolClient,
  id: string,
  projectId: string,
  versionId: string,
) {
  return (
    await c.query(
      "SELECT * FROM schedule_activities WHERE id=$1 AND project_id=$2 AND schedule_version_id=$3 FOR UPDATE",
      [id, projectId, versionId],
    )
  ).rows[0];
}
