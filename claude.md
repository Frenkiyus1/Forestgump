# Forestgump - Cảnh báo thiên tai sớm Điện Biên
**Project Context & Instructions for AI Assistant**

## 1. Project Overview
Forestgump là hệ thống cảnh báo sớm 4 loại thiên tai tại Điện Biên: **mưa
lớn/lũ quét**, **mưa đá**, **sạt lở đất**, **sương mù dày**. Hệ thống lấy dự báo
thời tiết từ Open-Meteo (nguồn chính, có fallback OpenWeatherMap), đánh giá
rủi ro bằng rule engine (ngưỡng đã xác nhận, không phải ML), sinh bản tin
cảnh báo bằng LLM (Gemini) neo vào chính đánh giá rủi ro đó — fallback về
template cố định nếu LLM chưa cấu hình/lỗi — và hiển thị trên Dashboard web.
Kiến trúc đầy đủ, giới hạn hệ thống đã biết và roadmap: xem
**`docs/architecture.md`**.

## 1b. Bản đồ chấm điểm (rubric → bằng chứng trong code)

Bảng dưới map từng tiêu chí đánh giá thường gặp sang **file/hàm cụ thể** làm
bằng chứng — để người đọc (kể cả AI reviewer) đi thẳng tới chỗ chứng minh,
không phải dò cả repo.

| Tiêu chí | Bằng chứng (file · hàm/dòng) |
|---|---|
| **Technical Depth — rule engine** | `ai_engine/risk_engine.py` (`compute_risk`, `_hail_risk`/`_landslide_risk`/`_heavy_rain_flood_risk`/`_fog_risk`) + `thresholds.py` (ngưỡng có nguồn NCHMF/QĐ 18-2021/WMO) + `downscale.py` (hiệu chỉnh nhiệt độ theo cao độ, lapse rate) |
| **Technical Depth — ML #1/#2** | `ai_engine/train_xgb.py` (distillation 4 hiểm hoạ), `ml_engine.py` (`ModelRegistry`, `assess_risk_ml`), `ml_features.py` (`FEATURE_NAMES` — train/serve parity), `eval_xgb.py` (eval tập test độc lập, seed khác train) |
| **AI-Native — ML #3 (điểm mạnh nhất)** | `ai_engine/terrain_engine.py` + `train_terrain.py` (model sạt lở + lũ quét theo **130 xã** train từ đặc trưng địa hình **DEM thật**, `docs/dienbien_risk_theo_xa.csv`), `live_features.py` (mưa **live** Open-Meteo 1h/24h/72h + **GloFAS** river discharge), route `GET /assess-terrain-risk-live` trong `app.py` |
| **AI-Native — bản tin grounded** | `ai_engine/llm_bulletin.py` (`generate_bulletin_llm` — Gemini NEO vào chính `RiskAssessment`, `SYSTEM_INSTRUCTION` cấm bịa số liệu) + `bulletin.py` (`generate_bulletin` — LLM-first, fallback template) |
| **AI-Native — chat có kiểm chứng** | `backend/src/gemini-client.ts` (`SYSTEM_INSTRUCTION`: "CHỈ trả lời dựa trên dữ liệu JSON… KHÔNG bịa số liệu… không hộp đen"), `dashboard/src/lib/chat-assistant.ts` |
| **Safety / Reliability** | Fallback template bắt buộc: `bulletin.py::_generate_bulletin_template`. Không bao giờ 500 vì thiếu model: `ml_engine.assess_risk_ml` (fallback rule engine), `app.py` `predict_flood_risk` (mode="mock"), `terrain_engine` (mode="csv_baseline"). Traceability: mỗi `HazardRisk.detail` tự khai nguồn (`ml_engine.py`). |
| **Đồng bộ ngưỡng 2 service** | `ai_engine/thresholds.py` ↔ `backend/src/alert-dienbien.ts` (kiểm bằng `ai_engine/test_risk.py` + `backend/src/alert-dienbien.test.ts`) |
| **Testing** | `ai_engine`: `python -m pytest -q` → **57 passed** (`test_risk`, `test_bulletin`, `test_downscale`, `test_flood`, `test_ml_engine`, `test_terrain`). `backend`: `alert-dienbien.test.ts`. `dashboard`: `src/lib/api.test.ts`. |
| **Product / Demo** | `dashboard/src` (SvelteKit 5 + Tailwind), bản đồ 130 xã `routes/map`, toggle ngôn ngữ `src/lib/bulletin.ts`, cảnh báo SMS thật `backend/src/sms-client.ts` (`POST /api/notify/sms`) |
| **Minh bạch / BA** | `README.md` mục "Nguồn gốc & Ghi công" (provenance, `git diff --shortstat`), `docs/architecture.md` (kiến trúc + giới hạn đã biết + vì sao không cần DB) |

## 2. Monorepo Architecture & Tech Stack
Project gồm 3 block chính:

- **/backend**: REST API tổng hợp dự báo + đánh giá rủi ro cho Dashboard.
  - *Tech:* Node.js, TypeScript, Express, Zod.
  - *Role:* Gọi Open-Meteo (`weather-ingest.ts`, fallback OpenWeatherMap khi
    lỗi/timeout), gọi AI Engine để đánh giá rủi ro (`ai-risk-client.ts`),
    gộp thành payload cho Dashboard qua `GET /api/dienbien-forecast`,
    `GET /api/bulletins`, `GET /api/mock-notify`.
  - Pipeline là **pull-based, không có DB** — mọi thứ tính on-the-fly mỗi
    request (xem `docs/architecture.md` mục 6 vì sao không cần DB/MQTT).

- **/ai_engine**: Rule engine đánh giá rủi ro + sinh bản tin.
  - *Tech:* Python 3, FastAPI.
  - *Role:* Nhận dự báo nhiều ngày cho 1 địa điểm, áp dụng ngưỡng cảnh báo
    (`risk_engine.py` + `thresholds.py`, PHẢI khớp
    `backend/src/alert-dienbien.ts`), hiệu chỉnh nhiệt độ theo cao độ
    (`downscale.py`), sinh bản tin bằng LLM (`bulletin.py` gọi
    `llm_bulletin.py` — Gemini, NEO vào chính `RiskAssessment` vừa tính,
    không được bịa hiểm hoạ/số liệu ngoài đó). Thiếu `GEMINI_API_KEY` hoặc
    lời gọi LLM lỗi/timeout/rỗng -> tự fallback về ngân hàng template cố
    định (`TEMPLATES` trong `bulletin.py`) — đánh giá rủi ro (rule-based)
    luôn hoạt động, không có mock mode, kể cả khi LLM sập.

- **/dashboard**: Web user interface.
  - *Tech:* SvelteKit (Svelte 5), TypeScript, TailwindCSS.
  - *Role:* Gọi REST API của backend, hiển thị dự báo/cảnh báo cho 3 địa
    điểm demo Điện Biên. Deployed trên Cloudflare Pages (`forestgump`).

## 3. Data Flow
1. `Dashboard` gọi `GET /api/dienbien-forecast` (hoặc `/api/bulletins`,
   `/api/mock-notify`) trên `Backend`.
2. `Backend` gọi Open-Meteo cho 3 địa điểm demo (`backend/src/config/locations.ts`);
   nếu lỗi/timeout thì tự động fallback sang OpenWeatherMap
   (`weather-openweathermap.ts`).
3. `Backend` gửi dự báo đã chuẩn hoá sang `AI Engine` qua
   `POST /assess-risk`.
4. `AI Engine` áp dụng rule engine, trả về risk assessment (3 hiểm hoạ ×
   alert_level/risk_score) + bản tin cảnh báo cho từng ngày.
5. `Backend` gộp dự báo thô + risk + bulletin thành 1 payload, trả cho
   `Dashboard`.
6. `Dashboard` render theo `alert_level` (green/yellow/orange/red).

## 4. Coding Conventions & AI Guidelines
Khi viết code cho project này, PHẢI tuân thủ:

- **TypeScript / JavaScript:** ES6+, `async/await` thay vì `.then()`. Khai
  báo type/interface rõ ràng cho mọi payload.
- **Svelte 5:** BẮT BUỘC dùng Runes (`$state`, `$derived`, `$effect`); không
  dùng cú pháp Svelte 4 cũ. Tách Component độc lập khi hợp lý.
- **Python:** Type hint đầy đủ (vd. `def compute_risk(location: LocationInput, forecast: ForecastInput) -> RiskAssessment:`).
- **Security:** Không hardcode key/URL. Dùng `process.env` (Node.js) hoặc
  `os.getenv` (Python), đọc từ `.env`.
- **Formatting:** Khi tạo file mới, ghi rõ đường dẫn tương đối (vd.
  `backend/src/api.ts`).
- **Ngưỡng cảnh báo:** sửa `ai_engine/thresholds.py` PHẢI sửa cả
  `backend/src/alert-dienbien.ts` (và ngược lại) — 2 service riêng biệt,
  không tự đồng bộ hằng số.
- **Bulletin:** `bulletin.py` gọi LLM (`llm_bulletin.py`, Gemini) để sinh
  nội dung, LUÔN neo (grounded) vào `RiskAssessment` vừa tính — không được
  đổi để model tự bịa hiểm hoạ/số liệu ngoài input. `TEMPLATES` trong
  `bulletin.py` là đường FALLBACK bắt buộc khi thiếu `GEMINI_API_KEY` hoặc
  LLM lỗi/timeout — PHẢI giữ nguyên (không xoá), vì đó là chỗ dựa duy nhất
  đảm bảo bản tin an toàn tính mạng vẫn ra được khi LLM sập. Thêm hazard/
  alert_level mới thì cập nhật cả prompt lẫn `TEMPLATES`.

Quy tắc chung:

- Follow https://svelte.dev/llms.txt khi viết Svelte.
  - Không cập nhật state trong `$effect`. Nếu 1 biến phụ thuộc state khác,
    dùng `$derived`.
- Luôn dùng Svelte 5 syntax và Tailwind utility classes khi có thể.
- Dùng kebab-case cho tên file (không camelCase/snake_case).
- camelCase cho biến, SCREAMING_SNAKE_CASE cho hằng số.
- Dùng Zod validate input cho remote functions (`z.strictObject` ưu tiên
  hơn `z.object`). https://zod.dev/llms.txt.
- Dùng `form` remote functions thay vì form actions khi thêm form; không
  dùng `onsubmit` để submit form. Schema Zod phía client/server phải dùng
  chung 1 file (`.remote.ts` không export được Zod schema trực tiếp).
- Dùng `prerender` remote functions cho dữ liệu chỉ cần cập nhật mỗi lần
  deploy; dùng `load` functions cho dữ liệu động (thêm `Cache-Control` qua
  `setHeaders`, và `export const prerender = false` hoặc `"auto"` trong
  `+page.server.ts`).
- Class dài quá 100 ký tự: chia nhiều dòng bằng `clsx` (`import { clsx } from "$lib/clsx"`).

## 5. Frontend (Dashboard) — Chi tiết cho block `/dashboard`

### 5.1. Nguyên tắc kiến trúc
- Dashboard KHÔNG kết nối DB (backend cũng không có DB, xem mục 2). Chỉ gọi
  REST API của backend qua HTTPS.
- Tập trung mọi lệnh gọi API vào `src/lib/api.ts`.

### 5.2. Data contract với Backend (PHẢI khớp chính xác)
Endpoint chính: `GET /api/dienbien-forecast?location=<code>` — trả về mảng
`DienBienForecastEntry` (xem `backend/src/api.ts` cho type đầy đủ):
```ts
interface DienBienForecastEntry {
  location: { code: string; name: string; terrain: 'thung_lung' | 'nui_cao' | 'ven_suoi'; elevationM: number };
  source: 'open-meteo' | 'openweathermap';
  fetchedAt: string;
  days: {
    date: string; tempMinC: number; tempMaxC: number; precipitationMm: number;
    humidityPct: number; windSpeedKmh: number;
    hazards: { hazard: 'hail' | 'landslide' | 'heavy_rain_flood' | 'fog'; alert_level: 'green'|'yellow'|'orange'|'red'; risk_score: number; detail: string }[];
    bulletin: string;
  }[];
  aiEngineError?: string;
}
```
- Không truyền `location` → trả cả 3 địa điểm demo.
- Địa điểm không khớp mã → 404.
- Lỗi AI Engine cho 1 địa điểm KHÔNG làm hỏng cả response (`days: []` +
  `aiEngineError`).

### 5.3. Configuration & security
- Địa chỉ backend đọc từ env `PUBLIC_API_URL` (không hardcode).
- **CORS:** dashboard (Cloudflare Pages, `forestgump`) khác domain với API
  (VPS) → backend phải cho phép domain dashboard (`backend/src/api.ts`,
  biến `CORS_ORIGIN`).
- Cả 2 phía dùng HTTPS ở production.

### 5.4. Cấu trúc thư mục hiện tại
```
dashboard/src/
├── routes/
│   ├── +page.svelte / +page.server.ts        # Tổng quan
│   ├── locations/, locations/[id]/            # Chi tiết địa điểm
│   ├── map/                                    # Bản đồ Điện Biên
│   ├── alerts/                                 # Lịch sử cảnh báo
│   └── login/                                  # Auth (mock, client-side — src/lib/auth.ts)
└── lib/
    ├── api.ts            # MỌI lệnh gọi REST API
    ├── types.ts, derive.ts, mock.ts
    └── components/
```

### 5.5. Hiển thị
- **Real-time = polling** (gọi lại API định kỳ), KHÔNG cần WebSocket. Dọn
  `setInterval` khi rời trang; không cập nhật `$state` sai trong `$effect`.

### 5.6. Màu cảnh báo (map từ `alert_level`)
| `alert_level` | Tailwind class | Ý nghĩa |
|---|---|---|
| `green`  | `bg-green-500`  | Bình thường |
| `yellow` | `bg-yellow-500` | Cảnh báo — theo dõi |
| `orange` | `bg-orange-500` | Nguy hiểm — chuẩn bị hành động |
| `red`    | `bg-red-600`    | Rất nguy hiểm — hành động ngay |

### 5.7. Cloudflare Pages deployment
- `adapter-cloudflare`; trang động phải set `export const prerender = false`.
- Build: `pnpm build`; khai báo `PUBLIC_API_URL` trên Cloudflare. Push code
  → auto build & deploy (`dashboard/wrangler.jsonc`, project name `forestgump`).

## Available MCP Tools

### 1. list-sections
Dùng ĐẦU TIÊN để khám phá các mục tài liệu Svelte/SvelteKit có sẵn.

### 2. get-documentation
Lấy nội dung đầy đủ cho các mục cụ thể — sau khi gọi `list-sections`, PHẢI
phân tích `use_cases` rồi gọi tool này cho mọi mục liên quan tới task.

### 3. svelte-autofixer
PHẢI dùng cho mọi code Svelte trước khi gửi cho user — gọi lặp lại tới khi
hết issue/suggestion.

### 4. playground-link
Chỉ dùng SAU khi user xác nhận muốn link, và KHÔNG dùng nếu code đã ghi vào
file trong project.

- Commit theo Conventional Commits.
- Luôn chạy `pnpm lint` trước khi commit, sửa hết warning/error.
