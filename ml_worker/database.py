import psycopg
from psycopg.rows import dict_row
from pgvector.psycopg import register_vector
from config import DATABASE_URL
def connect():
    import os
    if os.environ.get('SEED_OWNER')=='true':
        if os.environ.get('LOCAL_DEMO')!='true':raise RuntimeError('Owner seed connection requires LOCAL_DEMO=true')
        conn=psycopg.connect(host=os.environ.get('DB_HOST','db'),dbname='plan2field',user='postgres',password=os.environ['POSTGRES_PASSWORD'],row_factory=dict_row)
    else:conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    register_vector(conn)
    return conn
