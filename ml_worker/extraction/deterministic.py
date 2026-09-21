import re
from datetime import datetime, date
from schemas import Event
from disciplines import infer_discipline
from normalization import normalize_text, normalize_identifiers
NUMBERS={'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10}
def number(value): return NUMBERS[value] if value in NUMBERS else float(value)
def extract_one(original, offset, discipline_hint=None):
    text=normalize_text(original).lower()
    line=re.search(r'\bline\s+(\d+(?:-[a-z0-9]+)*)\b',text)
    tag=re.search(r'\btag\s+([a-z0-9]+(?:-[a-z0-9]+)+)',text)
    action=next((v for p,v in [(r'fabricat','FABRICATION'),(r'hydrotest|test(?:ing)?','TESTING'),(r'weld','WELDING'),(r'inspect','INSPECTION'),(r'erect','ERECTION'),(r'insulat','INSULATION'),(r'foundation|concret','CIVIL')] if re.search(p,text)),None)
    negated=bool(re.search(r'\bnot\b|\bnever\b',text));future=bool(re.search(r'\bwill\b|\btomorrow\b|\bplan to\b',text))
    kind='UNKNOWN'
    if future: kind='PLAN'
    elif text.startswith('correction'):kind='CORRECTION'
    elif negated:kind='UNKNOWN'
    elif re.search(r'blocked|blocker|held up',text):kind='BLOCKER'
    elif re.search(r'\bstarted\b|\bcommenced\b',text):kind='START'
    elif re.search(r'erected|out of|additional|complete',text):kind='PROGRESS'
    if not future and not negated and re.search(r'(hydrotest|inspection|whole activity)\s+(?:is\s+)?completed|erection\s+(?:is\s+)?finished',text):kind='FINISH'
    discipline=infer_discipline(text,discipline_hint)
    if discipline is None and line and action:discipline='PIPING'
    if not action:
        action=next((v for p,v in [(r'calibrat','CALIBRATION'),(r'install|pulling|pulled|laying|laid','INSTALLATION'),(r'align','ALIGNMENT'),(r'energiz','ENERGIZATION'),(r'excavat|rebar|formwork','CIVIL'),(r'toolbox|permit|safety','HSSE')] if re.search(p,text)),None)
    if not future and not negated and re.search(r'\bfinished\b|\bcompleted\b',text) and not re.search(r'out of|%|spools?\b',text):kind='FINISH'
    dt=None
    found=re.search(r'\b(\d{1,2}\s+[a-z]+\s+\d{4})\b',text)
    try:
        if found:dt=datetime.strptime(found.group(1),'%d %B %Y').date()
        else:
            iso=re.search(r'\b\d{4}-\d{2}-\d{2}\b',text)
            if iso:dt=date.fromisoformat(iso.group())
    except ValueError: pass
    # In correction language only the replacement set after “only” is accepted.
    component_text=text.split('only',1)[-1] if kind=='CORRECTION' else text
    ids=sorted(set(x.upper() for x in re.findall(r'\bs\d{2}\b',component_text)))
    quantity=None;mode='COMPONENT_SET' if ids else None
    count=re.search(r'\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:out of|additional)',text)
    if count:
        quantity=number(count.group(1))
        if not ids:mode='INCREMENTAL' if 'additional' in count.group() else 'CUMULATIVE'
    percent_match=re.search(r'(?<![\d.])(\d+(?:\.\d+)?)\s*%',text)
    percent=float(percent_match.group(1)) if percent_match and float(percent_match.group(1))<=100 else None
    measured=next((m for m in re.finditer(r'\b(\d+(?:\.\d+)?)\s*(m3|m2|metres?|meters?|m|tonnes?|spools?|units?)\b',text) if not re.search(r'\b(?:line|tag)\s*$',text[:m.start()])),None)
    unit='spool' if 'spool' in text or ids else None
    if measured and not ids and not count:
        quantity=float(measured.group(1));unit={'metre':'m','metres':'m','meter':'m','meters':'m','spools':'spool','units':'unit','tonnes':'tonne'}.get(measured.group(2),measured.group(2));mode='INCREMENTAL' if 'additional' in text else 'CUMULATIVE'
        if kind=='UNKNOWN' and not negated and not future:kind='PROGRESS'
    if percent is not None and kind=='UNKNOWN' and not negated and not future:kind='PROGRESS'
    missing=[]
    if not dt:missing.append('event_date')
    if discipline=='PIPING' and not line and not tag:missing.append('line_number')
    if not discipline:missing.append('discipline')
    if not action:missing.append('action')
    if kind in ('PROGRESS','CORRECTION') and not mode and percent is None:missing.append('quantity_mode')
    return normalize_identifiers(Event(event_type=kind,event_date=dt,action=action,line_number=line.group(1) if line else None,asset_tag=tag.group(1) if tag else None,area='NORTH' if 'north' in text else ('SOUTH' if 'south' in text else None),discipline=discipline,physical_percent=percent,quantity=quantity,unit=unit,quantity_mode=mode,component_ids=ids,negated=negated,future_intent=future,evidence={'text':original,'start':offset,'end':offset+len(original)},missing_fields=missing,blockers=[original] if kind=='BLOCKER' else []))
def extract_events(report):
    text=report.get('transcript') or report.get('original_text') or ''
    # A following fraction sentence qualifies the preceding component observation.
    # Other sentences/paragraphs remain independent events with original offsets.
    spans=[]
    for m in re.finditer(r'[^;\n]+',text):
        for sentence in re.finditer(r'.+?(?:[.!?](?=\s|$)|$)',m.group()):
            raw=sentence.group();start=m.start()+sentence.start();clean=raw.strip()
            if not clean:continue
            start+=len(raw)-len(raw.lstrip())
            qualifies=bool(re.match(r'(one|two|three|four|five|six|seven|eight|nine|ten|\d+) out of',clean,re.I))
            if re.match(r'only\b',clean,re.I) and spans and text[spans[-1][0]:spans[-1][1]].lower().startswith('correction'):qualifies=True
            if qualifies and spans and not re.search(r'\bline\b',clean,re.I):
                previous=spans[-1];previous[1]=start+len(clean)
            else:spans.append([start,start+len(clean)])
    events=[]
    for start,end in spans:
        hint=(report.get('metadata') or {}).get('discipline')
        for record in report.get('source_evidence',[]):
            if record.get('start',-1)<=start<record.get('end',-1):hint=record.get('discipline') or hint
        event=extract_one(text[start:end],start,hint)
        if report.get('source_type')=='SCAN':event.missing_fields.append('ocr_evidence_confirmation')
        # Keep source sheet/row/page metadata on each event, in addition to raw offsets.
        if report.get('source_evidence'):
            event.evidence['source_records']=report['source_evidence']
        events.append(event)
    return events
