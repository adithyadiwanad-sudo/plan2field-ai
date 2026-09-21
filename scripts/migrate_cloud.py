"""Apply the additive enterprise evidence migration; preserve all existing data."""
import sys,os
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'ml_worker'))
from environment import load_environment
load_environment()
import psycopg
with psycopg.connect(os.environ['DATABASE_URL'],connect_timeout=20) as conn:
    conn.execute((root/'database/migrations/002_enterprise_evidence.sql').read_text(encoding='utf-8'))
    print('Enterprise evidence migration applied; existing baselines and actuals preserved.')
