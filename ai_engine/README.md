# Forestgump AI Engine

Dịch vụ FastAPI đánh giá rủi ro + sinh bản tin cảnh báo thiên tai sớm cho
Điện Biên (rét đậm/rét hại, mưa lớn/lũ quét, sương mù dày). Nguồn đánh giá
**chính** vẫn là rule-based (if/threshold) — nên `/assess-risk` luôn hoạt
động, không có mock mode. Có thêm 1 nhánh XGBoost **song song, không thay
thế** — xem mục "Nhánh ML (song song, optional)" bên dưới.

## Thành phần
- `app.py` — REST service (`/health`, `/assess-risk`, `/predict-flood-risk`).
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

## Nhánh ML (song song, optional)

Cả 2 nhánh dưới đây học từ dữ liệu **TỔNG HỢP** (distill chính rule engine
hiện có, xem cảnh báo trong từng file) — Điện Biên chưa có CSDL quan trắc
thiên tai lịch sử để train trên dữ liệu thật (`docs/architecture.md` mục 5,
7). Accuracy cao (~99%) chỉ chứng minh XGBoost tái tạo đúng ngưỡng đã xác
nhận, **không** chứng minh bản thân ngưỡng đúng với thời tiết thật. Rule
engine (`risk_engine.compute_risk`) vẫn là nguồn quyết định cho
`/assess-risk` và bản tin cảnh báo thật.

1. **Lũ quét (binary, đã nối vào service):**
   - `train_flood.py` → sinh `flood_model.json`.
   - `POST /predict-flood-risk` (`app.py`) dùng model này nếu có, tự fallback
     công thức mock (`mode="mock"`) nếu chưa train — không bao giờ lỗi 500.
   - Test: `python -m unittest test_flood`.

2. **Cả 3 hiểm hoạ (multi-class 4 mức, CHƯA nối vào service):**
   - `ml_features.py` — feature engineering dùng chung train/serve.
   - `train_xgb.py` → sinh `models/{hazard}.xgb.json` + `models/metadata.json`.
   - `ml_engine.py` — inference (`assess_risk_ml()`), tự fallback rule engine
     nếu chưa train/lỗi load model. Chưa có route riêng trong `app.py`.
   - `eval_xgb.py` — đánh giá accuracy trên tập test MỚI (seed khác lúc
     train): accuracy, MAE risk_score, confusion matrix per hiểm hoạ.

```bash
python train_xgb.py --samples 40000        # train, in luôn accuracy tập test nội bộ
python eval_xgb.py --samples 10000 --save-report models/eval_report.json
```
Kết quả gần nhất (tập test 10,000 mẫu, seed độc lập với lúc train):

| Hiểm hoạ | Accuracy | MAE risk_score (thang 0-100) |
|---|---|---|
| cold_damage | 0.9999 | 7.25 |
| heavy_rain_flood | 0.9975 | 6.21 |
| fog | 0.9961 | 10.86 |

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

`POST /predict-flood-risk` — [OPTIONAL/DEMO] xác suất lũ quét bổ sung bằng
XGBoost (`train_flood.py`), THAM KHẢO, không dùng để tính `alert_level` của
`/assess-risk`:
```json
{"rain_24h_mm": 250.0, "rain_12h_mm": 150.0, "terrain": "ven_suoi", "elevation_m": 540.0, "humidity_pct": 95.0}
```
Trả về `{"flood_probability": 0.0-1.0, "mode": "model" | "mock"}` — `mode="mock"`
nếu chưa chạy `python train_flood.py`.

## Chạy service
```bash
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## Test
```bash
python -m unittest test_downscale test_risk test_bulletin test_flood -v
```
- `test_downscale.py` — hiệu chỉnh nhiệt độ theo cao độ + hệ số nguy cơ sương mù.
- `test_risk.py` — ngưỡng thresholds.py (đối chiếu alert-dienbien.test.ts) + `compute_risk()`.
- `test_bulletin.py` — sinh bản tin từ template.
- `test_flood.py` — feature engineering + `POST /predict-flood-risk` (nhánh ML lũ quét).

Thủ công: `GET /health`, `POST /assess-risk`, `POST /predict-flood-risk` với payload ở trên.

## Ngoài phạm vi MVP (roadmap)
Model ML dự báo riêng (thay Open-Meteo) và downscaling ảnh vệ tinh/DEM vẫn
ngoài phạm vi MVP theo khuyến nghị review (`docs/eval.odt`) — xem
`docs/architecture.md` mục "Roadmap". Riêng model xác suất lũ quét trên dữ
liệu tổng hợp NAY ĐÃ có bản demo song song (`train_flood.py`,
`/predict-flood-risk`, mục "Nhánh ML" ở trên) — nhưng vẫn CHƯA phải bản dùng
được cho quyết định thật, vì lý do y hệt lúc bị loại khỏi MVP: chưa có dữ
liệu quan trắc thiên tai lịch sử thật của Điện Biên để kiểm chứng độc lập
với rule engine. `docs/architecture.md` nên được cập nhật lại nếu quyết định
đưa nhánh này vào production thật.
