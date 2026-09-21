from pathlib import Path
from psycopg.types.json import Jsonb
from config import UPLOAD_DIR
from database import connect
from embeddings import embed_activities
from parsers import canonical_csv,primavera_xer,ms_project_xml
def process_import(payload):
    with connect() as conn:version=conn.execute('SELECT * FROM schedule_versions WHERE id=%s',(payload['version_id'],)).fetchone()
    if version['import_status']=='VALIDATED':return
    import uuid
    data=(Path(UPLOAD_DIR)/str(uuid.UUID(payload['storage_ref']))).read_bytes()
    result={'CSV':canonical_csv,'XER':primavera_xer,'XML':ms_project_xml}[version['source_format']].parse(data)
    if not payload.get('baseline_confirmed'):result['errors'].append({'message':'Explicit approved baseline mapping confirmation is required'})
    result['rows']=[r for r in result['rows'] if len(r.get('wbs_path','').split('.'))>=payload.get('min_wbs_depth',0)]
    if not result['rows']:result['errors'].append({'message':'No eligible activities'})
    with connect() as conn:
        conn.execute('UPDATE schedule_versions SET validation_summary=%s,import_status=%s WHERE id=%s',(Jsonb(result),'INVALID' if result['errors'] else 'EMBEDDING',version['id']))
    if result['errors']:return
    # All inserts and embeddings commit together; failed inference cannot partially import.
    with connect() as conn:
        locked=conn.execute('SELECT * FROM schedule_versions WHERE id=%s FOR UPDATE',(version['id'],)).fetchone()
        if locked['import_status']=='VALIDATED':return
        activities=[]
        for r in result['rows']:
            a=conn.execute('INSERT INTO schedule_activities(project_id,schedule_version_id,external_activity_id,description,wbs_path,discipline,area,line_number,asset_tag,activity_type,planned_total_quantity,quantity_unit,measurement_method,source_metadata,forecast_start,forecast_finish) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *',(version['project_id'],version['id'],r['external_activity_id'],r['description'],r['wbs_path'],r.get('discipline') or None,r.get('area') or None,r.get('line_number') or None,r.get('asset_tag') or None,r['activity_type'],r['planned_total_quantity'],r['quantity_unit'],r['measurement_method'],Jsonb(r),r.get('forecast_start') or None,r.get('forecast_finish') or None)).fetchone()
            conn.execute('INSERT INTO activity_baselines(project_id,schedule_version_id,activity_id,baseline_start,baseline_finish,baseline_quantity,measurement_metadata,provenance) VALUES(%s,%s,%s,%s,%s,%s,%s,%s)',(a['project_id'],a['schedule_version_id'],a['id'],r.get('baseline_start') or None,r.get('baseline_finish') or None,r['planned_total_quantity'],Jsonb({'method':r['measurement_method']}),Jsonb({'confirmed_by':str(version['imported_by']),'source_hash':version['source_hash'],'mapping':'explicit canonical baseline fields'})))
            if r.get('components'):
                ids=r['components'].split('|');weights=r.get('weights','').split('|') if r.get('weights') else ['1']*len(ids)
                for component,weight in zip(ids,weights):conn.execute('INSERT INTO activity_components(activity_id,external_id,weight) VALUES(%s,%s,%s)',(a['id'],component,weight))
            activities.append(a)
        embed_activities(conn,activities)
        by_external={a['external_activity_id']:a['id'] for a in activities}
        for row in result['rows']:
            for rel in row.get('relationships',[]):
                conn.execute('INSERT INTO activity_relationships(project_id,schedule_version_id,predecessor,successor,relationship_type,lag,source_metadata) VALUES(%s,%s,%s,%s,%s,%s,%s)',(version['project_id'],version['id'],by_external[rel['predecessor']],by_external[row['external_activity_id']],rel.get('type','FS'),rel.get('lag',0),Jsonb(rel)))
        conn.execute("UPDATE schedule_versions SET import_status='VALIDATED' WHERE id=%s",(version['id'],))
