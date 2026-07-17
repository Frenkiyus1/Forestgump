# ForestGump — Chạy local (Development)

Hướng dẫn này giúp bất kỳ ai `git clone`/`git pull` repo này cũng chạy ra **kết quả giống hệt nhau**,
bất kể hệ điều hành. Với việc deploy production lên VPS, xem [DEPLOY.md](DEPLOY.md).

## 0. Cách nhanh nhất — nhờ AI coding agent làm hộ

Nếu bạn đang dùng Claude Code, Cursor, Antigravity hay agent tương tự, **không cần đọc các mục bên
dưới** — copy nguyên khối prompt này, dán vào agent ngay sau khi `git clone` repo, rồi để nó tự làm
hết (cài phần mềm còn thiếu, tạo `.env`, cài dependencies, khởi động và mở trình duyệt kiểm tra):

```text
Đọc file SETUP.md ở gốc repo này và tự động thực hiện toàn bộ các bước để chạy dự án ForestGump ở
chế độ local development. Cụ thể:

1. Kiểm tra máy đã có Node.js 22+, Python 3.12, Docker Desktop, pnpm chưa — cái nào thiếu thì cài
   (Windows dùng winget, macOS dùng brew, Linux dùng apt/dnf tùy distro). Nếu không cài được Docker
   (ví dụ máy ảo không hỗ trợ ảo hoá lồng nhau), làm theo mục 6 trong SETUP.md (cài PostgreSQL
   native) thay thế.
2. Chạy `docker compose up -d` ở gốc repo để dựng PostgreSQL + TimescaleDB và MQTT broker. Đợi
   container "healthy" rồi mới sang bước sau.
3. Copy backend/.env.example -> backend/.env và dashboard/.env.example -> dashboard/.env (giữ
   nguyên giá trị mặc định, chúng đã khớp sẵn với docker-compose.yml).
4. Cài dependencies: npm install ở gốc, npm install trong backend/, pip install -r
   ai_engine/requirements.txt, pnpm install trong dashboard/.
5. Khởi động backend+ai_engine bằng `npm run dev` ở gốc, và dashboard bằng `pnpm dev` trong
   dashboard/ (chạy nền/song song, không chặn nhau).
6. Kiểm tra http://localhost:3000/health, http://127.0.0.1:8000/health và http://localhost:5173 đều
   trả về OK/200, rồi mở http://localhost:5173 trong trình duyệt.
7. Nếu gặp lỗi (thiếu quyền, cổng bận, dependency cài không được...), tự chẩn đoán và sửa trước khi
   báo tôi — chỉ dừng lại hỏi nếu cần quyết định (vd. ghi đè service đang chạy trên cổng đó).

Báo lại cho tôi khi cả 3 dịch vụ đã chạy và dashboard mở được, kèm theo bất kỳ bước nào bạn phải làm
khác với SETUP.md (do khác biệt môi trường/OS).
```

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

Lệnh này tự tạo database `forestgump`, nạp sẵn `backend/schema.sql` (bảng `stations` + 15 trạm mẫu,
bảng `telemetry`) và khởi động Mosquitto MQTT broker ở `localhost:1883`. Không cần chạy `schema.sql`
thủ công.

## 3. Biến môi trường

```bash
cp backend/.env.example backend/.env
cp dashboard/.env.example dashboard/.env
```

Giá trị mặc định trong `backend/.env.example` đã khớp sẵn với `docker-compose.yml`
(user/pass `postgres`, DB `forestgump`, MQTT `mqtt://localhost:1883`) — không cần sửa gì để chạy local.
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
(`admin@forestgump.vn` / `forestgump123`) hoặc bấm "Tiếp tục với tư cách khách".

## 6. Không có Docker (fallback PostgreSQL native)

1. Cài PostgreSQL 17, tạo database `forestgump`.
2. Nạp schema: `psql -U postgres -d forestgump -f backend/schema.sql`
   (dòng `CREATE EXTENSION timescaledb` và `create_hypertable(...)` sẽ báo lỗi nếu không có
   TimescaleDB — bỏ qua, các bảng vẫn được tạo bình thường dưới dạng bảng thường).
3. Sửa `backend/.env` cho khớp user/password/port Postgres bạn vừa tạo.
4. MQTT broker là tùy chọn — không có broker, backend chỉ log `[MQTT] Connection error` liên tục,
   không ảnh hưởng dashboard.

## 7. Chạy song song bản ForestGump cũ để đối chiếu (dành cho demo/giám khảo)

Nút **"Phiên bản"** trên thanh trên cùng của ForestGump mở ra link sang bản ForestGump gốc (giao
diện mặn hoá cũ, tag git `forestgump-legacy`), chạy độc lập ở cổng **5174** qua `git worktree` —
không đụng tới code/build của ForestGump:

```bash
# Chỉ cần làm 1 lần
git worktree add ../tesssst-legacy forestgump-legacy
cd ../tesssst-legacy/dashboard
pnpm install

# Mỗi lần muốn đối chiếu, chạy ở cổng 5174 (ForestGump vẫn ở 5173)
pnpm dev -- --port 5174
```

Sau đó mở ForestGump ở `:5173`, bấm nút "Phiên bản" → "ForestGump (cũ)" để mở tab mới sang `:5174`.
