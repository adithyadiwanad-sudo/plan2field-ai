"""Safe reset: a new synthetic schedule version, preserving every prior ledger/baseline."""
import os,sys,uuid,hashlib,argparse
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from database import connect
from import_schedule import process_import
from config import UPLOAD_DIR
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--project-code',required=True);args=parser.parse_args()
    if args.project_code!='OIL-DEMO-01' or os.environ.get('LOCAL_DEMO')!='true':raise SystemExit('Reset is restricted to OIL-DEMO-01 in explicit local-demo mode')
    fixture=Path('/fixtures/demo_schedule.csv') if Path('/fixtures').exists() else Path(__file__).resolve().parents[2]/'database/fixtures/demo_schedule.csv'
    data=fixture.read_bytes();ref=str(uuid.uuid4());Path(UPLOAD_DIR).mkdir(parents=True,exist_ok=True);(Path(UPLOAD_DIR)/ref).write_bytes(data)
    with connect() as conn:
        p=conn.execute("SELECT * FROM projects WHERE code='OIL-DEMO-01' AND provenance='SYNTHETIC' FOR UPDATE").fetchone()
        if not p:raise SystemExit('Known synthetic demo project not found')
        owner=conn.execute("SELECT user_id FROM project_memberships WHERE project_id=%s AND role='ADMIN' LIMIT 1",(p['id'],)).fetchone()['user_id']
        version=conn.execute("INSERT INTO schedule_versions(project_id,version_number,source_format,source_filename,source_hash,imported_by) SELECT %s,MAX(version_number)+1,'CSV','demo_schedule.csv',%s,%s FROM schedule_versions WHERE project_id=%s RETURNING id",(p['id'],hashlib.sha256(data).hexdigest(),owner,p['id'])).fetchone()['id']
    process_import({'version_id':version,'storage_ref':ref,'baseline_confirmed':True})
    with connect() as conn:
        conn.execute("UPDATE projects SET active_schedule_version_id=%s,status='ACTIVE' WHERE id=%s",(version,p['id']))
        conn.execute("UPDATE staged_proposals SET lifecycle_status='STALE' WHERE project_id=%s AND lifecycle_status IN ('PENDING','CLARIFICATION_REQUESTED')",(p['id'],))
    print('New demo schedule version activated with zero actuals; prior history retained.')
if __name__=='__main__':main()
