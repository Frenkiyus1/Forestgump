# Forestgump AI Engine

Dịch vụ FastAPI đánh giá rủi ro + sinh bản tin cảnh báo thiên tai sớm cho
Điện Biên (rét đậm/rét hại, mưa lớn/lũ quét, sương mù dày). Rule-based
(if/threshold) — **không phải machine learning**, nên luôn hoạt động, không
có mock mode.

## Thành phần
- `app.py` — REST service (`/health`, `/assess-risk`).
- `thresholds.py` — ngưỡng cảnh báo (rét đậm/rét hại, mưa lớn/lũ quét, sương
  mù). **PHẢI KHỚP** `backend/src/alert-dienbien.ts` — sửa ngưỡng ở 1 bên
  phải sửa cả 2. Nguồn & giới hạn: xem `docs/architecture.md`.
- `downscale.py` — hiệu chỉnh nhiệt độ theo cao độ (lapse rate ~0.65°C/100m,
  xấp xỉ tuyến tính) + ước tính hệ số nguy cơ sương mù theo địa hình.
- `risk_engine.py` — rule engine (if/threshold, **không phải ML**) tính risk
  score 0-100 + alert level cho 3 hiểm hoạ, dùng downscale.py + thresholds.py.
- `bulletin.py` — sinh bản tin cảnh báo bằng cách điền biến vào template cố
  định đã kiểm duyệt trước (**không dùng LLM tự do sinh nội dung an toàn tính
  mạng**). Hiện chỉ có template tiếng Việt.

## Hợp đồng API

`POST /assess-risk` — nhận 1 địa điểm + dự báo 3-7 ngày (khớp
`DailyForecast` trong `backend/src/weather-types.ts`), trả về risk assessment
+ bản tin cảnh báo cho từng ngày:
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

## Chạy service
```bash
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## Test
```bash
python -m unittest test_downscale test_risk test_bulletin -v
```
- `test_downscale.py` — hiệu chỉnh nhiệt độ theo cao độ + hệ số nguy cơ sương mù.
- `test_risk.py` — ngưỡng thresholds.py (đối chiếu alert-dienbien.test.ts) + `compute_risk()`.
- `test_bulletin.py` — sinh bản tin từ template.

Thủ công: `GET /health`, `POST /assess-risk` với payload ở trên.

## Ngoài phạm vi MVP (roadmap)
Model ML dự báo riêng (thay Open-Meteo), downscaling ảnh vệ tinh/DEM, và mô
hình xác suất lũ quét học trên dữ liệu tổng hợp đã được loại khỏi MVP theo
khuyến nghị review (`docs/eval.odt`) — xem `docs/architecture.md` mục
"Roadmap" nếu muốn làm lại sau khi có dữ liệu quan trắc thật.
