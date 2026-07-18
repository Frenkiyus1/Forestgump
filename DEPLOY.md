# Forestgump — Hướng dẫn Deploy

Kiến trúc triển khai (theo `claude.md` / `docs/architecture.md`):

```
                          ┌─────────────────────────┐
   Người dùng ──HTTPS──►  │  Cloudflare Pages        │   (dashboard - SvelteKit)
                          │  forestgump.pages.dev   │
                          └───────────┬──────────────┘
                                      │ gọi REST API qua HTTPS
                                      ▼
                          ┌─────────────────────────────────┐
                          │  VPS (Docker)                     │
                          │  caddy(443) → backend(3000)       │
                          │                    └→ ai_engine(8000)│
                          └─────────────────────────────────┘
                                      │
                                      ▼ (ra Internet)
                    Open-Meteo / OpenWeatherMap / NCHMF
```

- **Dashboard** → Cloudflare Pages (tĩnh, build từ `/dashboard`).
- **Backend + AI Engine** → 1 VPS nhỏ, chạy bằng `docker-compose.prod.yml`.
- Không có DB/MQTT — pipeline pull-based, tính on-the-fly mỗi request (xem
  `docs/architecture.md` mục 6). AI Engine **không** mở ra Internet, chỉ
  Caddy (443/80) lộ ra ngoài.

---

## A. Chuẩn bị VPS

### A.1 Chọn nhà cung cấp
Backend + AI Engine đều nhẹ (không có model ML nào phải load) — VPS 1 GB
RAM là đủ. Gợi ý: **DigitalOcean** droplet 1-2 GB / 1 vCPU, region
**Singapore** cho gần VN, image **Ubuntu 24.04 LTS**.

### A.2 Cài Docker trên VPS
```bash
ssh root@<VPS_IP>
curl -fsSL https://get.docker.com | sh
docker compose version   # xác nhận có plugin compose
```

### A.3 DNS
Tạo 1 bản ghi **A** trỏ về IP VPS:
| Record | Trỏ tới |
|--------|---------|
| `api.forestgump.example.com` | `<VPS_IP>` |

### A.4 Mở firewall
Mở cổng **80, 443** (HTTP/HTTPS cho Caddy). KHÔNG mở 3000/8000.

---

## B. Triển khai backend stack lên VPS

### B.1 Lấy mã nguồn
```bash
git clone <repo-url> forestgump && cd forestgump
```

### B.2 Tạo file cấu hình `.env`
```bash
cp .env.prod.example .env
nano .env          # điền API_DOMAIN, CORS_ORIGIN, OPENWEATHERMAP_API_KEY (tuỳ chọn)...
```

### B.3 Khởi động
```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

### B.4 Kiểm tra
```bash
curl https://api.forestgump.example.com/health                    # {"status":"ok",...}
curl https://api.forestgump.example.com/api/dienbien-forecast     # JSON 3 địa điểm demo
```

---

## C. Dashboard → Cloudflare Pages

Dashboard đã dùng `@sveltejs/adapter-cloudflare` nên deploy thẳng lên Pages.

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → chọn repo.
2. Cấu hình build:
   | Mục | Giá trị |
   |-----|---------|
   | Production branch | `main` |
   | Framework preset  | SvelteKit |
   | Root directory    | `dashboard` |
   | Build command     | `pnpm install && pnpm build` |
   | Build output dir  | `.svelte-kit/cloudflare` |
3. **Environment variables** (Settings → Environment variables) → thêm:
   ```
   PUBLIC_API_URL = https://api.forestgump.example.com
   ```
4. Save → Cloudflare tự build & deploy. Push code lên `main` → tự deploy lại.
5. Lấy domain Pages thật (vd `forestgump.pages.dev` hoặc custom domain) và
   **thêm vào `CORS_ORIGIN`** trong `.env` của VPS rồi:
   ```bash
   docker compose -f docker-compose.prod.yml up -d backend   # nạp lại CORS
   ```
   (Domain mặc định `https://forestgump.pages.dev` đã được cho phép cứng
   trong `backend/src/api.ts` — chỉ cần điền `CORS_ORIGIN` nếu dùng domain
   khác/thêm.)

> Đảm bảo `CORS_ORIGIN` (VPS) và domain Pages khớp nhau, nếu không trình duyệt sẽ chặn API.

---

## D. Ghi nhớ vận hành
- **Xem log**: `docker compose -f docker-compose.prod.yml logs -f <service>`
- **Cập nhật code**: `git pull && docker compose -f docker-compose.prod.yml up -d --build`
- **Bí mật KHÔNG commit**: `.env` (đã có trong `.gitignore`).
- Không có DB để backup/migrate — pipeline không lưu trạng thái.

---

## E. (Thay thế A+B) Tự host tại nhà bằng Cloudflare Tunnel

Dùng máy cá nhân/server tại nhà thay VPS. Hầu hết mạng gia đình VN dùng
**CGNAT** (không có IP public) nên cách Caddy mở cổng 80/443 ở phần A-B
**không hoạt động được** — Cloudflare Tunnel giải quyết việc này: máy nhà
chỉ cần kết nối **outbound** ra Cloudflare, không cần mở port trên
router/modem, không cần IP tĩnh.

### E.1 Cài Docker trên máy tự host
Cài Docker Desktop (Windows/Mac) hoặc Docker Engine (Linux) như bình thường.

### E.2 Tạo Tunnel trên Cloudflare
1. Vào **Cloudflare Zero Trust dashboard** → **Networks** → **Tunnels** →
   **Create a tunnel** → chọn **Cloudflared** → đặt tên (vd `forestgump-api`).
2. Ở bước **Install and run a connector**, chọn tab **Docker** → copy đoạn
   token dài trong lệnh mẫu (`cloudflared service install <TOKEN>` — chỉ lấy
   phần `<TOKEN>`) → dán vào `CLOUDFLARE_TUNNEL_TOKEN` trong `.env`.
3. Bấm **Next** → mục **Public Hostname**, khai báo:
   | Trường | Giá trị |
   |---|---|
   | Subdomain | `api` |
   | Domain | domain bạn đã thêm vào Cloudflare (xem lưu ý bên dưới) |
   | Service Type | `HTTP` |
   | URL | `backend:3000` |
4. Save.

> **Cần domain riêng đã add vào Cloudflare** (mua ở đâu cũng được, chỉ cần
> trỏ nameserver về Cloudflare — miễn phí). `*.pages.dev`/`*.workers.dev`
> không dùng được cho bước này vì đó là domain Cloudflare quản lý, không
> phải zone của bạn.
>
> **Muốn test ngay hôm nay, chưa có domain?** Dùng Quick Tunnel (tạm thời,
> URL đổi mỗi lần chạy lại — không dùng cho lâu dài):
> ```bash
> docker run --rm cloudflare/cloudflared:latest tunnel --url http://<IP-máy-nhà>:3000
> ```
> Cloudflare trả về 1 URL `https://xxxx.trycloudflare.com` — dùng tạm làm
> `PUBLIC_API_URL` để kiểm tra dashboard chạy được, rồi chuyển sang Named
> Tunnel (E.2) khi có domain.

### E.3 Tạo `.env` và khởi động
```bash
cp .env.prod.example .env
nano .env    # điền CORS_ORIGIN, CLOUDFLARE_TUNNEL_TOKEN, OPENWEATHERMAP_API_KEY

docker compose -f docker-compose.selfhost.yml up -d --build
docker compose -f docker-compose.selfhost.yml logs -f cloudflared   # chờ dòng "Registered tunnel connection"
```

### E.4 Kiểm tra
```bash
curl https://api.<domain-của-bạn>/health
curl https://api.<domain-của-bạn>/api/dienbien-forecast
```
Rồi set `PUBLIC_API_URL = https://api.<domain-của-bạn>` trên Cloudflare
Pages (Settings → Environment variables) như phần C.3, retry deployment.

### E.5 Lưu ý khi tự host
- Máy phải bật 24/7 — mất điện/rớt mạng nhà = API chết. Chỉ phù hợp demo/thử
  nghiệm, không phù hợp hệ thống cảnh báo cần độ tin cậy cao trong thực tế.
- Không cần mở port trên router, không cần Caddy/Let's Encrypt — Cloudflare
  Tunnel tự lo HTTPS.
- **Cập nhật code**: `git pull && docker compose -f docker-compose.selfhost.yml up -d --build`
