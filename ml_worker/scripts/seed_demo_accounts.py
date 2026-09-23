"""Idempotent demo identity seed; uses normal scrypt hashes and project RBAC."""
import os, sys, hashlib
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from database import connect

DEMO_PASSWORD = "ChangeThisDemoPassword123!"
def seed_demo_accounts(conn, project_id):
    for email, name, role in [
        ("engineer@plan2field.ai", "Demo Field Engineer", "ENGINEER"),
        ("planner@plan2field.ai", "Demo Project Planner", "REVIEWER"),
    ]:
        salt = os.urandom(16).hex()
        digest = hashlib.scrypt(DEMO_PASSWORD.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64).hex()
        user = conn.execute("INSERT INTO users(email,password_hash,name,discipline) VALUES(%s,%s,%s,'PIPING') ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id", (email, salt+":"+digest, name)).fetchone()
        conn.execute("INSERT INTO project_memberships(project_id,user_id,role) VALUES(%s,%s,%s) ON CONFLICT DO NOTHING", (project_id,user['id'],role))

if __name__ == "__main__":
    if os.environ.get("LOCAL_DEMO") != "true":
        raise SystemExit("Demo seed requires LOCAL_DEMO=true")
    with connect() as conn:
        project = conn.execute("SELECT id FROM projects WHERE code='OIL-DEMO-01' AND provenance='SYNTHETIC'").fetchone()
        if not project: raise SystemExit("Seed the synthetic OIL-DEMO-01 project first")
        seed_demo_accounts(conn, project['id'])
    print("Demo identities seeded; existing passwords and memberships preserved.")
