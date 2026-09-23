import { pool } from "../db/pool.js";
export async function userProfile(userId: string) {
  const { rows } = await pool.query(`SELECT u.id, u.id AS "userId", u.email, u.name, u.discipline,
    COALESCE(jsonb_agg(jsonb_build_object('project_id', m.project_id, 'role', m.role))
      FILTER (WHERE m.project_id IS NOT NULL), '[]'::jsonb) AS memberships
    FROM users u LEFT JOIN project_memberships m ON m.user_id=u.id
    WHERE u.id=$1 GROUP BY u.id`, [userId]);
  return rows[0];
}
