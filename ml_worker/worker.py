import os,socket,signal,time,threading,uuid
from database import connect
from embeddings import models
from matching_engine import process_report
from import_schedule import process_import
OWNER=socket.gethostname()+'-'+str(uuid.uuid4());stop=threading.Event()
def heartbeat(job_id,done):
    while not done.wait(20):
        with connect() as conn:
            conn.execute("UPDATE jobs SET lease_expires_at=now()+interval '60 seconds' WHERE id=%s AND lease_owner=%s AND status='RUNNING'",(job_id,OWNER))
            conn.execute('UPDATE worker_health SET heartbeat_at=now() WHERE worker_id=%s',(OWNER,))
def run():
    signal.signal(signal.SIGTERM,lambda *_:stop.set());signal.signal(signal.SIGINT,lambda *_:stop.set())
    while not stop.is_set():
        ready=True;error=None
        try:models()
        except Exception as exc:ready=False;error=str(exc)[:1000]
        try:
            with connect() as conn:
                conn.execute('INSERT INTO worker_health(worker_id,heartbeat_at,models_ready,error) VALUES(%s,now(),%s,%s) ON CONFLICT(worker_id) DO UPDATE SET heartbeat_at=now(),models_ready=EXCLUDED.models_ready,error=EXCLUDED.error',(OWNER,ready,error))
                conn.execute("UPDATE jobs SET status='FAILED',last_error='Lease expired after maximum attempts' WHERE status='RUNNING' AND lease_expires_at<now() AND attempt_count>=max_attempts")
                conn.execute("UPDATE site_reports r SET processing_status='FAILED',error_details=j.last_error FROM jobs j WHERE j.type='REPORT' AND j.status='FAILED' AND j.payload->>'report_id'=r.id::text AND r.processing_status IN ('QUEUED','PROCESSING')")
                job=conn.execute("WITH claimed AS (SELECT id FROM jobs WHERE ((status='QUEUED' AND available_at<=now()) OR (status='RUNNING' AND lease_expires_at<now())) AND attempt_count<max_attempts ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE jobs j SET status='RUNNING',lease_owner=%s,lease_expires_at=now()+interval '60 seconds',attempt_count=attempt_count+1 FROM claimed WHERE j.id=claimed.id RETURNING j.*",(OWNER,)).fetchone()
            if not job:stop.wait(5);continue
            done=threading.Event();thread=threading.Thread(target=heartbeat,args=(job['id'],done),daemon=True);thread.start()
            try:
                if job['type']=='REPORT':
                    with connect() as conn:conn.execute("UPDATE site_reports SET processing_status='PROCESSING' WHERE id=%s AND processing_status NOT IN ('NEEDS_REVIEW','ACCEPTED','REJECTED')",(job['payload']['report_id'],))
                    process_report(job['payload']['report_id'])
                elif job['type']=='IMPORT':process_import(job['payload'])
                else:raise ValueError('Unsupported job type')
                with connect() as conn:conn.execute("UPDATE jobs SET status='DONE',lease_owner=NULL,lease_expires_at=NULL WHERE id=%s AND lease_owner=%s",(job['id'],OWNER))
            except Exception as exc:
                print({'job':str(job['id']),'error':str(exc)},flush=True)
                with connect() as conn:
                    conn.execute("UPDATE jobs SET status=%s,last_error=%s,available_at=now()+interval '30 seconds',lease_owner=NULL,lease_expires_at=NULL WHERE id=%s AND lease_owner=%s",('FAILED' if job['attempt_count']>=job['max_attempts'] else 'QUEUED',str(exc)[:1000],job['id'],OWNER))
                    if job['type']=='REPORT':conn.execute("UPDATE site_reports SET processing_status='FAILED',error_details=%s WHERE id=%s",(str(exc)[:1000],job['payload']['report_id']))
                    if job['type']=='IMPORT':conn.execute("UPDATE schedule_versions SET import_status='FAILED',validation_summary=jsonb_build_object('error',%s::text) WHERE id=%s",(str(exc)[:1000],job['payload']['version_id']))
            finally:done.set();thread.join(timeout=2)
        except Exception as exc:print({'worker_error':str(exc)},flush=True);stop.wait(5)
if __name__=='__main__':run()
