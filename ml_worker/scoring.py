from embeddings import models,activity_text
def rerank_candidates(event,candidates):
    if not candidates:return []
    scores=models()[1].predict([(event.evidence['text'],activity_text(a)) for a in candidates])
    for candidate,score in zip(candidates,scores):candidate['rerank_score']=float(score)
    return sorted(candidates,key=lambda c:c['rerank_score'],reverse=True)
def apply_hard_rules(event,candidates):
    accepted=[]
    for a in candidates:
        reasons=[];conflicts=[]
        for field,value in [('line_number',event.line_number),('asset_tag',event.asset_tag),('discipline',event.discipline),('area',event.area),('activity_type',event.action)]:
            if value and a.get(field) and value.upper()!=a[field].upper():conflicts.append(field)
            elif value and a.get(field):reasons.append(f'Exact {field}: {value}')
            elif value:reasons.append(f'Missing activity {field}; uncertain')
        a['reasons']=reasons;a['conflicts']=conflicts
        if not conflicts:accepted.append(a)
    return accepted
