def score_and_route(event,candidates,policy):
    reasons=[];missing=list(event.missing_fields)
    if event.negated or event.future_intent or event.event_type in ('UNKNOWN','PLAN','BLOCKER'):
        return 'REJECTED',['NOT_ACTUAL_EVIDENCE'],missing
    if not candidates:return 'REJECTED',['NO_COMPATIBLE_ACTIVITY'],missing
    for field,value in [('line_number',event.line_number),('asset_tag',event.asset_tag),('discipline',event.discipline),('area',event.area),('activity_type',event.action)]:
        if value and not candidates[0].get(field):missing.append('activity_'+field)
    if event.event_type=='CORRECTION':reasons.append('EXPLICIT_CORRECTION_REVIEW')
    if event.quantity_mode in ('CUMULATIVE','INCREMENTAL'):reasons.append('AGGREGATE_OVERLAP_REVIEW')
    if missing:reasons.append('MISSING_FIELDS')
    if candidates[0]['rerank_score']<policy['threshold']:reasons.append('LOW_UNCALIBRATED_SCORE')
    if len(candidates)>1 and candidates[0]['rerank_score']-candidates[1]['rerank_score']<policy['margin']:reasons.append('CANDIDATE_AMBIGUITY')
    return ('REVIEW_NEEDED' if reasons else 'AUTO_STAGED'),reasons,missing
