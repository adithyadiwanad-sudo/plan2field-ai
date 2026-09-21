"""Exercise new evidence against real Neon vectors/models without approving actuals."""
import os,sys,json,uuid,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'ml_worker'))
from environment import load_environment
load_environment()
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
os.environ['DATABASE_URL']=os.environ['WORKER_DATABASE_URL'];os.environ['HF_HUB_OFFLINE']='1'
from matching_engine import process_report
text='\n'.join([
 'Line 24 spool erection started on 12 September 2026 in the north area.',
 'Civil concrete foundation started on 12 September 2026.',
 'Electrical cable installation 42.5% complete on 12 September 2026.',
 'Mechanical pump alignment finished on 12 September 2026.',
 'Instrumentation transmitter calibration started on 12 September 2026.',
 'HSSE safety inspection completed on 12 September 2026.',
])
with psycopg.connect(os.environ['API_DATABASE_URL'],row_factory=dict_row,connect_timeout=20) as c:
 p=c.execute("SELECT id FROM projects WHERE code='OIL-DEMO-01'").fetchone()['id']
 u=c.execute('SELECT id FROM users WHERE email=%s',(os.environ['DEMO_EMAIL'],)).fetchone()['id']
 before=c.execute("SELECT accepted_quantity,actual_start,actual_finish FROM schedule_activities WHERE project_id=%s AND external_activity_id='ACT-24-SPOOL-01'",(p,)).fetchone()
 key=uuid.uuid5(uuid.NAMESPACE_URL,'plan2field/enterprise-evidence-v3')
 c.execute("INSERT INTO site_reports(project_id,submitted_by,source_type,original_text,reporting_date,captured_at,idempotency_key,request_payload_hash,metadata) VALUES(%s,%s,'TEXT',%s,'2026-09-15',now(),%s,%s,%s) ON CONFLICT DO NOTHING",(p,u,text,key,hashlib.sha256(text.encode()).hexdigest(),Jsonb({'provenance':'SYNTHETIC','fixture':'ENTERPRISE_V2'})))
 r=c.execute('SELECT id,reporter_role FROM site_reports WHERE project_id=%s AND submitted_by=%s AND idempotency_key=%s',(p,u,key)).fetchone()
 assert r['reporter_role']=='ADMIN'
process_report(r['id']);process_report(r['id'])
with psycopg.connect(os.environ['API_DATABASE_URL'],row_factory=dict_row,connect_timeout=20) as c:
 rows=c.execute('SELECT e.discipline,p.*,a.external_activity_id FROM report_events e JOIN staged_proposals p ON p.report_event_id=e.id LEFT JOIN schedule_activities a ON a.id=p.selected_activity_id WHERE e.site_report_id=%s ORDER BY e.event_index',(r['id'],)).fetchall()
 assert len(rows)==6 and {r['discipline'] for r in rows}=={'PIPING','CIVIL','ELECTRICAL','MECHANICAL','INSTRUMENTATION','HSSE'}
 assert rows[0]['external_activity_id']=='ACT-24-SPOOL-01'
 assert rows[0]['proposed_changes']['quantity'] is None
 assert rows[0]['proposed_variance']['variance_days']==2
 for row in rows:
  assert row['candidate_matches'] and 'retrieval_score' in row['candidate_matches'][0]
  if row['discipline'] in ('ELECTRICAL','MECHANICAL','INSTRUMENTATION','HSSE'):
   assert row['match_classification']=='UNMATCHED' and row['routing_status']=='REVIEW_NEEDED'
  print(json.dumps({'discipline':row['discipline'],'match':row['match_classification'],'activity':row['external_activity_id']}),flush=True)
 assert c.execute("SELECT count(*) n FROM audit_events WHERE entity_id=%s AND action='REPORT_SUBMITTED'",(r['id'],)).fetchone()['n']==1
 assert c.execute("SELECT count(*) n FROM audit_events WHERE entity_id=ANY(%s) AND action='AI_STAGED'",([row['id'] for row in rows],)).fetchone()['n']==6
 after=c.execute("SELECT accepted_quantity,actual_start,actual_finish FROM schedule_activities WHERE project_id=%s AND external_activity_id='ACT-24-SPOOL-01'",(p,)).fetchone()
 assert before==after
print('PASS: six disciplines, real pgvector/reranker scores, unmatched routing, staged +2 day variance, audit snapshots and retry safety; actuals unchanged.')
