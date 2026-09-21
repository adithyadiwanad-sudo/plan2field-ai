"""Real cloud pgvector/worker checks against synthetic fixture reports; no approvals."""
import sys,os,json
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'ml_worker'))
from environment import load_environment
load_environment()
os.environ['DATABASE_URL']=os.environ['WORKER_DATABASE_URL']
os.environ['HF_HUB_OFFLINE']='1'
from database import connect
from matching_engine import process_report
def main():
    with connect() as c:
        assert c.execute('SELECT current_user AS name').fetchone()['name']=='p2f_worker'
        rows=c.execute("SELECT r.id,r.metadata->>'fixture' AS fixture FROM site_reports r JOIN projects p ON p.id=r.project_id WHERE p.code='OIL-DEMO-01' AND r.metadata->>'provenance'='SYNTHETIC' AND r.metadata->>'fixture'<>'ENTERPRISE_V2' ORDER BY r.received_at").fetchall()
    for r in rows:
        process_report(r['id']);process_report(r['id'])
        with connect() as c:
            proposals=c.execute('SELECT p.*,a.external_activity_id FROM staged_proposals p JOIN report_events e ON e.id=p.report_event_id LEFT JOIN schedule_activities a ON a.id=p.selected_activity_id WHERE e.site_report_id=%s',(r['id'],)).fetchall()
            assert len(proposals)==1,(r['fixture'],'Expected one idempotent proposal')
            proposal=proposals[0]
            expected={'CLEAN_START':'ACT-24-SPOOL-01','PARTIAL':'ACT-24-SPOOL-01','WRONG_OPERATION':'ACT-24-TEST-01'}
            if r['fixture'] in expected:assert proposal['external_activity_id']==expected[r['fixture']]
            if r['fixture']=='AMBIGUOUS':assert proposal['routing_status']=='REVIEW_NEEDED'
            if r['fixture'] in ('FUTURE','NEGATION'):assert proposal['routing_status']=='REJECTED'
            c.execute("UPDATE jobs SET status='DONE' WHERE type='REPORT' AND payload->>'report_id'=%s",(str(r['id']),))
            print(json.dumps({'fixture':r['fixture'],'activity':proposal['external_activity_id'],'routing':proposal['routing_status'],'duplicate_processing':'PASS'}),flush=True)
    with connect() as c:
        a=c.execute("SELECT a.*,b.baseline_start,b.baseline_finish FROM schedule_activities a JOIN projects p ON p.id=a.project_id JOIN activity_baselines b ON b.activity_id=a.id WHERE p.code='OIL-DEMO-01' AND a.external_activity_id='ACT-24-SPOOL-01'").fetchone()
        assert a['accepted_quantity']==0 and a['actual_start'] is None and str(a['baseline_start'])=='2026-09-10'
    print('PASS: actual pgvector retrieval, semantic gates, retry idempotency and unchanged seeded actuals/baselines.')
if __name__=='__main__':main()
