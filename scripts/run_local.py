"""Launch a local dev service with its restricted cloud credentials."""
import os,sys,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'ml_worker'))
from environment import load_environment
load_environment()
service=sys.argv[1] if len(sys.argv)>1 else ''
env=dict(os.environ)
if service=='api':
    env['DATABASE_URL']=env['API_DATABASE_URL']
    command=['node',str(root/'backend/node_modules/tsx/dist/cli.mjs'),'watch',str(root/'backend/src/server.ts')];cwd=root
elif service=='worker':
    env['DATABASE_URL']=env['WORKER_DATABASE_URL'];env['HF_HUB_OFFLINE']='1'
    command=[sys.executable,str(root/'ml_worker/worker.py')];cwd=root
elif service=='frontend':
    command=['node',str(root/'frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',env.get('FRONTEND_PORT','5173'),'--strictPort'];cwd=root/'frontend'
else:raise SystemExit('Usage: python scripts/run_local.py api|worker|frontend')
for name in ['POSTGRES_PASSWORD','API_DB_PASSWORD','WORKER_DB_PASSWORD','API_DATABASE_URL','WORKER_DATABASE_URL','DEMO_PASSWORD']:
    env.pop(name,None)
if service=='frontend':env.pop('DATABASE_URL',None)
env['P2F_ENV_LOADED']='1'
try:subprocess.run(command,cwd=cwd,env=env,check=True)
except KeyboardInterrupt:pass
