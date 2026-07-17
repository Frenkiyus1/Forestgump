# ForestGump AI Engine

Dịch vụ FastAPI dự báo độ mặn 24h & 48h bằng XGBoost (Hải Phòng), và
risk/bulletin engine cho cảnh báo thời tiết sớm Điện Biên (Giai đoạn 2 —
rule-based, xem mục riêng bên dưới).

## Thành phần — dự báo độ mặn (Hải Phòng)
- `app.py` — REST service (`/health`, `/predict`, `/assess-risk`, `/predict-flood-risk`).
- `features.py` — feature engineering time-series, **dùng chung** train & serve.
- `train.py` — huấn luyện model (sinh dữ liệu tổng hợp + train 2 Booster).
- `requirements.txt` — phụ thuộc Python.

## Thành phần — cảnh báo thời tiết Điện Biên (Giai đoạn 2)
- `thresholds.py` — ngưỡng cảnh báo (rét đậm/rét hại, mưa lớn/lũ quét, sương
  mù). **PHẢI KHỚP** `backend/src/alert-dienbien.ts` — sửa ngưỡng ở 1 bên
  phải sửa cả 2. Nguồn & giới hạn: xem `docs/dienbien-phase0.md`.
- `downscale.py` — hiệu chỉnh nhiệt độ theo cao độ (lapse rate ~0.65°C/100m,
  xấp xỉ tuyến tính) + ước tính hệ số nguy cơ sương mù theo địa hình.
- `risk_engine.py` — rule engine (if/threshold, **không phải ML**) tính risk
  score 0-100 + alert level cho 3 hiểm hoạ, dùng downscale.py + thresholds.py.
- `bulletin.py` — sinh bản tin cảnh báo bằng cách điền biến vào template cố
  định đã kiểm duyệt trước (**không dùng LLM tự do sinh nội dung an toàn tính
  mạng**). Hiện chỉ có template tiếng Việt.
- `train_flood.py` — **[OPTIONAL/DEMO]** huấn luyện model XGBoost dự báo xác
  suất lũ quét. ⚠️ **Học trên dữ liệu TỔNG HỢP** (sinh bằng rule đơn giản),
  KHÔNG phải dữ liệu quan trắc thật — Điện Biên hiện chưa có CSDL thiên tai
  lịch sử công khai (xem `docs/dienbien-phase1.md`). Model này chỉ dùng tham
  khảo qua `POST /predict-flood-risk`; nguồn đánh giá rủi ro **chính thức**
  của hệ thống vẫn là `risk_engine.compute_risk()` (rule-based).

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

## Hợp đồng API — Điện Biên (Giai đoạn 2)

`POST /assess-risk` — nhận 1 địa điểm + dự báo 3-7 ngày (khớp bảng
`weather_forecast` / `DailyForecast` trong `backend/src/weather-types.ts`),
trả về risk assessment + bản tin cảnh báo cho từng ngày:
```json
{
  "location": {"code": "tua-chua", "name": "Xã Tủa Chùa", "elevation_m": 871.0, "terrain": "nui_cao"},
  "forecast": [
    {"date": "2026-07-17", "temp_min_c": 11.5, "temp_max_c": 13.0, "precipitation_mm": 250.0,
     "humidity_pct": 96.0, "dew_point_c": 12.0, "wind_speed_kmh": 4.0}
  ]
}
```
Trả về `days: [{ risk: {location_code, date, hazards: [{hazard, alert_level, risk_score, detail}, ...]}, bulletin }]`.
Luôn hoạt động (rule-based, không có mock mode).

`POST /predict-flood-risk` — **[OPTIONAL/DEMO]**, xem cảnh báo ở trên. Nhận
`{rain_24h_mm, rain_12h_mm, terrain, elevation_m, humidity_pct}`, trả về
`{flood_probability, mode}` (`mode: "mock"` nếu chưa train `flood_model.json`).

## Huấn luyện model lũ quét (optional)
```bash
python train_flood.py                # ghi flood_model.json (KHÔNG commit vào git)
python train_flood.py --out models    # ghi vào thư mục production
```

## Test
```bash
python -m unittest test_ai test_downscale test_risk test_bulletin test_flood -v
```
- `test_ai.py` — feature engineering + `/predict` (độ mặn).
- `test_downscale.py` — hiệu chỉnh nhiệt độ theo cao độ + hệ số nguy cơ sương mù.
- `test_risk.py` — ngưỡng thresholds.py (đối chiếu alert-dienbien.test.ts) + `compute_risk()`.
- `test_bulletin.py` — sinh bản tin từ template.
- `test_flood.py` — feature lũ quét + `/predict-flood-risk` (optional).

Thủ công: `GET /health` xem `mode` (mock/model), `POST /predict` với
`{history:[...]}`, `POST /assess-risk` với payload ở trên.
