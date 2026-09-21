"""Keep explicit one-shot owner setup commands consistent across documentation."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
for name in ['README.md','scripts/bootstrap.ps1','scripts/bootstrap.sh']:
    path=root/name;text=path.read_text(encoding='utf-8')
    text=text.replace('compose run --rm backend node scripts/bootstrap.mjs','compose run --rm bootstrap node scripts/bootstrap.mjs')
    text=text.replace('compose run --rm backend node scripts/test-database.mjs','compose run --rm bootstrap node scripts/test-database.mjs')
    text=text.replace('compose run --rm -e SEED_OWNER=true ml_worker python scripts/seed_data.py','compose run --rm seed python scripts/seed_data.py')
    text=text.replace('compose run --rm -e SEED_OWNER=true ml_worker python scripts/reset_demo.py','compose run --rm seed python scripts/reset_demo.py')
    path.write_text(text,encoding='utf-8')
