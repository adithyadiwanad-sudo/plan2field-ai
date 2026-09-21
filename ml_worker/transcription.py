import json,subprocess,tempfile
from pathlib import Path
from functools import lru_cache
from config import MODEL_CACHE,UPLOAD_DIR
from database import connect
@lru_cache(maxsize=1)
def whisper_model():
    import whisper
    path=Path(MODEL_CACHE)/'base.pt'
    if not path.exists():raise RuntimeError('Whisper weights missing; run the explicit model download step')
    return whisper.load_model(str(path),device='cpu')
def transcribe(path):
    info=subprocess.run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(path)],capture_output=True,timeout=15,check=True)
    metadata=json.loads(info.stdout);duration=float(metadata['format'].get('duration',0))
    if not 0<duration<=120 or not any(s.get('codec_type')=='audio' for s in metadata['streams']):raise ValueError('Audio must contain an audio stream and last 1–120 seconds')
    with tempfile.TemporaryDirectory() as temp:
        wav=Path(temp)/'audio.wav'
        subprocess.run(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(path),'-t','120','-vn','-ac','1','-ar','16000',str(wav)],capture_output=True,timeout=45,check=True)
        result=whisper_model().transcribe(str(wav),fp16=False,language='en')
    if not result['text'].strip() or not any(s.get('no_speech_prob',1)<0.6 for s in result.get('segments',[])):raise ValueError('Insufficient speech; submit clearer audio or text')
    return result['text']
def prepare_report(report):
    if report['source_type']=='TEXT':return report
    import uuid
    path=Path(UPLOAD_DIR)/str(uuid.UUID(report['storage_ref']))
    if path.stat().st_size>20*1024*1024:raise ValueError('Upload size limit exceeded')
    evidence=[]
    if report['source_type']=='VOICE':text=transcribe(path)
    elif report['source_type']=='SPREADSHEET':
        from parsers.progress_spreadsheet import parse
        evidence=parse(path.read_bytes(),json.loads(report['metadata'].get('mapping') or '{}'));text='\n'.join(r['text'] for r in evidence)
        offset=0
        for record in evidence:
            record['start']=offset;record['end']=offset+len(record['text']);offset=record['end']+1
    else:
        from parsers.scanned_diary import parse
        evidence=parse(path.read_bytes());text='\n'.join(r['text'] for r in evidence)
    from psycopg.types.json import Jsonb
    with connect() as conn:conn.execute('UPDATE site_reports SET transcript=%s,metadata=metadata||%s WHERE id=%s',(text,Jsonb({'source_evidence':evidence}),report['id']))
    report['transcript']=text;report['source_evidence']=evidence;return report
