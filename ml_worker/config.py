import os
from environment import load_environment
load_environment()
DATABASE_URL = os.environ.get('DATABASE_URL', '')
MODEL_CACHE = os.environ.get('MODEL_CACHE', './models')
UPLOAD_DIR = os.environ.get('UPLOAD_DIR', './uploads')
BI_MODEL = 'sentence-transformers/all-MiniLM-L6-v2'
BI_REVISION = 'c9745ed1d9f207416be6d2e6f8de32d1f16199bf'
CROSS_MODEL = 'cross-encoder/ms-marco-MiniLM-L6-v2'
CROSS_REVISION = 'c5ee24cb16019beea0893ab7796b1df96625c6b8'
DIMENSION = 384
POLICY = {'version': 'conservative-v1', 'threshold': 2.0, 'margin': 1.0}
