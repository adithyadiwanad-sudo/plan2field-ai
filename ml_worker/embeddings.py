from functools import lru_cache
from pathlib import Path
import hashlib
from config import MODEL_CACHE, BI_MODEL, BI_REVISION, CROSS_MODEL, CROSS_REVISION, DIMENSION
@lru_cache(maxsize=1)
def models():
    from sentence_transformers import SentenceTransformer, CrossEncoder
    import torch
    torch.set_num_threads(2)
    bi=SentenceTransformer(str(Path(MODEL_CACHE)/'bi'),device='cpu',local_files_only=True,trust_remote_code=False)
    cross=CrossEncoder(str(Path(MODEL_CACHE)/'cross'),device='cpu',local_files_only=True,trust_remote_code=False,activation_fn=torch.nn.Identity())
    import json
    manifest=json.loads((Path(MODEL_CACHE)/'manifest.json').read_text())
    if manifest!={'bi':BI_MODEL,'bi_revision':BI_REVISION,'cross':CROSS_MODEL,'cross_revision':CROSS_REVISION,'dimension':DIMENSION}:raise RuntimeError('Model manifest mismatch; download configured revisions and re-embed schedules.')
    if bi.get_sentence_embedding_dimension()!=DIMENSION:raise RuntimeError('Embedding dimension mismatch')
    return bi,cross
def activity_text(a):
    fields=[str(a.get(k) or '') for k in ('description','wbs_path','discipline','area','activity_type','line_number','asset_tag')]
    aliases=(a.get('source_metadata') or {}).get('approved_aliases') if isinstance(a.get('source_metadata'),dict) else a.get('approved_aliases')
    if aliases:fields.append(str(aliases))
    return ' | '.join(fields)
def embed(text):return models()[0].encode(text,normalize_embeddings=True)
def embed_activities(conn,activities):
    from psycopg.types.json import Jsonb
    for a in activities:
        text=activity_text(a);vec=embed(text)
        conn.execute('INSERT INTO activity_embeddings(activity_id,project_id,schedule_version_id,model_id,revision,dimension,content_hash,embedding) VALUES(%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(activity_id,model_id,revision) DO UPDATE SET content_hash=EXCLUDED.content_hash,embedding=EXCLUDED.embedding',(a['id'],a['project_id'],a['schedule_version_id'],BI_MODEL,BI_REVISION,DIMENSION,hashlib.sha256(text.encode()).hexdigest(),vec))
