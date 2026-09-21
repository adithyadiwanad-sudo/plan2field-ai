"""Emit shared Pydantic event schema and an executable OpenAPI 3.1 contract."""
import sys,json
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'ml_worker'))
from schemas import Event
(root/'shared').mkdir(exist_ok=True)
event=Event.model_json_schema();(root/'shared/event.schema.json').write_text(json.dumps(event,indent=2))
proposal={'type':'object','required':['id','project_id','schedule_version_id','proposed_changes','routing_status','lifecycle_status','proposal_version'],'properties':{'id':{'type':'string','format':'uuid'},'project_id':{'type':'string','format':'uuid'},'schedule_version_id':{'type':'string','format':'uuid'},'proposed_changes':{'$ref':'event.schema.json'},'candidate_matches':{'type':'array','items':{'type':'object'}},'routing_status':{'enum':['AUTO_STAGED','REVIEW_NEEDED','REJECTED']},'lifecycle_status':{'enum':['PENDING','CLARIFICATION_REQUESTED','APPROVED','REJECTED','STALE','SUPERSEDED']},'proposal_version':{'type':'integer','minimum':1},'match_score':{'type':['number','null']},'score_type':{'const':'HEURISTIC'},'calibrated_probability':{'type':'null'}}}
(root/'shared/proposal.schema.json').write_text(json.dumps(proposal,indent=2))
schemas={'Event':event,'Error':{'type':'object','required':['code','message','fieldErrors','requestId'],'properties':{'code':{'type':'string'},'message':{'type':'string'},'fieldErrors':{'type':'object'},'requestId':{'type':'string'}}},'ProposalVersion':{'type':'object','required':['proposal_version'],'properties':{'proposal_version':{'type':'integer','minimum':1}}},'ReviewReason':{'type':'object','required':['proposal_version','reason'],'properties':{'proposal_version':{'type':'integer','minimum':1},'reason':{'type':'string','minLength':3,'maxLength':2000}}},'ReportSubmission':{'type':'object','required':['source_type','reporting_date','captured_at','idempotency_key'],'properties':{'source_type':{'enum':['TEXT','VOICE','SPREADSHEET','SCAN']},'original_text':{'type':'string','maxLength':50000},'reporting_date':{'type':'string','format':'date'},'captured_at':{'type':'string','format':'date-time'},'idempotency_key':{'type':'string','format':'uuid'},'file':{'type':'string','format':'binary'},'mapping':{'type':'string','description':'JSON object mapping text to a spreadsheet column header'}}}}
paths={}
def add(path,method,summary,body=None,status='200',public=False,multipart=False,pagination=False):
    operation={'summary':summary,'operationId':method+'_'+path.replace('/','_').replace('{','').replace('}',''),'responses':{status:{'description':'Successful response; reports/imports use asynchronous processing'},'400':{'description':'Validation failure','content':{'application/json':{'schema':{'$ref':'#/components/schemas/Error'}}}},'401':{'description':'Sign-in required'},'403':{'description':'Project role or CSRF check failed'},'409':{'description':'Stale version or idempotency conflict'},'422':{'description':'Business-rule validation failed'},'503':{'description':'Dependency unavailable'}},'security':[] if public else [{'sessionCookie':[]}]}
    import re
    params=[{'name':name,'in':'path','required':True,'schema':{'type':'string','format':'uuid'}} for name in re.findall(r'\{(.*?)\}',path)]
    if method!='get' and not public:params.append({'name':'X-CSRF-Token','in':'header','required':True,'schema':{'type':'string'},'description':'Token from /auth/me. Browser Origin must equal APP_ORIGIN.'})
    if pagination:params.extend([{'name':'limit','in':'query','schema':{'type':'integer','minimum':1,'maximum':200,'default':100}},{'name':'offset','in':'query','schema':{'type':'integer','minimum':0,'default':0}}])
    if params:operation['parameters']=params
    if body:operation['requestBody']={'required':True,'content':{'multipart/form-data' if multipart else 'application/json':{'schema':body}}}
    paths.setdefault('/api'+path,{})[method]=operation
ref=lambda name:{'$ref':'#/components/schemas/'+name}
add('/auth/login','post','Start HttpOnly session',{'type':'object','required':['email','password'],'properties':{'email':{'type':'string','format':'email'},'password':{'type':'string'}}},public=True)
add('/auth/logout','post','End session',status='204');add('/auth/me','get','Current user and CSRF token')
add('/projects','get','Projects visible to the current user');add('/projects/{projectId}','get','Project and active schedule')
base='/projects/{projectId}'
add(base+'/schedule-imports','post','Queue schedule preview and embedding',{'type':'object','required':['file','format','baseline_confirmed'],'properties':{'file':{'type':'string','format':'binary'},'format':{'enum':['CSV','XER','XML']},'baseline_confirmed':{'type':'string','const':'true'},'min_wbs_depth':{'type':'integer','minimum':0,'maximum':20}}},status='202',multipart=True)
add(base+'/schedule-imports/{importId}','get','Import status, preview rows and validation errors');add(base+'/schedule-imports/{importId}/activate','post','Activate validated schedule; reviewer role')
for resource in ['activities','reports','proposals']:
    add(base+'/'+resource,'get','List project '+resource,pagination=True)
    add(base+'/'+resource+'/{'+resource[:-3]+'yId}' if resource=='activities' else base+'/'+resource+'/{'+resource[:-1]+'Id}','get','Get scoped '+resource[:-1])
add(base+'/reports','post','Queue idempotent report processing',ref('ReportSubmission'),status='202',multipart=True)
add(base+'/reports/{reportId}/audio','get','Authorized original audio replay')
add(base+'/reports/{reportId}/clarifications','post','Append clarification as new report evidence',ref('ReportSubmission'),status='202')
add(base+'/proposals/{proposalId}','patch','Revise and revalidate candidate selection',{'type':'object','required':['proposal_version','selected_activity_id','proposed_changes'],'properties':{'proposal_version':{'type':'integer'},'selected_activity_id':{'type':'string','format':'uuid'},'proposed_changes':ref('Event')}})
add(base+'/proposals/{proposalId}/validate','post','Preview server-validated actuals without committing',{'type':'object','required':['selected_activity_id','proposed_changes'],'properties':{'selected_activity_id':{'type':'string','format':'uuid'},'proposed_changes':ref('Event')}})
for action in ['approve','clarify','reject']:add(base+'/proposals/{proposalId}/'+action,'post','Reviewer '+action,ref('ProposalVersion' if action=='approve' else 'ReviewReason'))
for resource in ['variance','audit','exports']:add(base+'/'+resource,'get','Read '+resource,pagination=resource!='exports')
add(base+'/closeout','post','Approve project closeout into historical records',{'type':'object','required':['reason'],'properties':{'reason':{'type':'string','minLength':5}}})
add('/history/comparables','get','Filter comparable records; synthetic excluded by default',pagination=True)
for name in ['live','ready']:add('/health/'+name,'get','Health: '+name,public=True)
spec={'openapi':'3.1.0','info':{'title':'Plan2Field AI','version':'0.1.0','description':'Local prototype. All actual mutations require project review. No external scheduling writes.'},'servers':[{'url':'http://localhost:8080'}],'paths':paths,'components':{'securitySchemes':{'sessionCookie':{'type':'apiKey','in':'cookie','name':'session'}},'schemas':schemas}}
# JSON is valid YAML 1.2; avoid a generator dependency.
(root/'backend/openapi.yaml').write_text(json.dumps(spec,indent=2))
print('Generated shared schemas and OpenAPI contract.')
