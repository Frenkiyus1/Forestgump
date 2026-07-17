# SaliGuard — Hướng dẫn Deploy

Kiến trúc triển khai (theo CLAUDE.md):

```
                          ┌─────────────────────────┐
   Người dùng ──HTTPS──►  │  Cloudflare Pages        │   (dashboard - SvelteKit)
                          │  saliguard.pages.dev     │
                          └───────────┬──────────────┘
                                      │ gọi REST API qua HTTPS
                                      ▼
                          ┌─────────────────────────────────────────────┐
                          │  VPS (Docker)                                │
   ESP32 ──MQTT/TLS:8883─►│  caddy(443) → backend(3000) → ai_engine(8000)│
                          │                    └→ db(5432)               │
                          │  mqtt(8883 TLS / 1883 nội bộ)                │
                          └─────────────────────────────────────────────┘
```

- **Dashboard** → Cloudflare Pages (tĩnh, build từ `/dashboard`).
- **Backend + AI Engine + DB + MQTT** → 1 VPS, chạy bằng `docker-compose.prod.yml`.
- DB và AI Engine **không** mở ra Internet. Chỉ Caddy (443/80) và MQTT TLS (8883) lộ ra ngoài.

---

## A. Chuẩn bị VPS

### A.1 Chọn nhà cung cấp
Cần ~2 GB RAM (xgboost + Postgres). Gợi ý (dễ dùng → rẻ nhất):
- **DigitalOcean** droplet 2 GB / 2 vCPU (~$12/tháng) — dễ đăng ký & dùng nhất, hay có credit thử. Chọn region **Singapore** cho gần VN.
Chọn image **Ubuntu 24.04 LTS**.

### A.2 Cài Docker trên VPS
```bash
ssh root@<VPS_IP>
curl -fsSL https://get.docker.com | sh
docker compose version   # xác nhận có plugin compose
```

### A.3 DNS
Tạo 2 bản ghi **A** trỏ về IP VPS:
| Record | Trỏ tới |
|--------|---------|
| `api.saliguard.example.com`  | `<VPS_IP>` |
| `mqtt.saliguard.example.com` | `<VPS_IP>` |

### A.4 Mở firewall
Mở cổng **80, 443** (HTTP/HTTPS cho Caddy) và **8883** (MQTT TLS). KHÔNG mở 5432/8000/1883.

> **TẠM (demo, chưa có cert TLS):** nếu đang dùng listener `1884` (không TLS, xem
> `infra/mosquitto/mosquitto.prod.conf`) để demo trong lúc chờ DNS + Let's Encrypt
> cho `8883`, cần mở thêm cổng **1884**. Đóng lại cổng này khi 8883/TLS đã chạy được.

---

## B. Triển khai backend stack lên VPS

### B.1 Lấy mã nguồn
```bash
git clone <repo-url> saliguard && cd saliguard
```

### B.2 Tạo file cấu hình `.env`
```bash
cp .env.prod.example .env
nano .env          # điền DB_PASSWORD mạnh, API_DOMAIN, CORS_ORIGIN...
```

### B.3 Chứng chỉ TLS cho MQTT (Let's Encrypt)
Lấy cert cho domain MQTT bằng certbot rồi copy vào `infra/mosquitto/certs/`:
```bash
apt install -y certbot
certbot certonly --standalone -d mqtt.saliguard.example.com   # cần cổng 80 rảnh

mkdir -p infra/mosquitto/certs
cp /etc/letsencrypt/live/mqtt.saliguard.example.com/fullchain.pem infra/mosquitto/certs/
cp /etc/letsencrypt/live/mqtt.saliguard.example.com/privkey.pem   infra/mosquitto/certs/
chmod 644 infra/mosquitto/certs/*.pem
```
> Cert hết hạn sau 90 ngày — đặt cron `certbot renew` + copy lại + `docker compose ... restart mqtt`.

### B.4 Tạo user/password cho MQTT (thiết bị đăng nhập)
```bash
docker run --rm -v "$PWD/infra/mosquitto:/m" eclipse-mosquitto:2 \
  mosquitto_passwd -b -c /m/passwd esp32 <mat_khau_thiet_bi>
```
(`esp32` là username; thêm user khác: bỏ cờ `-c`.)

### B.5 Model AI
Sinh model (compose mount `./ai_engine/models` vào container):
```bash
cd ai_engine
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python train.py --out models      # tạo models/xgboost_model.json + _48h.json
cd ..
```
Hoặc train ở máy khác rồi copy 2 file vào `ai_engine/models/`. Không có file →
AI Engine chạy **mock mode** (dự báo ngẫu nhiên), hệ thống vẫn hoạt động.
Chi tiết: xem [ai_engine/README.md](ai_engine/README.md).

### B.6 Khởi động
```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```
Schema DB tự nạp lần đầu (volume trống). Nếu sau này đổi `schema.sql`, chạy lại migration:
```bash
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U postgres -d saliguard < backend/schema.sql
```

### B.7 Kiểm tra
```bash
curl https://api.saliguard.example.com/health      # {"status":"ok",...}
curl https://api.saliguard.example.com/api/stations # JSON 8 trạm
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
   PUBLIC_API_URL = https://api.saliguard.example.com
   ```
4. Save → Cloudflare tự build & deploy. Push code lên `main` → tự deploy lại.
5. Lấy domain Pages (vd `saliguard.pages.dev`) và **thêm vào `CORS_ORIGIN`** trong `.env` của VPS rồi:
   ```bash
   docker compose -f docker-compose.prod.yml up -d backend   # nạp lại CORS
   ```

> Đảm bảo `CORS_ORIGIN` (VPS) và domain Pages khớp nhau, nếu không trình duyệt sẽ chặn API.

---

## D. Firmware ESP32 (kết nối broker production)

> **Yêu cầu:** Backend + Mosquitto đã chạy trên VPS (mục B xong). Cần cài
> [PlatformIO IDE](https://platformio.org/install/ide?install=vscode) (VS Code extension).

### D.1 Xác nhận broker đang mở từ ngoài

Từ máy tính bàn (không phải VPS), chạy lệnh sau để chắc cổng 8883 thông:

```bash
mosquitto_pub -h <VPS_IP> -p 8883 \
  --cafile isrg-root-x1.pem \
  -u esp32 -P <mat_khau_thiet_bi> \
  -t waterqa/ST001/telemetry \
  -m '{"temp":28.0,"ec":0.5,"level":0}'
```

Đồng thời xem log backend trên VPS:
```bash
docker compose -f docker-compose.prod.yml logs -f backend
# Phải thấy: [MQTT] ST001 => { temp: 28, ec: 0.5, level: 0 }
```
Nếu thấy log → broker nhận được → tiếp tục D.2. Nếu không → kiểm tra firewall VPS (mục A.4).

### D.2 Lấy CA certificate (Let's Encrypt)

Firmware cần cert CA để xác thực TLS với broker. Với cert Let's Encrypt, CA root là
**ISRG Root X1** — tải file PEM về máy:

```bash
curl -o isrg-root-x1.pem \
  https://letsencrypt.org/certs/isrg-root-x1.pem
```

Hoặc lấy thẳng từ VPS (cert đã có):
```bash
scp root@<VPS_IP>:/etc/letsencrypt/live/mqtt.saliguard.example.com/chain.pem \
    ./isrg-root-x1.pem
```

### D.3 Tạo file `secrets.h`

```bash
cp firmware/include/secrets.example.h firmware/include/secrets.h
```

Mở [firmware/include/secrets.h](firmware/include/secrets.h) và điền:

```cpp
// APN theo nhà mạng SIM 4G đang cắm vào module TDM-4G-V2
#define SECRET_APN          "v-internet"   // Viettel; Mobifone: "m-wap"; Vina: "m3-world"
#define SECRET_APN_USER     ""
#define SECRET_APN_PASS     ""

// Địa chỉ broker MQTT trên VPS — dùng domain (Let's Encrypt cert gắn với domain)
#define SECRET_MQTT_HOST    "mqtt.saliguard.example.com"   // domain hoặc IP VPS
#define SECRET_MQTT_PORT    8883                           // TLS

// User/pass đã tạo ở bước B.4
#define SECRET_MQTT_USER    "esp32"
#define SECRET_MQTT_PASS    "mat_khau_thiet_bi"

// ID trạm — phải khớp key trong STATION_PROVINCE / STATION_NAME ở backend/src/index.ts
#define SECRET_STATION_ID   "ST001"
```

> `secrets.h` đã có trong `.gitignore` — **không bao giờ commit** file này.

### D.4 Nhúng CA cert vào firmware

Mở [firmware/src/modem-mqtt.cpp](firmware/src/modem-mqtt.cpp), thêm đoạn sau vào đầu file
(sau phần `#include`):

```cpp
// CA cert ISRG Root X1 (Let's Encrypt) — dùng để xác thực TLS với broker.
// Lấy từ: https://letsencrypt.org/certs/isrg-root-x1.pem
// Nội dung bên dưới: sao chép toàn bộ nội dung file PEM vào đây.
static const char CA_CERT[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
... (paste toàn bộ nội dung isrg-root-x1.pem vào đây)
-----END CERTIFICATE-----
)EOF";
```

Sau đó trong hàm `modemBegin()`, sau khi `TinyGsmClientSecure gsmClient(modem)` được khởi tạo,
thêm dòng set CA:

```cpp
gsmClient.setCACert(CA_CERT);
```

> Nếu muốn bỏ qua xác thực TLS trong khi test (không dùng production):
> thay bằng `gsmClient.setInsecure()` — **xóa trước khi deploy thật**.

### D.5 Build và nạp firmware

1. Mở thư mục `firmware/` bằng VS Code (PlatformIO tự nhận `platformio.ini`).
2. Cắm ESP32 vào máy tính qua USB.
3. Chọn đúng COM port trong thanh PlatformIO ở dưới cùng.
4. Nhấn **Upload** (mũi tên →) hoặc chạy:
   ```bash
   pio run --target upload
   ```
5. Mở **Serial Monitor** (115200 baud) ngay sau khi nạp xong.

### D.6 Kiểm tra qua Serial Monitor

Luồng khởi động thành công trông như sau:

```
=== SaliGuard firmware - station ST001 ===
[MODEM] Test AT lần 1/10...
[MODEM] ✅ Modem phản hồi AT - UART OK
[SIM] Trạng thái: READY (SIM tốt, không khóa PIN)
[SIM] Cường độ sóng (CSQ): 18
[MODEM] Kết nối APN v-internet
[MODEM] Đã có IP: 10.x.x.x
[MODEM] Nhà mạng: Viettel
[MQTT] Kết nối broker... OK
[SENS] temp=28.50 C | ec=0.432 g/L | level=0.00 m | vbat=12.40 V
[MQTT] publish waterqa/ST001/telemetry => {"temp":28.5,"ec":0.432,"level":0}
```

Đồng thời trên VPS:
```bash
docker compose -f docker-compose.prod.yml logs -f backend
# [MQTT] ST001 => { temp: 28.5, ec: 0.432, level: 0 }
# [AI]  ST001 forecast_24h = 0.51 g/L, forecast_48h = 0.49 g/L
```

### D.7 Xử lý lỗi thường gặp

| Log Serial Monitor | Nguyên nhân | Cách sửa |
|--------------------|-------------|-----------|
| `Modem KHÔNG phản hồi AT` | UART sai / chưa cấp nguồn | Kiểm tra TX↔RX đấu chéo (GPIO17→TXD modem, GPIO16←RXD modem); đo điện áp chân PEN |
| `không nhận SIM` | SIM lắp ngược hoặc chưa kích hoạt | Lắp lại SIM, thử SIM trên điện thoại trước |
| `GPRS thất bại` | APN sai | Đổi `SECRET_APN` theo nhà mạng (xem comment trong `secrets.h`) |
| `MQTT rc=-2` | Không tới được broker | Kiểm tra firewall VPS cổng 8883; thử `SECRET_MQTT_HOST` bằng IP thay vì domain |
| `MQTT rc=-4` | Sai user/pass | Tạo lại passwd ở bước B.4, đúng với `SECRET_MQTT_PASS` |
| `MQTT rc=-5` | TLS thất bại (cert sai) | Kiểm tra CA cert đã paste đúng chưa; hoặc tạm dùng `setInsecure()` để xác định nguyên nhân |

---

## E. Ghi nhớ vận hành
- **Backup DB**: `docker compose -f docker-compose.prod.yml exec -T db pg_dump -U postgres saliguard > backup.sql`
- **Xem log**: `docker compose -f docker-compose.prod.yml logs -f <service>`
- **Cập nhật code**: `git pull && docker compose -f docker-compose.prod.yml up -d --build`
- **Bí mật KHÔNG commit**: `.env`, `infra/mosquitto/passwd`, `infra/mosquitto/certs/` (đã có trong `.gitignore`).
