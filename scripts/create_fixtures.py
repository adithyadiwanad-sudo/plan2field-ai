"""Reproducible synthetic fixture generator; never modifies a database."""
import csv,json
from pathlib import Path
from xml.etree.ElementTree import Element,SubElement,tostring
root=Path(__file__).resolve().parents[1]/'database'/'fixtures';root.mkdir(exist_ok=True)
fields=['external_activity_id','description','wbs_path','discipline','area','line_number','activity_type','planned_total_quantity','quantity_unit','measurement_method','baseline_start','baseline_finish','components','weights']
rows=[]
def add(id,description,line,operation,area='NORTH',discipline='PIPING'):
    rows.append(dict(zip(fields,[id,description,f'OIL-DEMO.{area}.{discipline}.{operation}',discipline,area,line,operation,'10','spool','EQUAL_COMPONENTS','2026-09-10','2026-09-20','|'.join(f'S{i:02}' for i in range(1,11)),'' ])))
add('ACT-24-SPOOL-01','Erect Pipe Line 24-XX','24','ERECTION')
add('ACT-42-SPOOL-01','Erect Pipe Line 42-XX','42','ERECTION')
add('ACT-24-FAB-01','Fabricate spools for Pipe Line 24','24','FABRICATION')
add('ACT-24-TEST-01','Hydrotest Pipe Line 24','24','TESTING')
add('ACT-CIV-24-01','Construct foundation F24','','CIVIL',discipline='CIVIL')
for line in ['12','18','27','36','48']:
    for operation,verb in [('ERECTION','Erect'),('FABRICATION','Fabricate'),('TESTING','Hydrotest'),('WELDING','Weld'),('INSPECTION','Inspect')]:
        add(f'ACT-{line}-{operation[:3]}-01',f'{verb} spools for Pipe Line {line}',line,operation,area='SOUTH')
with (root/'demo_schedule.csv').open('w',newline='',encoding='utf-8') as f:
    writer=csv.DictWriter(f,fieldnames=fields);writer.writeheader();writer.writerows(rows)
xer=['ERMHDR\tSYNTHETIC DEMO DATA','%T\tTASK','%F\t'+'\t'.join(['task_code','task_name']+fields[2:])]
xer+=['%R\t'+'\t'.join(str(r[k]) for k in fields) for r in rows];xer+=['%E']
(root/'demo_schedule.xer').write_text('\n'.join(xer),encoding='utf-8')
project=Element('Project');tasks=SubElement(project,'Tasks')
for uid,row in enumerate(rows,1):
    task=SubElement(tasks,'Task')
    SubElement(task,'UID').text=str(uid)
    for key,col in [('Name','description'),('WBS','wbs_path')]:SubElement(task,key).text=row[col]
    for key in ['external_activity_id']+fields[3:]:
        attr=SubElement(task,'ExtendedAttribute');SubElement(attr,'FieldName').text=key;SubElement(attr,'Value').text=row[key]
(root/'demo_schedule.xml').write_bytes(tostring(project,encoding='utf-8',xml_declaration=True))
reports=[
 ('CLEAN_START','Line twenty-four spool erection started on 12 September 2026 in the north area.','START','ACT-24-SPOOL-01'),
 ('AMBIGUOUS','Spool erection started in the north area on 12 September 2026.','START',None),
 ('PARTIAL','On line 24, spools S01, S02 and S03 are erected. Three out of ten are complete in total as of 15 September 2026.','PROGRESS','ACT-24-SPOOL-01'),
 ('FUTURE','We will start erecting line 24 tomorrow.','PLAN',None),
 ('NEGATION','Line 24 erection has not started.','UNKNOWN',None),
 ('CORRECTION','Correction: S03 was reported in error; only S01 and S02 are erected.','CORRECTION',None),
 ('WRONG_OPERATION','Hydrotest completed on line 24 on 15 September 2026.','FINISH','ACT-24-TEST-01'),
 ('NO_MATCH','Line 999 insulation started on 12 September 2026.','START',None)]
(root/'demo_reports.json').write_text(json.dumps([{'name':n,'text':t,'event_type':e,'activity':a,'provenance':'SYNTHETIC'} for n,t,e,a in reports],indent=2))
heldout=[('Line 42 spool erection commenced in the north area on 13 September 2026.','START','ACT-42-SPOOL-01'),('Fabrication started on line 24 on 14 September 2026.','START','ACT-24-FAB-01'),('We will erect line 24 tomorrow.','PLAN',None),('Line 42 has not started erection.','UNKNOWN',None),('Line 888 welding started on 14 September 2026.','START',None),('Spool erection commenced in the north area on 14 September 2026.','START',None)]
(root/'heldout_reports.json').write_text(json.dumps([{'text':t,'event_type':e,'activity':a,'provenance':'SYNTHETIC_HELDOUT'} for t,e,a in heldout],indent=2))
(root/'expected_outcomes.json').write_text(json.dumps({'clean_start_variance_days':2,'partial_quantity':3,'partial_percent':30,'partial_finish':None,'all_data':'SYNTHETIC DEMO DATA'},indent=2))
(root/'historical_projects.json').write_text(json.dumps([{'code':f'HIST-DEMO-{i}','quantity':10+i*2,'baseline_start':'2026-07-01','baseline_finish':'2026-07-11','actual_start':'2026-07-01','actual_finish':f'2026-07-{12+i:02}','reason':reason,'provenance':'SYNTHETIC'} for i,reason in enumerate(['Illustrative permit hold','Illustrative crane availability','Illustrative access restriction'],1)],indent=2))
print(f'Wrote {len(rows)} synthetic activities and report fixtures.')
