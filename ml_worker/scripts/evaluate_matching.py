"""Runs only real installed models. Keyword baseline exists for evaluation only."""
import sys,json,time,platform,statistics
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from database import connect
from extraction.deterministic import extract_events
from matching_engine import retrieve_candidates
from scoring import apply_hard_rules,rerank_candidates
from routing import score_and_route
from embeddings import activity_text
from config import POLICY,BI_MODEL,BI_REVISION,CROSS_MODEL,CROSS_REVISION
def main():
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--fixture-only',action='store_true',help='Evaluate in-memory cosine retrieval; does not verify PostgreSQL');parser.add_argument('--output');args=parser.parse_args()
    fixture=Path('/fixtures/heldout_reports.json') if Path('/fixtures').exists() else Path(__file__).resolve().parents[2]/'database/fixtures/heldout_reports.json'
    dataset=json.loads(fixture.read_text())
    setup_begin=time.perf_counter()
    if args.fixture_only:
        from parsers.canonical_csv import parse
        from embeddings import embed
        import numpy as np
        activities=parse((fixture.parent/'demo_schedule.csv').read_bytes())['rows']
        vectors=np.array([embed(activity_text(a)) for a in activities])
    else:
        with connect() as conn:
            project=conn.execute("SELECT * FROM projects WHERE code='OIL-DEMO-01'").fetchone()
            activities=conn.execute('SELECT * FROM schedule_activities WHERE project_id=%s AND schedule_version_id=%s',(project['id'],project['active_schedule_version_id'])).fetchall()
    setup_seconds=time.perf_counter()-setup_begin
    counts={'keyword_top1':0,'bi_top1':0,'hybrid_top1':0,'retrieval_hits':0,'matchable':0,'auto':0,'auto_correct':0,'review':0,'rejected':0,'event_type_exact':0};latencies=[];outcomes=[]
    for item in dataset:
        begin=time.perf_counter();event=extract_events({'original_text':item['text']})[0]
        keyword=sorted(activities,key=lambda a:len(set(item['text'].lower().split())&set(activity_text(a).lower().split())),reverse=True)
        if args.fixture_only:
            similarities=vectors@embed(event.evidence['text'])
            candidates=[{**activities[i],'retrieval_score':float(similarities[i])} for i in np.argsort(-similarities)[:30]]
        else:candidates=retrieve_candidates(event,project['id'],project['active_schedule_version_id'])
        hybrid=rerank_candidates(event,apply_hard_rules(event,candidates))
        route,reasons,missing=score_and_route(event,hybrid,POLICY)
        latency=time.perf_counter()-begin;latencies.append(latency)
        target=item['activity']
        if target:
            counts['matchable']+=1
            counts['keyword_top1']+=keyword[0]['external_activity_id']==target
            counts['bi_top1']+=candidates[0]['external_activity_id']==target
            counts['hybrid_top1']+=bool(hybrid) and hybrid[0]['external_activity_id']==target
            counts['retrieval_hits']+=any(a['external_activity_id']==target for a in candidates)
        counts['event_type_exact']+=event.event_type==item['event_type']
        counts['auto']+=route=='AUTO_STAGED';counts['auto_correct']+=route=='AUTO_STAGED' and bool(target) and hybrid[0]['external_activity_id']==target
        counts['review']+=route=='REVIEW_NEEDED';counts['rejected']+=route=='REJECTED'
        outcomes.append({'text':item['text'],'target':target,'selected':hybrid[0]['external_activity_id'] if hybrid else None,'route':route,'reasons':reasons,'missing':missing,'seconds':latency})
    n=len(dataset);m=counts['matchable'];ratio=lambda x,d:x/d if d else None
    result={'dataset_size':n,'provenance':'SYNTHETIC_HELDOUT; not an operational accuracy estimate','retrieval_backend':'IN_MEMORY_FIXTURE_ONLY' if args.fixture_only else 'POSTGRES_PGVECTOR','hardware':platform.platform()+' / '+platform.processor(),'models':[BI_MODEL+'@'+BI_REVISION,CROSS_MODEL+'@'+CROSS_REVISION],'policy':POLICY,'retrieval_recall_at_30':ratio(counts['retrieval_hits'],m),'keyword_top1_accuracy_matchable':ratio(counts['keyword_top1'],m),'bi_top1_accuracy_matchable':ratio(counts['bi_top1'],m),'hybrid_top1_accuracy_matchable':ratio(counts['hybrid_top1'],m),'auto_stage_precision':ratio(counts['auto_correct'],counts['auto']),'auto_stage_coverage':ratio(counts['auto'],n),'review_rate':ratio(counts['review'],n),'rejection_rate':ratio(counts['rejected'],n),'event_type_exact_match':ratio(counts['event_type_exact'],n),'latency_seconds_median':statistics.median(latencies),'setup_seconds':setup_seconds,'latency_includes_first_model_load':not args.fixture_only,'outcomes':outcomes}
    if args.output:Path(args.output).write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))
if __name__=='__main__':main()
