FROM python:3.12-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Cài deps trước (tận dụng layer cache khi chỉ đổi code).
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py risk_engine.py thresholds.py downscale.py bulletin.py \
     train_flood.py ml_features.py ml_engine.py \
     terrain_features.py terrain_engine.py train_terrain.py live_features.py ./
# Danh bạ 130 xã (CSV đặc trưng địa hình) + cache độ cao Open-Meteo — cần cho
# /terrain-communes và /assess-terrain-risk* (kể cả fallback csv_baseline).
COPY data/ ./data/
# [OPTIONAL] flood_model.json: nếu đã chạy `python train_flood.py` để train,
# copy thêm file model vào đây (image build sẽ lỗi nếu bật dòng dưới mà file
# chưa tồn tại — mặc định COMMENT OUT, /predict-flood-risk tự fallback mock).
# COPY flood_model.json ./
# [OPTIONAL] models/: nếu đã chạy `python train_xgb.py` để train nhánh
# multi-hazard, copy thêm thư mục model vào đây để /assess-risk-ml trả
# mode="model" (mặc định COMMENT OUT, /assess-risk-ml tự fallback rule engine
# — mode="fallback_rule_engine", không lỗi 500, xem README mục 6.5).
# Thư mục models/ cũng chứa models/terrain/ (train_terrain.py) — bật dòng
# dưới thì /assess-terrain-risk* trả mode="model" thay vì "csv_baseline".
# COPY models/ ./models/

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
