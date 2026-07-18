# Forestgump — Cảnh báo thiên tai sớm Điện Biên

Hệ thống cảnh báo sớm 3 loại thiên tai tại Điện Biên: **mưa lớn/lũ quét**,
**rét đậm/rét hại**, **sương mù dày**. Lấy dự báo thời tiết từ Open-Meteo
(nguồn chính, fallback OpenWeatherMap), đánh giá rủi ro bằng rule engine
(ngưỡng nghiệp vụ đã xác nhận, không phải ML), sinh bản tin cảnh báo bằng
template cố định, hiển thị trên dashboard web.

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
                                   (dự báo thời tiết)                       (template cố định)
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

## Tài liệu khác

- [docs/architecture.md](docs/architecture.md) — kiến trúc, luồng dữ liệu, giới hạn hệ thống, roadmap.
- [ai_engine/README.md](ai_engine/README.md) — chi tiết rule engine + 2 nhánh ML (shadow deployment).
- [claude.md](claude.md) — coding conventions, quy tắc cho AI assistant.
- [LICENSE](LICENSE)
