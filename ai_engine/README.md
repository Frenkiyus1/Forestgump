# SaliGuard AI Engine

Dịch vụ FastAPI dự báo độ mặn 24h & 48h bằng XGBoost.

## Thành phần
- `app.py` — REST service (`/health`, `/predict`).
- `features.py` — feature engineering time-series, **dùng chung** train & serve.
- `train.py` — huấn luyện model (sinh dữ liệu tổng hợp + train 2 Booster).
- `requirements.txt` — phụ thuộc Python.

## Hợp đồng API
`POST /predict` — nhận CHUỖI quan trắc gần đây (ascending theo thời gian,
phần tử cuối là hiện tại):
```json
{
  "history": [
    { "ts": "2026-06-30T00:00:00Z", "temp": 28.0, "ec": 2.1, "level": 1.4 },
    { "ts": "2026-06-30T01:00:00Z", "temp": 28.1, "ec": 2.3, "level": 1.4 }
  ]
}
```
Trả về:
```json
{ "forecast_24h": 2.96, "forecast_48h": 3.17 }
```
> Backend tự lấy 48h gần nhất từ DB + bản đo hiện tại rồi gọi endpoint này.
> Không có file model → service chạy **mock mode** (giá trị ngẫu nhiên).

## Đặc trưng (FEATURE_NAMES trong features.py)
EC/temp/level hiện tại · pha thuỷ triều giờ-trong-ngày (24h & 12h) ·
EC trễ 3/6/12/24h · trung bình & đỉnh EC 24h · độ dốc EC 6h.

## Huấn luyện
```bash
# Cài deps (lần đầu)
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt

# Train -> xgboost_model.json + xgboost_model_48h.json (thư mục hiện tại)
python train.py

# Hoặc ghi vào thư mục dùng cho production (compose mount ./models)
python train.py --out models
```
Tham số: `--series` (số trạm tổng hợp), `--days`, `--step` (bước trượt giờ).

> ⚠️ Dữ liệu hiện là **tổng hợp** (mô phỏng thuỷ triều + xu hướng + nhiễu) nên
> model phù hợp demo/đồ án. Muốn chính xác ngoài đời: thay
> `generate_station_series` trong `train.py` bằng dữ liệu đo thật rồi train lại.

## Chạy service
```bash
uvicorn app:app --port 8000              # dev
# MODEL_PATH / MODEL_48H_PATH đổi đường dẫn model nếu cần
```

## Test
```bash
python -m unittest test_ai -v
```
Kiểm tra: số chiều & độ chính xác của feature (lag/roll/slope), không crash khi
lịch sử ngắn, và smoke test `predict()` trả về 2 forecast hữu hạn.
Thủ công: `GET /health` xem `mode` (mock/model), `POST /predict` với `{history:[...]}`.
