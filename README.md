# Forestgump — Cảnh báo thiên tai sớm Điện Biên

Hệ thống cảnh báo sớm 4 loại thiên tai tại Điện Biên: **mưa lớn/lũ quét**,
**mưa đá**, **sạt lở đất**, **sương mù dày**. Lấy dự báo thời tiết từ Open-Meteo
(nguồn chính, fallback OpenWeatherMap), đánh giá rủi ro bằng rule engine
(ngưỡng nghiệp vụ đã xác nhận, không phải ML), sinh bản tin cảnh báo bằng
LLM (Gemini) neo vào chính đánh giá rủi ro đó — tự fallback template cố
định nếu LLM chưa cấu hình/lỗi — hiển thị trên dashboard web.

Bổ sung [THAM KHẢO]: model ML **sạt lở đất + lũ quét theo 130 xã** train từ
đặc trưng địa hình DEM thật ([docs/dienbien_risk_theo_xa.csv](docs/dienbien_risk_theo_xa.csv))
kết hợp mưa **live** từ Open-Meteo (1h/24h/72h vừa qua + dự báo 24h tới),
độ ẩm đất, xác suất mưa và lưu lượng sông GloFAS — xem
[ai_engine/README.md](ai_engine/README.md) mục 7.

> Tài liệu chi tiết cho AI coding agent Claude Code: xem
> **[claude.md](claude.md)**. Kiến trúc/luồng dữ liệu đầy đủ + giới hạn hệ
> thống: xem **[docs/architecture.md](docs/architecture.md)**.

## Kiến trúc tổng quan

```
Dashboard (SvelteKit)  ──HTTPS──►  Backend (Express)  ──POST /assess-risk──►  AI Engine (FastAPI)
                                         │                                          │
                                         ▼                                          ▼
                              Open-Meteo / OpenWeatherMap                  rule engine + bulletin
                                   (dự báo thời tiết)                    (LLM, fallback template)
```

Không có DB/MQTT — pipeline **pull-based**, tính on-the-fly mỗi request (lý
do: xem `docs/architecture.md` mục 6).

### Nguồn dữ liệu live (miễn phí, không cần API key)

| API | Dùng cho | Đặc trưng lấy về |
|---|---|---|
| [Open-Meteo Forecast](https://open-meteo.com/en/docs) | Dự báo 3 địa điểm demo + mưa live theo xã | Nhiệt độ, mưa (1h/24h/72h qua + dự báo), độ ẩm, gió, điểm sương, tầm nhìn, độ ẩm đất, xác suất mưa |
| [OpenWeatherMap](https://openweathermap.org/api) (fallback, cần key) | Dự phòng khi Open-Meteo lỗi/timeout | Dự báo ngày cơ bản |
| [Open-Meteo Flood (GloFAS)](https://open-meteo.com/en/docs/flood-api) | Chỉ báo lũ quét theo xã | Lưu lượng sông hôm nay + đỉnh 7 ngày tới |
| [Open-Meteo Elevation](https://open-meteo.com/en/docs/elevation-api) | Feature tĩnh cho model theo xã | Độ cao centroid 130 xã (cache 1 lần lúc train) |

## Monorepo — 3 block chính

| Thư mục | Vai trò | Tech |
|---|---|---|
| [`/backend`](backend) | REST API tổng hợp dự báo + risk cho dashboard (`GET /api/dienbien-forecast`, `/api/bulletins`, `/api/mock-notify`) | Node.js, TypeScript, Express, Zod |
| [`/ai_engine`](ai_engine/README.md) | Rule engine đánh giá rủi ro + sinh bản tin (xem README riêng — có 3 nhánh ML song song, không thay rule engine: lũ quét nhị phân, multi-hazard shadow, sạt lở/lũ quét theo 130 xã từ DEM + mưa live) | Python 3, FastAPI, XGBoost |
| [`/dashboard`](dashboard) | Web UI, hiển thị dự báo/cảnh báo cho 3 địa điểm demo Điện Biên. Deploy trên Cloudflare Pages | SvelteKit (Svelte 5), TypeScript, Tailwind |

## Bắt đầu nhanh

- **Chạy local (dev):** xem **[SETUP.md](SETUP.md)** — không cần Docker, có
  sẵn prompt để nhờ AI coding agent tự làm hết.
- **Deploy production (VPS hoặc tự host qua Cloudflare Tunnel):** xem
  **[DEPLOY.md](DEPLOY.md)**.

```bash
# Local dev, 2 terminal
npm install && npm run dev          # backend (:3000) + ai_engine (:8000)
cd dashboard && pnpm install && pnpm dev   # dashboard (:5173)
```

Mở **http://localhost:5173**.

## Kiểm thử (test)

```bash
# AI Engine (Python) — rule engine, bulletin, 3 nhánh ML
cd ai_engine && python -m pytest -q            # 57 passed

# Backend (Node) — đồng bộ ngưỡng cảnh báo với ai_engine/thresholds.py
cd backend && npm test                         # alert-dienbien.test.ts

# Dashboard (SvelteKit) — client API + adapter
cd dashboard && pnpm test                       # src/lib/api.test.ts
```

Bộ test `ai_engine` khoá chặt: ngưỡng `thresholds.py` khớp
`backend/src/alert-dienbien.ts`, bản tin fallback template khi thiếu LLM, và
cả 3 nhánh ML không bao giờ trả lỗi 500 khi chưa có model (fallback rule
engine / mock / csv_baseline).

## Vận hành self-host (Quick Tunnel)

Nếu chạy `docker-compose.selfhost.yml` với Quick Tunnel (không có domain
riêng), URL `https://xxxx.trycloudflare.com` đổi mỗi lần container
`cloudflared` restart — dùng `infra/tunnel-watchdog.sh` để tự phát hiện
tunnel chết và cập nhật `dashboard/.env` (`PUBLIC_API_URL`) không cần thao
tác thủ công:

```bash
nohup ./infra/tunnel-watchdog.sh > /tmp/tunnel-watchdog.log 2>&1 &
```

Quick Tunnel **không có cam kết uptime** — script này là cần thiết, không
phải tuỳ chọn, khi tự host qua Quick Tunnel. Chỉ dùng để demo/thử nghiệm;
production thật nên dùng VPS + Caddy (`DEPLOY.md` phần A-D) hoặc Named
Tunnel (`DEPLOY.md` phần E.2).

## Nguồn gốc & Ghi công (Provenance & Attribution)

Repo được xây dựng trong khuôn khổ **hackathon 48 giờ**. Để minh bạch về
nguồn gốc mã nguồn:

- **Điểm xuất phát (scaffold):** Đầu cửa sổ 48 giờ, nhóm import một bộ khung
  monorepo từ một dự án trước đó **của cùng các thành viên** — *SaliGuard*,
  một hệ thống cảnh báo sớm **xâm nhập mặn** (nghiệp vụ hoàn toàn không liên
  quan tới Forestgump) — chỉ dùng làm **tham chiếu cấu trúc monorepo**.
  Commit `94c7b36` — "Add initial project", 13:45 17/07/2026.
- **Gỡ bỏ mã kế thừa:** Phần lớn mã import — gồm **toàn bộ thư mục `firmware/`
  (IoT)**, **pipeline xâm nhập mặn**, và **schema DB cũ** — đã được **gỡ bỏ
  hoàn toàn** trong commit "Trim backend and ai_engine to the Dien Bien MVP
  pipeline" (`df9180c`, 14:25 18/07/2026).
- **Toàn bộ nghiệp vụ Forestgump được viết mới từ đầu** trong 48 giờ
  hackathon: rule engine ngưỡng rủi ro Điện Biên (Thông tư 25/2022, Quyết
  định 18/2021/QĐ-TTg Điều 44), model ML sạt lở đất/lũ quét theo **130 xã**
  train trên đặc trưng địa hình DEM thật + dữ liệu GloFAS, dashboard
  SvelteKit, template bản tin cảnh báo, và trợ lý chat có kiểm chứng
  (grounded).
- **Quy mô thay đổi:** kể từ điểm import ban đầu, lịch sử git ghi nhận
  **+30.782 / −12.116 dòng** thay đổi — tái lập bằng
  `git diff --shortstat 94c7b36 main`.

## Tài liệu khác

- [docs/architecture.md](docs/architecture.md) — kiến trúc, luồng dữ liệu, giới hạn hệ thống, roadmap.
- [ai_engine/README.md](ai_engine/README.md) — chi tiết rule engine + 2 nhánh ML (shadow deployment).
- [claude.md](claude.md) — coding conventions, quy tắc cho AI assistant.
- [LICENSE](LICENSE)
