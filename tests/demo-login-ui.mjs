import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const id='11111111-1111-4111-8111-111111111111';let identity=null;const logins=[];
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;let data=[];
  if(path.endsWith('/auth/login')){const body=route.request().postDataJSON();logins.push(body);const role=body.email.startsWith('engineer')?'ENGINEER':'REVIEWER';identity={id:role,name:role,email:body.email,discipline:'PIPING',csrf_token:role,memberships:[{project_id:id,role}]};data=identity;}
  else if(path.endsWith('/auth/me'))data=identity;
  else if(path==='/api/projects')data=[{id,code:'OIL-DEMO-01',name:'Demo',status:'ACTIVE',role:identity?.memberships[0].role}];
  else if(path===`/api/projects/${id}`)data={id,code:'OIL-DEMO-01',reporting_date:'2026-09-15'};
  await route.fulfill({json:data});
 });
 await page.goto('http://127.0.0.1:4173/login');
 await page.getByRole('heading',{name:/Quick Demo Login/}).waitFor();assert.equal(logins.length,0);
 await page.getByRole('button',{name:/Demo as Field Engineer/}).click();await page.waitForURL('**/reports/new');
 assert.equal(logins[0].email,'engineer@plan2field.ai');
 await page.getByRole('link',{name:'Switch demo role'}).click();
 await page.getByRole('button',{name:/Demo as Project Planner/}).click();await page.waitForURL('**/review');
 assert.equal(logins[1].email,'planner@plan2field.ai');
 await page.reload();await page.getByRole('link',{name:'Switch demo role'}).waitFor();assert.equal(logins.length,2);
 await page.getByRole('link',{name:'Switch demo role'}).click();
 await page.screenshot({path:'docs/screenshots/demo-login-desktop-mocked.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'docs/screenshots/demo-login-mobile-mocked.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: explicit login, both role redirects, switching, session reuse and mobile layout (mocked API).');
}finally{await browser.close();}
