FROM python:3.12-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Cài deps trước (tận dụng layer cache khi chỉ đổi code).
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py features.py ./
# Model XGBoost (nếu có) sẽ được mount qua volume hoặc copy vào ảnh:
# COPY xgboost_model.json xgboost_model_48h.json ./

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
