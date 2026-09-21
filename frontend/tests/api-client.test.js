import test from 'node:test';
import assert from 'node:assert/strict';
import {api,apiUrl,setCsrf} from '../src/api/client.js';
import {restoreDemoSession} from '../src/api/auth.js';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});

test('auth requests use Render API fallback and include session cookies',async t=>{
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(url,'https://plan2field-backend.onrender.com/api/auth/login');
  assert.equal(options.credentials,'include');
  assert.equal(options.headers['Content-Type'],'application/json');
  return json({id:'demo'});
 });
 assert.deepEqual(await api('/auth/login',{method:'POST',body:{email:'demo@example.test',password:'test'}}),{id:'demo'});
 assert.equal(apiUrl('/projects/test/exports?format=json'),'https://plan2field-backend.onrender.com/api/projects/test/exports?format=json');
});
test('HTML failures produce a useful API error instead of a JSON parse exception',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('The page could not be found',{status:404,headers:{'Content-Type':'text/html'}}));
 await assert.rejects(()=>api('/auth/me'),e=>e.code==='INVALID_API_RESPONSE' && e.status===404 && /VITE_API_BASE_URL/.test(e.message));
});
test('multipart uploads keep browser boundary and send CSRF with credentials',async t=>{
 setCsrf('csrf-test');const body=new FormData();body.append('discipline','CIVIL');
 t.mock.method(globalThis,'fetch',async(_url,options)=>{
  assert.equal(options.body,body);assert.equal(options.headers['Content-Type'],undefined);
  assert.equal(options.headers['X-CSRF-Token'],'csrf-test');return json({id:'report'});
 });
 await api('/projects/test/reports',{method:'POST',body});setCsrf('');
});
test('an existing session is reused without logging in',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async url=>{calls.push(url);return json({id:'existing'});});
 assert.equal((await restoreDemoSession()).id,'existing');assert.equal(calls.length,1);assert.ok(calls[0].endsWith('/api/auth/me'));
});
test('startup shares one request and logs in only after an unauthenticated response',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push(url);
  if(url.endsWith('/auth/me'))return json({code:'UNAUTHENTICATED',message:'Sign in'},401);
  assert.ok(url.endsWith('/api/auth/login'));assert.equal(JSON.parse(options.body).email,'reviewer@plan2field.local');
  return json({id:'demo',csrf_token:'token'});
 });
 const first=restoreDemoSession(),second=restoreDemoSession();assert.equal(first,second);
 assert.equal((await first).id,'demo');assert.equal(calls.length,2);
});
test('backend failures do not trigger demo login retries',async t=>{
 let count=0;t.mock.method(globalThis,'fetch',async()=>{count++;return json({message:'Unavailable'},503);});
 await assert.rejects(()=>restoreDemoSession(),e=>e.status===503);assert.equal(count,1);
});
