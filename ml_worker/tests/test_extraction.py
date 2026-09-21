import pytest
from extraction.deterministic import extract_events
from scoring import apply_hard_rules
from routing import score_and_route
def extract(text):return extract_events({'original_text':text})[0]
def test_clean_start():
    e=extract('Line twenty-four spool erection started on 12 September 2026 in the north area.')
    assert (e.event_type,e.line_number,str(e.event_date),e.action)==('START','24','2026-09-12','ERECTION')
def test_partial():
    e=extract('On line 24, spools S01, S02 and S03 are erected. Three out of ten are complete in total as of 15 September 2026.')
    assert e.component_ids==['S01','S02','S03'] and e.quantity_mode=='COMPONENT_SET' and e.event_type=='PROGRESS'
@pytest.mark.parametrize('text,kind',[('We will start erecting line 24 tomorrow.','PLAN'),('Line 24 erection has not started.','UNKNOWN'),('spool erected','PROGRESS'),('Hydrotest completed on line 24 on 15 September 2026.','FINISH')])
def test_intent(text,kind):assert extract(text).event_type==kind
def test_full_identifier():assert extract('Line 24-A erection started.').line_number=='24-A'
def test_quantity_modes():
    assert extract('three additional spools erected on line 24').quantity_mode=='INCREMENTAL'
    assert extract('three out of ten in total erected on line 24').quantity_mode=='CUMULATIVE'
def test_correction_remains_one_event():
    events=extract_events({'original_text':'Correction: S03 was reported in error; only S01 and S02 are erected.'})
    assert len(events)==1 and events[0].event_type=='CORRECTION'
    assert events[0].component_ids==['S01','S02']
def test_independent_sentences_split_with_offsets():
    text='Line 24 erection started on 12 September 2026. Line 42 erection started on 13 September 2026.'
    events=extract_events({'original_text':text})
    assert [e.line_number for e in events]==['24','42']
    for e in events:assert text[e.evidence['start']:e.evidence['end']]==e.evidence['text']
def test_hard_gates():
    e=extract('Line 24 erection started on 12 September 2026.')
    assert apply_hard_rules(e,[{'line_number':'42','activity_type':'ERECTION'},{'line_number':'24','activity_type':'FABRICATION'}])==[]
def test_ambiguity_and_no_match():
    e=extract('Spool erection started in the north area on 12 September 2026.')
    assert score_and_route(e,[{'rerank_score':5,'activity_type':'ERECTION','area':'NORTH'}],{'threshold':2,'margin':1})[0]=='REVIEW_NEEDED'
    assert score_and_route(e,[],{'threshold':2,'margin':1})[0]=='REVIEW_NEEDED'
