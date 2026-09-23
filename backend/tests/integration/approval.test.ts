import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID,scryptSync} from 'node:crypto';
test('real PostgreSQL approval and HTTP integration',{skip:!process.env.TEST_DATABASE_URL},async t=>{
 const c=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await c.connect();let apiPool:any,server:any,evidenceReport:any;
 try{
  assert.match((await c.query('SELECT current_database() AS name')).rows[0].name,/^p2f_test_/);
  process.env.DATABASE_URL=process.env.TEST_API_DATABASE_URL;process.env.APP_ORIGIN='http://localhost:8080';assert.ok(process.env.DATABASE_URL);
  const {pool}=await import('../../src/db/pool.js');apiPool=pool;
  assert.equal((await pool.query('SELECT current_user AS name')).rows[0].name,'p2f_api');
  const {approve}=await import('../../src/services/approvalService.js');
  const {submitReport}=await import('../../src/services/reportService.js');
  const user=(await c.query("INSERT INTO users(email,password_hash,name) VALUES('test@example.test',$1,'Test reviewer') RETURNING id",['salt:'+scryptSync('TestPassword123!','salt',64).toString('hex')])).rows[0].id;
  const project=(await c.query("INSERT INTO projects(code,name,reporting_date) VALUES('APPROVAL','Test','2026-09-15') RETURNING id")).rows[0].id;
  const other=(await c.query("SELECT id FROM projects WHERE code='TEST2'")).rows[0].id;
  await c.query("INSERT INTO project_memberships VALUES($1,$2,'REVIEWER')",[project,user]);
  const version=(await c.query("INSERT INTO schedule_versions(project_id,version_number,source_format,source_filename,source_hash,import_status) VALUES($1,1,'CSV','test','test','VALIDATED') RETURNING id",[project])).rows[0].id;
  await c.query('UPDATE projects SET active_schedule_version_id=$2 WHERE id=$1',[project,version]);
  const activity=(await c.query("INSERT INTO schedule_activities(project_id,schedule_version_id,external_activity_id,description,wbs_path,activity_type,line_number,planned_total_quantity,quantity_unit,measurement_method) VALUES($1,$2,'A','Erect line 24','TEST.PIPING','ERECTION','24',10,'spool','EQUAL_COMPONENTS') RETURNING id",[project,version])).rows[0].id;
  await c.query("INSERT INTO activity_baselines(project_id,schedule_version_id,activity_id,baseline_start,baseline_finish,measurement_metadata,provenance) VALUES($1,$2,$3,'2026-09-10','2026-09-20','{}','{}')",[project,version,activity]);
  for(let i=1;i<=10;i++)await c.query('INSERT INTO activity_components(activity_id,external_id,weight) VALUES($1,$2,1)',[activity,'S'+String(i).padStart(2,'0')]);
  const data={source_type:'TEXT',original_text:'Line 24 erection started on 12 September 2026.',reporting_date:'2026-09-15',captured_at:'2026-09-15T00:00:00.000Z',idempotency_key:randomUUID()};
  const report=await submitReport(project,user,data);let sequence=0;
  async function proposal(event:any,rowVersion:number){const e=(await c.query('INSERT INTO report_events(site_report_id,project_id,event_index,event_type,extracted_fields,evidence,extraction_version) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[report.id,project,sequence++,event.event_type,JSON.stringify(event),'{}','test-v1'])).rows[0].id;return (await c.query("INSERT INTO staged_proposals(report_event_id,project_id,schedule_version_id,selected_activity_id,candidate_matches,proposed_changes,expected_activity_row_version,model_version,routing_status,explanation) VALUES($1,$2,$3,$4,'[]',$5,$6,'unit-fixture','REVIEW_NEEDED','Transaction test fixture') RETURNING id",[e,project,version,activity,JSON.stringify(event),rowVersion])).rows[0].id;}
  const start={event_type:'START',event_date:'2026-09-12',action:'ERECTION',line_number:'24',area:null,discipline:null,quantity:null,unit:null,quantity_mode:null,component_ids:[]};
  await t.test('runtime protected table UPDATE/DELETE attempts denied',async()=>{for(const table of ['activity_baselines','progress_events','audit_events']){await assert.rejects(()=>pool.query(`DELETE FROM ${table}`),/permission denied/);await assert.rejects(()=>pool.query(`UPDATE ${table} SET id=id`),/permission denied/);}});
  await t.test('report idempotency and payload conflicts',async()=>{assert.equal((await submitReport(project,user,data)).id,report.id);await assert.rejects(()=>submitReport(project,user,{...data,original_text:'Different'}),(e:any)=>e.status===409);});
  await t.test('concurrent approvals commit once',async()=>{const id=await proposal(start,1);const results=await Promise.all([approve(project,id,1,user,'t1'),approve(project,id,1,user,'t2')]);assert.equal(results[0].id,results[1].id);assert.equal((await c.query('SELECT count(*)::int n FROM progress_events WHERE proposal_id=$1',[id])).rows[0].n,1);});
  await t.test('stale activity and proposal conflict',async()=>{const id=await proposal(start,1);await assert.rejects(()=>approve(project,id,1,user,'stale'),(e:any)=>e.status===409);const fresh=await proposal(start,2);await assert.rejects(()=>approve(project,fresh,99,user,'version'),(e:any)=>e.status===409);});
  await t.test('components duplicate replay and correction preserve ledger',async()=>{const event={...start,event_type:'PROGRESS',event_date:'2026-09-15',quantity_mode:'COMPONENT_SET',unit:'spool',component_ids:['S01','S02','S03']};const id=await proposal(event,2);const accepted=await approve(project,id,1,user,'partial');assert.equal(accepted.after_state.physical_percent_complete,'30');const duplicate=await proposal(event,3);assert.equal((await approve(project,duplicate,1,user,'repeat')).after_state.accepted_quantity,'3');const correction=await proposal({...event,event_type:'CORRECTION',correction_of_event_id:accepted.id,reconciliation_reason:'S03 reported in error',component_ids:['S01','S02']},4);assert.equal((await approve(project,correction,1,user,'correction')).after_state.physical_percent_complete,'20');assert.equal((await c.query('SELECT after_state FROM progress_events WHERE id=$1',[accepted.id])).rows[0].after_state.physical_percent_complete,'30');});
  await t.test('transaction failure rolls back all actual updates',async()=>{await c.query("CREATE FUNCTION test_fail_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected outbox failure'; END $$; CREATE TRIGGER test_outbox BEFORE INSERT ON export_outbox FOR EACH ROW EXECUTE FUNCTION test_fail_outbox()");const before=(await c.query('SELECT row_version FROM schedule_activities WHERE id=$1',[activity])).rows[0].row_version;const id=await proposal(start,before);await assert.rejects(()=>approve(project,id,1,user,'rollback'),/injected outbox failure/);assert.equal((await c.query('SELECT count(*)::int n FROM progress_events WHERE proposal_id=$1',[id])).rows[0].n,0);assert.equal((await c.query('SELECT row_version FROM schedule_activities WHERE id=$1',[activity])).rows[0].row_version,before);await c.query('DROP TRIGGER test_outbox ON export_outbox');});
  await t.test('report role snapshot, immutable creation audit and enterprise export',async()=>{
   assert.equal(report.reporter_role,'REVIEWER');
   assert.equal((await c.query("SELECT count(*)::int n FROM audit_events WHERE entity_id=$1 AND action='REPORT_SUBMITTED'",[report.id])).rows[0].n,1);
   assert.ok((await c.query("SELECT count(*)::int n FROM audit_events WHERE project_id=$1 AND action='AI_STAGED'",[project])).rows[0].n>0);
   const {exportsForProject}=await import('../../src/services/exportService.js');
   const data=await exportsForProject(pool,project);
   assert.equal(data.records.length,4);assert.ok(data.records.every((r:any)=>r.ApprovedBy===user && r.ActivityId==='A' && r.ReporterRole==='REVIEWER'));
   const csv=await exportsForProject(pool,project,'csv');assert.match(csv,/ActualStartDate,ActualFinishDate,PhysicalPercentComplete/);
  });
  await t.test('GPS/photos, direct successors and approved evidence reach the outbox',async()=>{
   await c.query('UPDATE projects SET site_latitude=0,site_longitude=0,geofence_radius_m=1000 WHERE id=$1',[project]);
   const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE6kAAAAASUVORK5CYII=','base64');
   const photo={buffer:png,originalname:'site.png',mimetype:'image/png'} as any;
   const d={...data,idempotency_key:randomUUID(),latitude:0,longitude:0,gps_accuracy_m:5,delay_reason:'MATERIAL_SHORTAGE'};
   evidenceReport=await submitReport(project,user,d,undefined,[photo]);
   assert.equal(evidenceReport.geofence_status,'VERIFIED');assert.equal(evidenceReport.evidence_urls.length,1);
   assert.equal((await submitReport(project,user,d,undefined,[photo])).id,evidenceReport.id);
   await assert.rejects(()=>submitReport(project,user,{...d,longitude:1},undefined,[photo]),(e:any)=>e.status===409);
   const successors=(await c.query("INSERT INTO schedule_activities(project_id,schedule_version_id,external_activity_id,description,wbs_path,activity_type,planned_total_quantity,quantity_unit,measurement_method) VALUES($1,$2,'PIP-0235','Direct successor','TEST','ERECTION',1,'unit','QUANTITY'),($1,$2,'PIP-0236','Grandchild','TEST','ERECTION',1,'unit','QUANTITY') RETURNING id,external_activity_id",[project,version])).rows;
   await c.query("INSERT INTO activity_relationships(project_id,schedule_version_id,predecessor,successor,relationship_type) VALUES($1,$2,$3,$4,'FS'),($1,$2,$4,$5,'FS')",[project,version,activity,successors[0].id,successors[1].id]);
   const event=(await c.query("INSERT INTO report_events(site_report_id,project_id,event_index,event_type,extracted_fields,evidence,extraction_version) VALUES($1,$2,0,'START',$3,'{}','evidence-test') RETURNING id",[evidenceReport.id,project,JSON.stringify(start)])).rows[0];
   const rowVersion=(await c.query('SELECT row_version FROM schedule_activities WHERE id=$1',[activity])).rows[0].row_version;
   const p=(await c.query("INSERT INTO staged_proposals(report_event_id,project_id,schedule_version_id,selected_activity_id,candidate_matches,proposed_changes,expected_activity_row_version,model_version,routing_status,explanation) VALUES($1,$2,$3,$4,'[]',$5,$6,'test','REVIEW_NEEDED','evidence test') RETURNING *",[event.id,project,version,activity,JSON.stringify(start),rowVersion])).rows[0];
   assert.equal(p.geofence_status,'VERIFIED');assert.deepEqual(p.affected_successor_ids,['PIP-0235']);
   const changed=(await c.query('UPDATE staged_proposals SET selected_activity_id=$2 WHERE id=$1 RETURNING affected_successor_ids',[p.id,successors[0].id])).rows[0];
   assert.deepEqual(changed.affected_successor_ids,['PIP-0236']);
   await c.query('UPDATE staged_proposals SET selected_activity_id=$2 WHERE id=$1',[p.id,activity]);
   const accepted=await approve(project,p.id,1,user,'evidence-approval');
   const outbox=(await c.query('SELECT payload,status FROM export_outbox WHERE progress_event_id=$1',[accepted.id])).rows[0];
   assert.equal(outbox.payload.approval_status,'APPROVED');assert.equal(outbox.status,'UNCONFIRMED');
   assert.deepEqual(outbox.payload.affected_successor_ids,['PIP-0235']);assert.equal(outbox.payload.evidence.evidence_urls.length,1);
   const {exportsForProject}=await import('../../src/services/exportService.js');
   const xer=await exportsForProject(pool,project,'xer-json');assert.ok(xer.TASK.some((r:any)=>r.IdempotencyKey===accepted.id && r.delay_reason==='MATERIAL_SHORTAGE' && r.affected_successor_ids[0]==='PIP-0235'));
   const {directSuccessors}=await import('../../src/services/evidenceService.js');
   assert.equal((await directSuccessors(pool,other,version,activity)).length,0);
  });
  await t.test('HTTP project isolation and CSRF',async()=>{const {app}=await import('../../src/app.js');server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:8080'},body:JSON.stringify({email:'test@example.test',password:'TestPassword123!'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie')!.split(';')[0];const evidencePath='/api'+evidenceReport.evidence_urls[0].url;
   assert.equal((await fetch(base+evidencePath)).status,401);
   const image=await fetch(base+evidencePath,{headers:{Cookie:cookie}});assert.equal(image.status,200);assert.match(image.headers.get('content-type')!,/image\/png/);
   assert.equal((await fetch(base+evidencePath.replace(project,other),{headers:{Cookie:cookie}})).status,403);
   assert.equal((await fetch(base+`/api/projects/${other}/activities`,{headers:{Cookie:cookie}})).status,403);assert.equal((await fetch(base+`/api/projects/${project}/reports`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(data)})).status,403);});
  await t.test('demo identities preserve passwords, role guards, sessions and report lineage',async()=>{
   const base='http://127.0.0.1:'+server.address().port;
   for(const [email,role] of [['engineer@plan2field.ai','ENGINEER'],['planner@plan2field.ai','REVIEWER']]){
    const id=(await c.query("INSERT INTO users(email,password_hash,name,discipline) VALUES($1,$2,$3,'PIPING') RETURNING id",[email,'demo-salt:'+scryptSync('ChangeThisDemoPassword123!','demo-salt',64).toString('hex'),role])).rows[0].id;
    await c.query('INSERT INTO project_memberships VALUES($1,$2,$3)',[project,id,role]);
    const request=(password:string)=>fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:8080'},body:JSON.stringify({email,password})});
    assert.equal((await request('wrong')).status,401);
    const response=await request('ChangeThisDemoPassword123!');assert.equal(response.status,200);
    const profile:any=await response.json();assert.equal(profile.userId,id);assert.equal(profile.discipline,'PIPING');assert.equal(profile.memberships[0].role,role);
    const headers={Cookie:response.headers.get('set-cookie')!.split(';')[0],Origin:'http://localhost:8080','X-CSRF-Token':profile.csrf_token,'Content-Type':'application/json'};
    const me:any=await (await fetch(base+'/api/auth/me',{headers})).json();assert.equal(me.id,id);
    assert.equal((await fetch(base+`/api/projects/${project}/geofence`,{method:'PATCH',headers,body:JSON.stringify({latitude:0,longitude:0,radius_m:1000})})).status,role==='ENGINEER'?403:200);
    assert.equal((await fetch(base+`/api/projects/${other}/activities`,{headers})).status,403);
    const reportResponse=await fetch(base+`/api/projects/${project}/reports`,{method:'POST',headers,body:JSON.stringify({...data,idempotency_key:randomUUID()})});assert.equal(reportResponse.status,202);
    const stored=(await c.query('SELECT submitted_by,reporter_role FROM site_reports WHERE submitted_by=$1',[id])).rows[0];assert.equal(stored.submitted_by,id);assert.equal(stored.reporter_role,role);
   }
  });
 }finally{if(server)await new Promise<void>(r=>server.close(()=>r()));if(apiPool)await apiPool.end();await c.end();}
});
