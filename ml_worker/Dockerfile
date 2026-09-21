FROM python:3.12.12-slim-bookworm
ENV PYTHONUNBUFFERED=1 OMP_NUM_THREADS=2 TOKENIZERS_PARALLELISM=false
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg tesseract-ocr && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock
COPY . .
RUN useradd -m worker && mkdir -p /models /uploads && chown -R worker:worker /models /uploads
USER worker
CMD ["python","worker.py"]
