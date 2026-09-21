import pytest
from extraction.deterministic import extract_events
from parsers.progress_spreadsheet import parse
from routing import score_and_route

@pytest.mark.parametrize('text,discipline,kind',[
 ('Concrete foundation started on 12 September 2026.','CIVIL','START'),
 ('Line 24 spool erection started on 12 September 2026.','PIPING','START'),
 ('Electrical cable installation 40% complete on 12 September 2026.','ELECTRICAL','PROGRESS'),
 ('Mechanical pump alignment finished on 12 September 2026.','MECHANICAL','FINISH'),
 ('Transmitter calibration started on 12 September 2026.','INSTRUMENTATION','START'),
 ('HSSE safety inspection completed on 12 September 2026.','HSSE','FINISH'),
])
def test_all_disciplines(text,discipline,kind):
 e=extract_events({'transcript':text})[0]
 assert (e.discipline,e.event_type)==(discipline,kind)

def test_percentage_and_quantity():
 e=extract_events({'original_text':'Electrical cable installation 42.5% complete on 12 September 2026.'})[0]
 assert e.physical_percent==42.5 and not e.quantity_mode
 e=extract_events({'original_text':'Electrical cable installation 25 metres complete on 12 September 2026.'})[0]
 assert (e.quantity,e.unit,e.quantity_mode)==(25,'m','CUMULATIVE')

def test_spreadsheet_row_disciplines():
 rows=parse(b'report_text,discipline\nInstallation started on 12 September 2026.,ELECTRICAL\nInstallation started on 13 September 2026.,MECHANICAL',{'text':'report_text','discipline':'discipline'})
 offset=0
 for row in rows:
  row['start']=offset;row['end']=offset+len(row['text']);offset=row['end']+1
 events=extract_events({'transcript':'\n'.join(r['text'] for r in rows),'source_evidence':rows})
 assert [e.discipline for e in events]==['ELECTRICAL','MECHANICAL']

def test_no_candidate_remains_reviewable():
 e=extract_events({'original_text':'Electrical cable installation started on 12 September 2026.'})[0]
 route,reasons,_=score_and_route(e,[],{'threshold':2,'margin':1})
 assert route=='REVIEW_NEEDED' and 'NO_COMPATIBLE_ACTIVITY' in reasons

def test_confident_match_stages_but_low_score_requires_review():
 e=extract_events({'original_text':'Line 24 spool erection started on 12 September 2026.'})[0]
 candidate={'line_number':'24','discipline':'PIPING','activity_type':'ERECTION','rerank_score':5}
 assert score_and_route(e,[candidate],{'threshold':2,'margin':1})[0]=='AUTO_STAGED'
 candidate['rerank_score']=-1
 route,reasons,_=score_and_route(e,[candidate],{'threshold':2,'margin':1})
 assert route=='REVIEW_NEEDED' and 'LOW_UNCALIBRATED_SCORE' in reasons
