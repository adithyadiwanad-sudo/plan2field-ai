"""Explicit network setup step; normal worker startup never downloads weights."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from config import *
def main():
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--semantic-only',action='store_true');args=parser.parse_args()
    from huggingface_hub import snapshot_download
    root=Path(MODEL_CACHE);root.mkdir(parents=True,exist_ok=True)
    snapshot_download(BI_MODEL,revision=BI_REVISION,local_dir=root/'bi',ignore_patterns=['onnx/*','openvino/*','*.h5','*.msgpack'])
    snapshot_download(CROSS_MODEL,revision=CROSS_REVISION,local_dir=root/'cross',ignore_patterns=['onnx/*','openvino/*','*.h5','*.msgpack'])
    if not args.semantic_only:
        import whisper
        whisper.load_model('base',download_root=str(root),device='cpu')
    (root/'manifest.json').write_text(json.dumps({'bi':BI_MODEL,'bi_revision':BI_REVISION,'cross':CROSS_MODEL,'cross_revision':CROSS_REVISION,'dimension':DIMENSION}))
    print('Pinned semantic models downloaded'+('' if args.semantic_only else ', including Whisper base')+'. Re-embed schedules when the manifest changes.')
if __name__=='__main__':main()
