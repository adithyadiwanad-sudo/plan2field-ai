import re
DISCIPLINES=('CIVIL','PIPING','ELECTRICAL','MECHANICAL','INSTRUMENTATION','HSSE')
PATTERNS={
 'HSSE':r'\b(hsse|hse|safety|toolbox|permit|incident|ppe)\b',
 'INSTRUMENTATION':r'\b(instrumentation|instrument|transmitter|calibrat\w*|loop check\w*)\b',
 'ELECTRICAL':r'\b(electrical|cable\w*|switchgear|energiz\w*|earthing|transformer)\b',
 'MECHANICAL':r'\b(mechanical|pump\w*|compressor\w*|turbine\w*|alignment|rotating)\b',
 'CIVIL':r'\b(civil|foundation\w*|concret\w*|excavat\w*|rebar|formwork)\b',
 'PIPING':r'\b(piping|pipe\w*|spool\w*|hydrotest\w*|weld\w*)\b',
}
def infer_discipline(text, hint=None):
    explicit=re.search(r'\b('+'|'.join(DISCIPLINES)+r')\b',text,re.I)
    if explicit:return explicit.group().upper()
    matches=[d for d,p in PATTERNS.items() if re.search(p,text,re.I)]
    if len(matches)==1:return matches[0]
    if hint in DISCIPLINES:return hint
    return matches[0] if len(matches)==1 else None
