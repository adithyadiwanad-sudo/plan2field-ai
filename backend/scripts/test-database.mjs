import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
const name='p2f_test_'+randomUUID().replaceAll('-','');
const host=process.env.DB_HOST||'db';
const cloud=process.env.DATABASE_URL;
const owner=new pg.Client(cloud?{connectionString:cloud}:{host,database:'plan2field',user:'postgres',password:process.env.POSTGRES_PASSWORD});await owner.connect();
try{
 await owner.query(`CREATE DATABASE "${name}"`);
 const ownerUrl=new URL(cloud||`postgresql://postgres@${host}:5432/${name}`);ownerUrl.pathname='/'+name;if(!cloud)ownerUrl.password=process.env.POSTGRES_PASSWORD;
 const apiUrl=new URL(process.env.API_DATABASE_URL||`postgresql://p2f_api@${host}:5432/${name}`);apiUrl.pathname='/'+name;if(!process.env.API_DATABASE_URL)apiUrl.password=process.env.API_DB_PASSWORD;
 for(const file of ['tests/integration/database.test.ts','tests/integration/approval.test.ts']){
  const child=spawn(process.execPath,['--import','tsx','--test',file],{stdio:'inherit',env:{...process.env,TEST_DATABASE_URL:ownerUrl.href,TEST_API_DATABASE_URL:apiUrl.href}});
  const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});process.exitCode=code||0;if(code)break;
 }
}finally{
 if(!/^p2f_test_[a-f0-9]{32}$/.test(name))throw new Error('Unexpected test database name');
 await owner.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);await owner.end();
}
