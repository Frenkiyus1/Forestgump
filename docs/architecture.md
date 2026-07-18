# Kiến trúc hệ thống — Forestgump (cảnh báo thiên tai sớm Điện Biên)

> Tài liệu này là nguồn tham chiếu chính cho kiến trúc, luồng dữ liệu, giới
> hạn hệ thống và roadmap của Forestgump. Các comment trong code Python
> (`ai_engine/thresholds.py`, `ai_engine/downscale.py`, `ai_engine/risk_engine.py`)
> trích dẫn `docs/dienbien-phase0.md`/`docs/dienbien-phase1.md` — nội dung
> tương ứng được gộp vào tài liệu này.

## 1. Bài toán

Cảnh báo sớm 3 loại thiên tai tại Điện Biên: **mưa lớn/lũ quét**, **rét
đậm/rét hại**, **sương mù dày** — cho 3 địa điểm demo đại diện (không phải
toàn bộ 45 xã/phường, xem lý do ở mục 4). Phạm vi MVP được chốt sau review:
KHÔNG tự huấn luyện model dự báo thời tiết (dùng API dự báo có sẵn), KHÔNG
downscaling ảnh vệ tinh/DEM, KHÔNG firmware/IoT thật.

## 2. Pipeline (đúng như review đề xuất)

```
Open-Meteo API  ──(lỗi/timeout)──►  OpenWeatherMap (dự phòng)
      │                                     │
      └─────────────► weather-ingest.ts ◄───┘
                            │  (chuẩn hoá → DailyForecast[])
                            ▼
                    ai-risk-client.ts
                            │  POST /assess-risk
                            ▼
              ai_engine (FastAPI, rule-based)
        risk_engine.py + thresholds.py + downscale.py
                            │  RiskAssessment
                            ▼
                       bulletin.py
              (template cố định, KHÔNG dùng LLM tự do
               sinh nội dung an toàn tính mạng)
                            │
                            ▼
        backend/src/api.ts — GET /api/dienbien-forecast
                            │  GET /api/bulletins
                            │  GET /api/mock-notify (payload giả lập)
                            ▼
                 Dashboard (SvelteKit, Cloudflare Pages)
```

Toàn bộ pipeline **tính on-the-fly mỗi request** — không có bước lưu DB.
Không có Postgres/MQTT/broker nào trong hệ thống (xem mục 6 vì sao bỏ).

## 3. Schema dữ liệu chính

| Kiểu | Định nghĩa tại | Vai trò |
|---|---|---|
| `DienBienLocation` | `backend/src/config/locations.ts` | Địa điểm (toạ độ, độ cao, địa hình) — nguồn Open-Meteo Geocoding/Elevation API |
| `DailyForecast` / `LocationWeather` | `backend/src/weather-types.ts` | Dự báo 1 ngày đã chuẩn hoá (Open-Meteo hoặc OpenWeatherMap) |
| `LocationInput` / `ForecastInput` | `ai_engine/risk_engine.py` | Payload gửi sang AI Engine (khớp 2 kiểu trên) |
| `HazardRisk` / `RiskAssessment` | `ai_engine/risk_engine.py`, `backend/src/schemas.ts` | Kết quả đánh giá rủi ro (risk_score 0-100, alert_level) |
| `DayAssessment` / `AssessRiskResponse` | cả 2 phía, khớp qua `backend/src/schemas.ts` (Zod) | Risk + bản tin cho 1 ngày |

Zod (`schemas.ts`) và Pydantic (`ai_engine/*.py`) định nghĩa **song song, thủ
công đồng bộ** — chưa có codegen dùng chung. Đây là nợ kỹ thuật nhỏ, chấp
nhận được ở quy mô hiện tại (số field ít, thay đổi không thường xuyên).

## 4. Ngưỡng cảnh báo (rule engine, KHÔNG phải ML)

Nguồn & xác nhận đầy đủ: `ai_engine/thresholds.py` (bản Python, PHẢI khớp
`backend/src/alert-dienbien.ts`). Tóm tắt:

- **Rét đậm/rét hại**: theo định nghĩa nghiệp vụ NCHMF — nhiệt độ TB ngày
  ≤13°C = rét hại (đỏ), ≤15°C = rét đậm (vàng).
- **Mưa lớn/lũ quét**: PROXY đơn giản hoá từ Quyết định 18/2021/QĐ-TTg Điều
  44 — mốc 100/200/400mm/24h. Bỏ qua chiều thời gian kéo dài và bảng "vùng
  nguy cơ lũ quét 1-4" chính thức (Điện Biên chưa có dữ liệu này công khai).
  Hệ số nhân theo địa hình (`ven_suoi` ×1.3, `nui_cao` ×1.2) là heuristic dự
  án, không phải số liệu chính thức.
- **Sương mù**: định nghĩa WMO theo tầm nhìn (m) khi có dữ liệu quan trắc
  thực tế; khi KHÔNG có tầm nhìn (trường hợp mặc định — Open-Meteo dự báo
  7 ngày không có trường visibility), dùng `fog_risk_factor()` — hệ số ước
  tính nội bộ từ chênh nhiệt-điểm sương + độ ẩm + địa hình, CHƯA đối chiếu
  số liệu quan trắc thật.
- Ngưỡng được xác nhận với người yêu cầu ngày **2026-07-17**.

Ngưỡng hiện là hằng số Python/TypeScript (không phải file JSON/YAML) — đã
tách riêng module (`thresholds.py`/`alert-dienbien.ts`), có doc-comment rõ
nguồn. Chuyển sang config file là cải tiến hợp lý nhưng **không ưu tiên**
trong bản MVP (xem mục 7).

## 5. Giới hạn hệ thống đã biết

- **Không có dữ liệu lịch sử/ground-truth** cho 3 loại thiên tai ở Điện
  Biên — ngưỡng dựa trên văn bản pháp lý/định nghĩa nghiệp vụ, chưa được
  kiểm định bằng số liệu quan trắc thật.
- **`downscale_temperature()`** là xấp xỉ tuyến tính (lapse rate chuẩn
  0.65°C/100m), bỏ qua nghịch nhiệt (khá phổ biến ban đêm mùa đông ở lòng
  chảo Điện Biên Phủ), độ ẩm, hướng phơi sườn núi. Sai số lớn hơn khi chênh
  cao >1000m.
- **`/api/dienbien-forecast-validation`** chỉ đối chiếu được với NCHMF cho
  1 địa điểm (`dbp`, Mường Thanh) — NCHMF chỉ công khai trang dự báo cấp
  tỉnh lỵ, không có cho `tua-chua`/`muong-nhe`.
- **Chỉ 3 địa điểm demo**, không phải toàn bộ 45 xã/phường (Open-Meteo dự
  báo theo lưới lat/lon nên mở rộng về mặt kỹ thuật là dễ; giới hạn ở đây
  là để giữ phạm vi demo gọn theo khuyến nghị review).
- **`bulletin.py` cố tình KHÔNG dùng LLM tự do sinh nội dung** — chỉ điền
  biến vào template đã kiểm duyệt trước, vì nội dung cảnh báo an toàn tính
  mạng cần nhất quán, không hợp để mô hình ngôn ngữ tự sinh ngẫu nhiên.
- **`/api/mock-notify`** chỉ mô phỏng payload (Zalo/SMS/loa công cộng) —
  chưa tích hợp Zalo OA/SMS gateway/loa thật.

## 6. Vì sao không có DB/MQTT

Hệ thống Điện Biên là **pull-based**: mỗi request gọi thẳng Open-Meteo/AI
Engine, không có cảm biến thật, không cần broker hay bảng lưu trạng thái.
Nếu sau này có nhu cầu lưu lịch sử cảnh báo/dự báo (vd. biểu đồ xu hướng),
1 datastore nhẹ (SQLite/KV) là đủ, không cần Postgres/TimescaleDB đầy đủ.

## 7. Roadmap (ngoài phạm vi MVP)

Theo khuyến nghị review (`docs/eval.odt`) — các hướng sau có giá trị nghiên
cứu nhưng bị loại khỏi MVP vì tốn thời gian, khó chứng minh tốt hơn nguồn có
sẵn, hoặc cần dữ liệu chưa có:

- Tự huấn luyện model dự báo thời tiết (thay Open-Meteo/ECMWF).
- Downscaling ảnh vệ tinh/DEM, segmentation — cần dataset/segmentation/
  training/inference/validation riêng, đủ lớn để thành 1 project riêng.
- Model ML xác suất lũ quét học trên dữ liệu lịch sử thật (cần dữ liệu
  quan trắc thật, Điện Biên hiện chưa có công khai).
- Chuyển `thresholds.py`/`alert-dienbien.ts` sang file cấu hình JSON/YAML
  dùng chung (giảm nguy cơ lệch ngưỡng giữa backend và AI Engine).
- Event bus (`ForecastUpdated`/`WarningGenerated`/`BulletinCreated`) thay vì
  gọi trực tiếp giữa các bước.
- Tích hợp thật cho kênh cảnh báo: Zalo OA, SMS gateway, loa công cộng
  (hiện chỉ mô phỏng payload qua `/api/mock-notify`).
- Firmware/IoT thật (ESP32 + cảm biến) nếu dự án mở rộng sang đo đạc tại
  hiện trường thay vì chỉ dùng dự báo thời tiết công khai.
