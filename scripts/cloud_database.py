"""Explicit cloud initialization; never drops existing user tables or data."""
import sys,os,json,secrets
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit,quote
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'ml_worker'))
from environment import load_environment
load_environment()
import psycopg
from psycopg import sql
def main():
    mode=sys.argv[1] if len(sys.argv)>1 else 'inspect'
    with psycopg.connect(os.environ['DATABASE_URL'],connect_timeout=15) as conn:
        tables=[r[0] for r in conn.execute("SELECT tablename FROM pg_tables WHERE schemaname='public'")]
        print(json.dumps({'connected':True,'public_tables':tables}))
        if mode=='inspect':return
        conn.execute('CREATE EXTENSION IF NOT EXISTS vector')
        if not tables:conn.execute((root/'database/schema.sql').read_text())
        elif not set(['projects','activity_baselines','progress_events','staged_proposals']).issubset(tables):raise RuntimeError('Database contains other tables. Refusing an unreviewed schema initialization.')
        else:print('Existing Plan2Field schema preserved; initial DDL not reapplied.')
        for role in ['p2f_api','p2f_worker']:
            if not conn.execute('SELECT 1 FROM pg_roles WHERE rolname=%s',(role,)).fetchone():conn.execute(sql.SQL('CREATE ROLE {} LOGIN').format(sql.Identifier(role)))
        grants=(root/'database/roles.sql').read_text()
        grants='\n'.join(l for l in grants.splitlines() if not l.startswith('CREATE ROLE') and not l.startswith('GRANT CONNECT'))
        conn.execute(grants)
        database=conn.execute('SELECT current_database()').fetchone()[0]
        for role in ['p2f_api','p2f_worker']:conn.execute(sql.SQL('GRANT CONNECT ON DATABASE {} TO {}').format(sql.Identifier(database),sql.Identifier(role)))
        updates={}
        parsed=urlsplit(os.environ['DATABASE_URL'])
        for role,key in [('p2f_api','API_DATABASE_URL'),('p2f_worker','WORKER_DATABASE_URL')]:
            password=secrets.token_urlsafe(30)
            conn.execute(sql.SQL('ALTER ROLE {} PASSWORD {}').format(sql.Identifier(role),sql.Literal(password)))
            updates[key]=urlunsplit((parsed.scheme,role+':'+quote(password,safe='')+'@'+parsed.hostname+(':'+str(parsed.port) if parsed.port else ''),parsed.path,parsed.query,''))
        conn.commit()
        path=root/'.env';lines=path.read_text().splitlines();keys=set()
        for i,line in enumerate(lines):
            key=line.split('=',1)[0]
            if key in updates:lines[i]=key+'="'+updates[key]+'"';keys.add(key)
        lines += [k+'="'+v+'"' for k,v in updates.items() if k not in keys]
        path.write_text('\n'.join(lines)+'\n')
        print('Schema and runtime role grants initialized; restricted connection URLs saved privately in .env.')
        print(json.dumps({'vector_version':conn.execute("SELECT extversion FROM pg_extension WHERE extname='vector'").fetchone()[0],'tables':conn.execute("SELECT count(*) FROM pg_tables WHERE schemaname='public'").fetchone()[0]}))
if __name__=='__main__':
    try:main()
    except Exception as exc:
        print(type(exc).__name__+': '+str(exc).replace(os.environ.get('DATABASE_URL','__none__'),'[redacted URL]'));sys.exit(1)
