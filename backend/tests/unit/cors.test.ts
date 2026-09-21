import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {cors} from '../../src/middleware/cors.js';
import {errors} from '../../src/middleware/errors.js';
import {allowedOrigins} from '../../src/config.js';
test('credentialed CORS preflight allows only configured frontend origins',async()=>{
 const app=express();app.use(cors);app.get('/api/health/live',(_req,res)=>res.json({live:true}));app.use(errors);
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 try {
  const base='http://127.0.0.1:'+(server.address() as any).port;
  const good=await fetch(base+'/api/auth/login',{method:'OPTIONS',headers:{Origin:allowedOrigins[0],'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-csrf-token'}});
  assert.equal(good.status,204);assert.equal(good.headers.get('access-control-allow-origin'),allowedOrigins[0]);assert.equal(good.headers.get('access-control-allow-credentials'),'true');
  const bad=await fetch(base+'/api/auth/login',{method:'OPTIONS',headers:{Origin:'https://untrusted.example'}});
  assert.equal(bad.status,403);assert.equal(bad.headers.get('access-control-allow-origin'),null);
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
