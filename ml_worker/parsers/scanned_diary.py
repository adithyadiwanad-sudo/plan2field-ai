import io
from PIL import Image
import pytesseract
Image.MAX_IMAGE_PIXELS=20_000_000
def parse(data):
    image=Image.open(io.BytesIO(data))
    if image.format not in ('PNG','JPEG'):raise ValueError('OCR supports PNG/JPEG printed diaries only; PDF is disabled')
    if image.width*image.height>20_000_000:raise ValueError('Image exceeds pixel limit')
    text=pytesseract.image_to_string(image,config='--psm 6',timeout=60)
    if not text.strip():raise ValueError('No readable OCR text')
    return [{'text':text,'page':1,'uncertain':True}]
