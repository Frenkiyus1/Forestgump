FROM python:3.12-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Cài deps trước (tận dụng layer cache khi chỉ đổi code).
# Lưu ý: container Linux không có Apple MPS -> torch chạy CPU-only ở đây
# (xem SATELLITE_DEVICE trong docker-compose.prod.yml). requirements.txt cài
# torch mặc định (có thể kèm CUDA wheel không cần thiết trên VPS CPU-only);
# nếu image quá nặng, cân nhắc trỏ pip index về wheel CPU-only của PyTorch, vd:
#   RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
# rồi cài phần requirements.txt còn lại.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py config.py infer_geotiff.py model.py dataset.py tile_geotiff.py ./
# Model checkpoint (segformer_b0_best.pt) KHÔNG bake vào image — mount qua
# volume ./satellite_engine/models:/models:ro (giống cách ai_engine mount).

EXPOSE 8010

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8010/health').status==200 else 1)"

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8010"]
