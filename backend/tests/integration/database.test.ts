import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
const url=process.env.TEST_DATABASE_URL;
test('schema and role protection on a disposable real PostgreSQL database',{skip:!url},async()=>{
 const c=new pg.Client({connectionString:url});await c.connect();
 try{
  const name=(await c.query('SELECT current_database() AS name')).rows[0].name;
  assert.match(name,/^p2f_test_/,'Only an explicitly disposable p2f_test_ database is accepted');
  const schema=await readFile(new URL('../../../database/schema.sql',import.meta.url),'utf8');
  assert.equal(schema,await readFile(new URL('../../../database/migrations/001_initial.sql',import.meta.url),'utf8'));
  await c.query(schema);
  const grants=(await readFile(new URL('../../../database/roles.sql',import.meta.url),'utf8')).split('\n').filter(l=>!l.startsWith('CREATE ROLE')&&!l.startsWith('GRANT CONNECT')).join('\n');
  await c.query(grants);
  const vector=(await c.query("SELECT extversion FROM pg_extension WHERE extname='vector'")).rows[0];assert.ok(vector);
  for(const role of ['p2f_api','p2f_worker']){
   const exists=(await c.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rows.length;assert.ok(exists,'Bootstrap roles first');
   for(const table of ['activity_baselines','progress_events','audit_events']){
    const permissions=(await c.query('SELECT has_table_privilege($1,$2,\'UPDATE\') AS u,has_table_privilege($1,$2,\'DELETE\') AS d',[role,table])).rows[0];assert.equal(permissions.u,false);assert.equal(permissions.d,false);
   }
  }
  const p=(await c.query("INSERT INTO projects(code,name,reporting_date) VALUES('TEST1','Test','2026-09-15'),('TEST2','Other','2026-09-15') RETURNING id")).rows;
  const v=(await c.query("INSERT INTO schedule_versions(project_id,version_number,source_format,source_filename,source_hash) VALUES($1,1,'CSV','test','test') RETURNING id",[p[0].id])).rows[0];
  await assert.rejects(()=>c.query("INSERT INTO schedule_activities(project_id,schedule_version_id,external_activity_id,description,wbs_path,activity_type,planned_total_quantity,quantity_unit,measurement_method) VALUES($1,$2,'X','X','X','ERECTION',10,'spool','QUANTITY')",[p[1].id,v.id]),/foreign key/);
 }finally{await c.end();}
});
