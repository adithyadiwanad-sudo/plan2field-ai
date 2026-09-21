from defusedxml import ElementTree as ET
from parsers.canonical_csv import validate
def parse(data):
    root=ET.fromstring(data);rows=[];uids={}
    for el in root.iter():el.tag=el.tag.split('}')[-1]
    for task in root.findall('.//Tasks/Task'):
        if task.findtext('Summary')=='1':continue
        row={'external_activity_id':task.findtext('UID',''),'description':task.findtext('Name',''),'wbs_path':task.findtext('WBS','')}
        for attr in task.findall('ExtendedAttribute'):
            row[attr.findtext('FieldName','')]=attr.findtext('Value','')
        row['source_uid']=task.findtext('UID','');uids[row['source_uid']]=row['external_activity_id']
        row['relationships']=[]
        for link in task.findall('PredecessorLink'):
            kind={'0':'FF','1':'FS','2':'SF','3':'SS'}.get(link.findtext('Type','1'))
            if not kind:raise ValueError('Unsupported XML predecessor type')
            row['relationships'].append({'predecessor':link.findtext('PredecessorUID',''),'type':kind,'lag':link.findtext('LinkLag','0'),'lag_unit':'TENTHS_OF_MINUTES','source':{child.tag:child.text for child in link}})
        rows.append(row)
    for row in rows:
        for link in row['relationships']:
            if link['predecessor'] not in uids:raise ValueError('Unresolved XML predecessor UID')
            link['predecessor']=uids[link['predecessor']]
    result=validate(rows);result['warnings']+=['Restricted task XML with named ExtendedAttribute measurement fields. Calendars/resources are not imported; dependency lag is retained in source units without CPM calculation.'];return result
