import csv,io,json
from datetime import date
from decimal import Decimal
REQUIRED=['external_activity_id','description','wbs_path','activity_type','planned_total_quantity','quantity_unit','measurement_method']
def validate(rows):
    errors=[];seen=set()
    for index,row in enumerate(rows,2):
        try:
            for key in REQUIRED:
                if not row.get(key):raise ValueError(f'Missing {key}')
            if row['external_activity_id'] in seen:raise ValueError('Duplicate external activity ID')
            seen.add(row['external_activity_id'])
            if not Decimal(row['planned_total_quantity']).is_finite() or Decimal(row['planned_total_quantity'])<=0:raise ValueError('Quantity must be positive and finite')
            if row['measurement_method'] not in ('QUANTITY','EQUAL_COMPONENTS','WEIGHTED_COMPONENTS'):raise ValueError('Unsupported measurement method')
            for key in ('baseline_start','baseline_finish','forecast_start','forecast_finish'):
                if row.get(key):date.fromisoformat(row[key])
            if row.get('baseline_start') and row.get('baseline_finish') and row['baseline_finish']<row['baseline_start']:raise ValueError('Baseline finish precedes start')
            if row['measurement_method']!='QUANTITY':
                ids=(row.get('components') or '').split('|')
                if not all(ids) or len(ids)!=len(set(ids)):raise ValueError('Unique component IDs required')
                if Decimal(len(ids))!=Decimal(row['planned_total_quantity']):raise ValueError('Component count must equal total quantity')
                weights=(row.get('weights') or '').split('|')
                if row['measurement_method']=='WEIGHTED_COMPONENTS' and (len(weights)!=len(ids) or any(not Decimal(w).is_finite() or Decimal(w)<=0 for w in weights)):raise ValueError('Positive weight per component required')
        except Exception as exc:errors.append({'row':index,'message':str(exc)})
    if not rows:errors.append({'row':1,'message':'No schedule activities'})
    for index,row in enumerate(rows,2):
        try:
            relationships=row.get('relationships') or []
            if isinstance(relationships,str):relationships=json.loads(relationships)
            if not isinstance(relationships,list):raise ValueError('Relationships must be a JSON array')
            unique=set()
            for rel in relationships:
                predecessor=rel['predecessor'];kind=rel.get('type','FS');lag=Decimal(str(rel.get('lag',0)))
                if predecessor not in seen or predecessor==row.get('external_activity_id'):raise ValueError('Unknown or self-referencing predecessor')
                if kind not in ('FS','SS','FF','SF') or not lag.is_finite():raise ValueError('Invalid relationship type/lag')
                if predecessor in unique:raise ValueError('Duplicate predecessor relationship')
                unique.add(predecessor)
            row['relationships']=relationships
        except Exception as exc:errors.append({'row':index,'message':str(exc)})
    return {'rows':rows,'errors':errors,'warnings':['Calendar-day dates only; calendars and CPM are not calculated.']}
def parse(data):
    text=data.decode('utf-8-sig');reader=csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or not set(REQUIRED)<=set(reader.fieldnames):raise ValueError('Missing canonical CSV headers')
    rows=list(reader)
    if len(rows)>10000:raise ValueError('Schedule exceeds 10,000 rows')
    return validate(rows)
