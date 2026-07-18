# Forestgump — Chạy local (Development)

Hướng dẫn này giúp bất kỳ ai `git clone`/`git pull` repo này cũng chạy ra **kết quả giống hệt nhau**,
bất kể hệ điều hành. Với việc deploy production lên VPS, xem [DEPLOY.md](DEPLOY.md). Kiến trúc/luồng
dữ liệu đầy đủ: xem [docs/architecture.md](docs/architecture.md).

## 0. Cách nhanh nhất — nhờ AI coding agent làm hộ

Nếu bạn đang dùng Claude Code, Cursor, Antigravity hay agent tương tự, **không cần đọc các mục bên
dưới** — copy nguyên khối prompt này, dán vào agent ngay sau khi `git clone` repo, rồi để nó tự làm
hết (cài phần mềm còn thiếu, tạo `.env`, cài dependencies, khởi động và mở trình duyệt kiểm tra):

```text
Đọc file SETUP.md ở gốc repo này và tự động thực hiện toàn bộ các bước để chạy dự án Forestgump ở
chế độ local development. Cụ thể:

1. Kiểm tra máy đã có Node.js 22+, Python 3.12, pnpm chưa — cái nào thiếu thì cài (Windows dùng
   winget, macOS dùng brew, Linux dùng apt/dnf tùy distro).
2. Copy backend/.env.example -> backend/.env và dashboard/.env.example -> dashboard/.env (giữ
   nguyên giá trị mặc định, không cần key nào để chạy local — Open-Meteo/NCHMF không cần key).
3. Cài dependencies: npm install ở gốc, npm install trong backend/, pip install -r
   ai_engine/requirements.txt, pnpm install trong dashboard/.
4. Khởi động backend+ai_engine bằng `npm run dev` ở gốc, và dashboard bằng `pnpm dev` trong
   dashboard/ (chạy nền/song song, không chặn nhau).
5. Kiểm tra http://localhost:3000/health, http://127.0.0.1:8000/health và http://localhost:5173 đều
   trả về OK/200, rồi mở http://localhost:5173 trong trình duyệt.
6. Nếu gặp lỗi (thiếu quyền, cổng bận, dependency cài không được...), tự chẩn đoán và sửa trước khi
   báo tôi — chỉ dừng lại hỏi nếu cần quyết định (vd. ghi đè service đang chạy trên cổng đó).

Báo lại cho tôi khi cả 3 dịch vụ đã chạy và dashboard mở được, kèm theo bất kỳ bước nào bạn phải làm
khác với SETUP.md (do khác biệt môi trường/OS).
```

## 1. Yêu cầu cài sẵn

| Công cụ | Phiên bản | Dùng cho |
|---|---|---|
| [Node.js](https://nodejs.org/) | 22 LTS trở lên | backend, dashboard |
| [Python](https://www.python.org/) | 3.12 | ai_engine |
| [pnpm](https://pnpm.io/installation) | mới nhất | dashboard (`npm install -g pnpm`) |

Không cần Docker/database/message broker — pipeline gọi thẳng Open-Meteo/AI
Engine mỗi request, không lưu trạng thái (xem `docs/architecture.md` mục 6).

## 2. Biến môi trường

```bash
cp backend/.env.example backend/.env
cp dashboard/.env.example dashboard/.env
```

Giá trị mặc định chạy được ngay ở local — Open-Meteo và NCHMF không cần API
key. `OPENWEATHERMAP_API_KEY` (backend/.env) chỉ cần nếu muốn test đường
fallback (Open-Meteo lỗi/timeout); để trống vẫn chạy được, chỉ là fallback sẽ
không hoạt động. `dashboard/.env` mặc định trỏ `PUBLIC_API_URL=http://localhost:3000`.

## 3. Cài dependencies

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

## 4. Chạy

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
