import os,sys,json,hashlib,uuid
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from database import connect
from config import UPLOAD_DIR
from import_schedule import process_import
FIXTURES=Path('/fixtures') if Path('/fixtures').exists() else Path(__file__).resolve().parents[2]/'database'/'fixtures'
def main():
    if os.environ.get('LOCAL_DEMO')!='true':raise SystemExit('Seed requires explicit LOCAL_DEMO=true')
    password=os.environ.get('DEMO_PASSWORD','');email=os.environ.get('DEMO_EMAIL','reviewer@plan2field.local').lower()
    if len(password)<12:raise SystemExit('Set DEMO_PASSWORD to at least 12 characters')
    salt=os.urandom(16).hex();digest=hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1,dklen=64).hex()
    from psycopg.types.json import Jsonb
    with connect() as conn:
        user=conn.execute('INSERT INTO users(email,password_hash,name) VALUES(%s,%s,%s) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id',(email,salt+':'+digest,'Demo Reviewer')).fetchone()['id']
        project=conn.execute("INSERT INTO projects(code,name,description,reporting_date,provenance) VALUES('OIL-DEMO-01','Oil & Gas Piping Execution Demo','SYNTHETIC DEMO DATA — illustrative, not Oil India records','2026-09-15','SYNTHETIC') ON CONFLICT(code) DO UPDATE SET code=EXCLUDED.code RETURNING *").fetchone()
        conn.execute("INSERT INTO project_memberships(project_id,user_id,role) VALUES(%s,%s,'ADMIN') ON CONFLICT DO NOTHING",(project['id'],user))
        from seed_demo_accounts import seed_demo_accounts
        seed_demo_accounts(conn, project['id'])
        data=(FIXTURES/'demo_schedule.csv').read_bytes()
        version=conn.execute("INSERT INTO schedule_versions(project_id,version_number,source_format,source_filename,source_hash,imported_by) VALUES(%s,1,'CSV','demo_schedule.csv',%s,%s) ON CONFLICT(project_id,version_number) DO UPDATE SET version_number=EXCLUDED.version_number RETURNING *",(project['id'],hashlib.sha256(data).hexdigest(),user)).fetchone()
        # Deliberately unassigned second project tests access isolation.
        other=conn.execute("INSERT INTO projects(code,name,reporting_date,provenance) VALUES('OIL-ISOLATION-02','Synthetic isolation project','2026-09-15','SYNTHETIC') ON CONFLICT(code) DO UPDATE SET code=EXCLUDED.code RETURNING id").fetchone()['id']
        other_version=conn.execute("INSERT INTO schedule_versions(project_id,version_number,source_format,source_filename,source_hash,import_status) VALUES(%s,1,'CSV','synthetic','synthetic','VALIDATED') ON CONFLICT(project_id,version_number) DO UPDATE SET version_number=EXCLUDED.version_number RETURNING id",(other,)).fetchone()['id']
        conn.execute("INSERT INTO schedule_activities(project_id,schedule_version_id,external_activity_id,description,wbs_path,activity_type,line_number,planned_total_quantity,quantity_unit,measurement_method) VALUES(%s,%s,'ACT-24-SPOOL-01','Erect Pipe Line 24-XX','OTHER.PIPING','ERECTION','24',10,'spool','QUANTITY') ON CONFLICT DO NOTHING",(other,other_version))
    if version['import_status']!='VALIDATED':
        ref=str(uuid.uuid4());Path(UPLOAD_DIR).mkdir(parents=True,exist_ok=True);(Path(UPLOAD_DIR)/ref).write_bytes(data)
        process_import({'version_id':version['id'],'storage_ref':ref,'baseline_confirmed':True})
    with connect() as conn:
        conn.execute('UPDATE projects SET active_schedule_version_id=%s WHERE id=%s AND active_schedule_version_id IS NULL',(version['id'],project['id']))
        for item in json.loads((FIXTURES/'historical_projects.json').read_text()):
            p=conn.execute("INSERT INTO projects(code,name,reporting_date,status,provenance) VALUES(%s,%s,'2026-09-15','CLOSED','SYNTHETIC') ON CONFLICT(code) DO UPDATE SET code=EXCLUDED.code RETURNING id",(item['code'],'Synthetic completed piping project')).fetchone()['id']
            conn.execute("INSERT INTO project_memberships(project_id,user_id,role) VALUES(%s,%s,'REVIEWER') ON CONFLICT DO NOTHING",(p,user))
            from datetime import date
            duration=(date.fromisoformat(item['actual_finish'])-date.fromisoformat(item['actual_start'])).days
            conn.execute("INSERT INTO historical_activity_records(id,project_id,work_type,discipline,quantity,unit,context,baseline_duration,actual_duration,duration_basis,date_evidence,deviation_reason,provenance,closeout_version) VALUES(%s,%s,'ERECTION','PIPING',%s,'spool',%s,10,%s,'CALENDAR_DAYS',%s,%s,'SYNTHETIC',1) ON CONFLICT(id) DO NOTHING",(uuid.uuid5(uuid.NAMESPACE_DNS,item['code']),p,item['quantity'],Jsonb({'area':'NORTH','crew':'Not recorded'}),duration,Jsonb(item),item['reason']))
        for item in json.loads((FIXTURES/'demo_reports.json').read_text()):
            key=uuid.uuid5(uuid.NAMESPACE_URL,'plan2field/OIL-DEMO-01/'+item['name'])
            payload_hash=hashlib.sha256(item['text'].encode()).hexdigest()
            report=conn.execute("INSERT INTO site_reports(project_id,submitted_by,source_type,original_text,reporting_date,captured_at,idempotency_key,request_payload_hash,content_hash,metadata) VALUES(%s,%s,'TEXT',%s,'2026-09-15','2026-09-15T09:00:00Z',%s,%s,%s,%s) ON CONFLICT(project_id,submitted_by,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING id",(project['id'],user,item['text'],key,payload_hash,payload_hash,Jsonb({'provenance':'SYNTHETIC','fixture':item['name']}))).fetchone()['id']
            conn.execute("INSERT INTO jobs(type,payload,deduplication_key) VALUES('REPORT',%s,%s) ON CONFLICT(deduplication_key) DO NOTHING",(Jsonb({'report_id':str(report)}),'report:'+str(report)))
    print('Synthetic schedule, real embeddings, historical records and eight queued reports seeded idempotently. Existing account passwords are preserved.')
if __name__=='__main__':main()
