from psycopg.types.json import Jsonb
from database import connect
from schemas import Event
from config import BI_MODEL,BI_REVISION,CROSS_MODEL,CROSS_REVISION,POLICY
from extraction.deterministic import extract_events
from normalization import normalize_identifiers
from embeddings import embed
from scoring import rerank_candidates,apply_hard_rules
from routing import score_and_route
def retrieve_candidates(event,project_id,schedule_version_id,limit=30):
    vector=embed(event.evidence['text'])
    with connect() as conn:
        rows=conn.execute('SELECT a.*,b.baseline_start,b.baseline_finish,1-(e.embedding <=> %s) AS retrieval_score FROM activity_embeddings e JOIN schedule_activities a ON a.id=e.activity_id LEFT JOIN activity_baselines b ON b.activity_id=a.id WHERE e.project_id=%s AND e.schedule_version_id=%s AND e.model_id=%s AND e.revision=%s ORDER BY e.embedding <=> %s LIMIT %s',(vector,project_id,schedule_version_id,BI_MODEL,BI_REVISION,vector,limit)).fetchall()
        if not rows:raise RuntimeError('No embeddings for the configured model and active schedule. Import or re-embed the schedule.')
        return rows
def persist_proposals(report_id,results):
    with connect() as conn:
        report=conn.execute('SELECT * FROM site_reports WHERE id=%s FOR UPDATE',(report_id,)).fetchone()
        for index,(event,candidates,routing,reasons,missing,version) in enumerate(results):
            row=conn.execute('INSERT INTO report_events(site_report_id,project_id,event_index,event_type,extracted_fields,evidence,extraction_version) VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(site_report_id,extraction_version,event_index) DO NOTHING RETURNING id',(report_id,report['project_id'],index,event.event_type,Jsonb(event.model_dump(mode='json')),Jsonb(event.evidence),'deterministic-v1')).fetchone()
            if not row:continue
            top=next((a for a in candidates if not a.get('conflicts')),None)
            variance={}
            if top and event.event_date and event.event_type in ('START','FINISH'):
                baseline=top.get('baseline_start' if event.event_type=='START' else 'baseline_finish')
                if baseline:variance={'basis':'CALENDAR_DAYS','field':'actual_start' if event.event_type=='START' else 'actual_finish','proposed_date':event.event_date.isoformat(),'baseline_date':baseline.isoformat(),'variance_days':(event.event_date-baseline).days,'requires_approval':True}
            safe=[{k:str(v) if k in ('id','schedule_version_id','project_id') else float(v) if k in ('accepted_quantity','planned_total_quantity','physical_percent_complete') else v.isoformat() if hasattr(v,'isoformat') else v for k,v in a.items() if k not in ('created_at','updated_at')} for a in candidates[:5]]
            conn.execute('INSERT INTO staged_proposals(report_event_id,project_id,schedule_version_id,selected_activity_id,candidate_matches,proposed_changes,expected_activity_row_version,match_score,model_version,routing_status,missing_fields,reason_codes,explanation,raw_scores,proposed_variance) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',(row['id'],report['project_id'],version,top['id'] if top else None,Jsonb(safe),Jsonb(event.model_dump(mode='json')),top['row_version'] if top else None,top['rerank_score'] if top else None,CROSS_MODEL+'@'+CROSS_REVISION,routing,Jsonb(missing),Jsonb(reasons),'Local semantic retrieval and raw cross-encoder ranking. Reviewer approval required.',Jsonb({'retrieval':top['retrieval_score'],'rerank':top['rerank_score']} if top else {}),Jsonb(variance)))
        conn.execute("UPDATE site_reports SET processing_status='NEEDS_REVIEW',error_details=NULL WHERE id=%s AND processing_status NOT IN ('ACCEPTED','REJECTED')",(report_id,))
def process_report(report_id):
    with connect() as conn:
        report=conn.execute('SELECT r.*,p.active_schedule_version_id FROM site_reports r JOIN projects p ON p.id=r.project_id WHERE r.id=%s',(report_id,)).fetchone()
    if report['processing_status'] in ('NEEDS_REVIEW','ACCEPTED','REJECTED'):return
    if not report['active_schedule_version_id']:raise RuntimeError('No active schedule. Import and activate a schedule first.')
    from transcription import prepare_report
    report=prepare_report(report)
    events=extract_events(report)
    if not events:raise RuntimeError('No readable report evidence.')
    results=[]
    for event in events:
        event=normalize_identifiers(event)
        candidates=retrieve_candidates(event,report['project_id'],report['active_schedule_version_id'])
        ranked=rerank_candidates(event,candidates)
        candidates=apply_hard_rules(event,ranked)
        routing,reasons,missing=score_and_route(event,candidates,POLICY)
        if event.event_date and event.event_date>report['reporting_date']:
            routing='REVIEW_NEEDED';reasons.append('FUTURE_ACTUAL_DATE')
        if not candidates:candidates=ranked[:5]
        results.append((event,candidates,routing,reasons,missing,report['active_schedule_version_id']))
    persist_proposals(report_id,results)
