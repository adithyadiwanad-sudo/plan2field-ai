// Real frontend/API/cloud smoke; leaves all proposals unapproved.
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
assert.ok(process.env.DEMO_EMAIL && process.env.DEMO_PASSWORD, 'Load root .env first');
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  page.setDefaultTimeout(60000);
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://localhost:5173');
  await page.getByLabel('Email address').fill(process.env.DEMO_EMAIL);
  await page.getByLabel('Password',{exact:true}).fill(process.env.DEMO_PASSWORD);
  await page.getByRole('button',{name:'Sign in to workspace'}).click();
  const row=page.getByRole('row').filter({hasText:'ACT-24-SPOOL-01'});
  await row.waitFor();
  assert.equal(await row.count(),1);
  await mkdir('docs/screenshots',{recursive:true});
  await page.screenshot({path:'docs/screenshots/cloud-dashboard.png',fullPage:true});
  await page.getByRole('link',{name:'Review queue',exact:true}).click();
  await page.getByRole('heading',{name:/observation/}).first().waitFor();
  await page.screenshot({path:'docs/screenshots/cloud-review.png',fullPage:true});
  const ready=await page.request.get('http://localhost:5173/api/health/ready');
  assert.equal(ready.status(),200);
  assert.deepEqual(await ready.json(),{database:true,models:true,worker:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: real browser login, seeded schedule, model proposal queue, and database/worker/model readiness. No approvals performed.');
} finally { await browser.close(); }
