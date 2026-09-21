from parsers.canonical_csv import validate
def parse(data):
    """Bounded TASK subset; approved custom quantity/mapping columns are required."""
    rows=[];table=None;headers=[];links=[];ids={}
    for line in data.decode('utf-8-sig').splitlines():
        parts=line.split('\t')
        if parts[0]=='%T':table=parts[1]
        elif parts[0]=='%F':headers=parts[1:]
        elif parts[0]=='%R' and table=='TASK':
            source=dict(zip(headers,parts[1:]));row=dict(source)
            row['external_activity_id']=source.get('task_code','');row['description']=source.get('task_name','')
            if source.get('task_id'):ids[source['task_id']]=row['external_activity_id']
            rows.append(row)
        elif parts[0]=='%R' and table=='TASKPRED':links.append(dict(zip(headers,parts[1:])))
    by_code={r['external_activity_id']:r for r in rows}
    for rel in links:
        successor=ids.get(rel.get('task_id'));predecessor=ids.get(rel.get('pred_task_id'))
        if successor not in by_code or not predecessor:raise ValueError('Unresolved XER TASKPRED identity')
        by_code[successor].setdefault('relationships',[]).append({'predecessor':predecessor,'type':rel.get('pred_type','PR_FS').removeprefix('PR_'),'lag':rel.get('lag_hr_cnt','0'),'lag_unit':'HOURS','source':rel})
    result=validate(rows);result['warnings']+=['Restricted UTF-8 TASK/TASKPRED subset. Resource assignments and calendars are not imported. Current planned dates are not treated as approved baselines. Relationship lag hours are retained without calendar calculation.'];return result
