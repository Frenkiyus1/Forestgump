# SaliGuard — Chạy local (Development)

Hướng dẫn này giúp bất kỳ ai `git clone`/`git pull` repo này cũng chạy ra **kết quả giống hệt nhau**,
bất kể hệ điều hành. Với việc deploy production lên VPS, xem [DEPLOY.md](DEPLOY.md).

## 1. Yêu cầu cài sẵn

| Công cụ | Phiên bản | Dùng cho |
|---|---|---|
| [Node.js](https://nodejs.org/) | 22 LTS trở lên | backend, dashboard |
| [Python](https://www.python.org/) | 3.12 | ai_engine |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | mới nhất | PostgreSQL + TimescaleDB, MQTT broker |
| [pnpm](https://pnpm.io/installation) | mới nhất | dashboard (`npm install -g pnpm`) |

> Không có Docker? Có thể cài PostgreSQL 17 native, nhưng TimescaleDB sẽ không có sẵn trên
> Windows/macOS (chỉ ảnh hưởng hiệu năng time-series, không ảnh hưởng chức năng) — xem mục 6.

## 2. Hạ tầng nền (DB + MQTT)

```bash
docker compose up -d
docker compose ps          # đợi cả 2 container "healthy"/"running"
```

Lệnh này tự tạo database `saliguard`, nạp sẵn `backend/schema.sql` (bảng `stations` + 15 trạm mẫu,
bảng `telemetry`) và khởi động Mosquitto MQTT broker ở `localhost:1883`. Không cần chạy `schema.sql`
thủ công.

## 3. Biến môi trường

```bash
cp backend/.env.example backend/.env
cp dashboard/.env.example dashboard/.env
```

Giá trị mặc định trong `backend/.env.example` đã khớp sẵn với `docker-compose.yml`
(user/pass `postgres`, DB `saliguard`, MQTT `mqtt://localhost:1883`) — không cần sửa gì để chạy local.
`dashboard/.env` mặc định trỏ `PUBLIC_API_URL=http://localhost:3000`.

## 4. Cài dependencies

```bash
# Root (concurrently, để chạy chung backend + ai_engine)
npm install

# Backend
npm --prefix backend install

# AI Engine
python -m pip install -r ai_engine/requirements.txt

# Dashboard
cd dashboard && pnpm install && cd ..
```

Nếu `pnpm install` báo `ERR_PNPM_IGNORED_BUILDS`, đó là vì `dashboard/pnpm-workspace.yaml` chặn
build script của `esbuild`/`sharp`/`workerd` theo mặc định bảo mật của pnpm — file này đã được cấu
hình sẵn `allowBuilds: true` cho cả 3 package trong repo, chỉ cần `pnpm install` lại là xong.

## 5. Chạy

Mở 2 terminal:

```bash
# Terminal 1: backend (:3000) + ai_engine (:8000)
npm run dev

# Terminal 2: dashboard (:5173)
cd dashboard && pnpm dev
```

Mở **http://localhost:5173** — đây là URL duy nhất cần truy cập, dashboard tự gọi API backend/AI
engine phía sau. Đăng nhập bằng tài khoản demo trong `dashboard/src/lib/auth.ts`
(`admin@saliguard.vn` / `saliguard123`) hoặc bấm "Tiếp tục với tư cách khách".

## 6. Không có Docker (fallback PostgreSQL native)

1. Cài PostgreSQL 17, tạo database `saliguard`.
2. Nạp schema: `psql -U postgres -d saliguard -f backend/schema.sql`
   (dòng `CREATE EXTENSION timescaledb` và `create_hypertable(...)` sẽ báo lỗi nếu không có
   TimescaleDB — bỏ qua, các bảng vẫn được tạo bình thường dưới dạng bảng thường).
3. Sửa `backend/.env` cho khớp user/password/port Postgres bạn vừa tạo.
4. MQTT broker là tùy chọn — không có broker, backend chỉ log `[MQTT] Connection error` liên tục,
   không ảnh hưởng dashboard.
