from pathlib import Path
import os
def load_environment():
    if os.environ.get('P2F_ENV_LOADED')=='1':return
    path=Path(__file__).resolve().parents[1]/'.env'
    if path.exists():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if not line.strip() or line.lstrip().startswith('#') or '=' not in line:continue
            key,value=line.split('=',1)
            os.environ.setdefault(key.strip(),value.strip().strip('"').strip("'"))
