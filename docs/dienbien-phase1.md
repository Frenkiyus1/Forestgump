# Điện Biên — Giai đoạn 1: Data pipeline

## 0. Nối AI Engine (`/assess-risk`) vào Backend — đã xong (2026-07-17)

- **`backend/src/ai-risk-client.ts`** (mới): client gọi `POST /assess-risk` (ai_engine, port
  8000) qua biến riêng `AI_ENGINE_BASE_URL` (mặc định `http://localhost:8000`, KHÔNG dùng chung
  `AI_ENGINE_URL` — biến đó trỏ `.../predict` cho luồng độ mặn cũ). Có timeout qua
  `AbortController` (`AI_ENGINE_TIMEOUT_MS`, mặc định 8000ms) và validate response bằng Zod
  (`assessRiskResponseSchema` trong `schemas.ts`). Khác `/predict`, `/assess-risk` KHÔNG có mock
  mode ở phía ai_engine — lỗi/timeout ở đây ném lỗi rõ ràng, không âm thầm fallback.
- **`GET /api/dienbien-forecast?location=<code>`** (mới, [`backend/src/api.ts`](../backend/src/api.ts)):
  gộp dự báo thời tiết thô (Open-Meteo/OpenWeatherMap) + đánh giá rủi ro (rét đậm/rét hại, mưa
  lớn/lũ quét, sương mù) + bản tin cảnh báo thành MỘT payload cho 3 địa điểm demo (hoặc 1 địa điểm
  nếu lọc theo `location`, 404 nếu mã không khớp). Nếu `/assess-risk` lỗi cho 1 địa điểm, địa điểm
  đó trả về `days: []` + `aiEngineError` thay vì làm hỏng cả response (đã kiểm thử: tắt ai_engine
  → endpoint vẫn trả 200, không 500).
- **`GET /api/bulletins?location=<code>&activeOnly=true`** (mới, cùng file): tái dùng logic của
  route trên qua `buildDienBienForecast()`, "làm phẳng" thành 1 dòng/hiểm hoạ/ngày
  (`{locationCode, locationName, date, hazard, alertLevel, bulletin}`), sắp xếp mức cảnh báo nguy
  hiểm nhất trước (đỏ > cam > vàng > xanh) rồi theo ngày tăng dần. `activeOnly=true` (mặc định):
  chỉ trả các dòng khác `green` — dự kiến dùng cho kênh cảnh báo SMS/Zalo/loa sau này.
- **Đã kiểm thử thủ công** (curl, cả 3 địa điểm, ai_engine chạy thật — không mock): đủ 7 ngày ×
  3 loại hazard (`cold_damage`, `heavy_rain_flood`, `fog`) cho mỗi địa điểm; 404 khi `location`
  sai; `activeOnly=false` trả 63 dòng, `activeOnly=true` lọc còn 21 dòng (không còn `green`); tắt
  ai_engine → 2 endpoint vẫn trả 200 (không crash, không 500).

## 1. Pipeline ingest thời tiết

- **Nguồn chính:** [Open-Meteo](https://open-meteo.com) `/v1/forecast` (không cần API key) —
  [`backend/src/weather-ingest.ts`](../backend/src/weather-ingest.ts). Lấy dự báo 7 ngày
  (nhiệt độ min/max, nhiệt độ hiện tại, lượng mưa, độ ẩm, điểm sương, tốc độ gió)
  cho 3 địa điểm trong [`backend/src/config/locations.ts`](../backend/src/config/locations.ts).
- **Nguồn dự phòng/đối chiếu:** OpenWeatherMap `/data/2.5/forecast` (cần
  `OPENWEATHERMAP_API_KEY`) — [`backend/src/weather-openweathermap.ts`](../backend/src/weather-openweathermap.ts).
  Tự động kích hoạt khi Open-Meteo lỗi HTTP hoặc timeout quá `WEATHER_FETCH_TIMEOUT_MS`
  (mặc định 8000ms), có log `[WEATHER] ... chuyển sang OpenWeatherMap dự phòng`.
  OpenWeatherMap free tier chỉ phủ ~5 ngày (không đủ 7 ngày như Open-Meteo) và
  không có sẵn điểm sương — điểm sương được tính xấp xỉ bằng công thức Magnus
  (August-Roche-Magnus, sai số ~0.4°C), ghi rõ trong code.
- **Lưu trữ:** bảng `weather_forecast` mới trong [`backend/schema.sql`](../backend/schema.sql)
  (khoá `location_code + forecast_date + source`, upsert khi ingest lại).
- **Kiểm tra thủ công:** `GET /api/weather-raw` (xem [`backend/src/api.ts`](../backend/src/api.ts))
  trả dữ liệu ingest thô cho cả 3 địa điểm, gọi trực tiếp Open-Meteo (đã kiểm
  thử thực tế ngày 2026-07-17 — cả 3 địa điểm trả về đủ 7 ngày dữ liệu).
- **Độ cao:** lấy từ Open-Meteo Elevation API (`api.open-meteo.com/v1/elevation`),
  nhúng sẵn trong `locations.ts` — MVP không tải DEM SRTM đầy đủ.
- **Ranh giới hành chính:** [`data/dienbien-admin-boundaries.geojson`](../data/dienbien-admin-boundaries.geojson),
  lấy từ OpenStreetMap (qua Nominatim API), giấy phép ODbL 1.0.
  **Giới hạn quan trọng:** đây là ranh giới đơn vị hành chính **CŨ** (TP. Điện
  Biên Phủ / huyện Tủa Chùa / huyện Mường Nhé, trước sáp nhập 01/07/2025).
  OpenStreetMap tại thời điểm tra cứu (2026-07-17) **chưa cập nhật** polygon
  cho các xã/phường mới theo Nghị quyết 1661/NQ-UBTVQH15 — dùng tạm để ước
  lượng phạm vi khu vực, cần thay thế khi OSM/GADM có dữ liệu mới hoặc khi có
  bản đồ hành chính chính thức từ Sở TN&MT tỉnh Điện Biên.

## 2. Dữ liệu thiên tai lịch sử của Điện Biên — có công khai không?

**Kết luận: CHƯA tìm được cơ sở dữ liệu thiên tai lịch sử có cấu trúc, công
khai, tải về được, dành riêng cho tỉnh Điện Biên.** Không tạo dữ liệu giả để
lấp khoảng trống này — cần **validate ngưỡng thủ công** (đối chiếu với bản
tin NCHMF/báo chí theo từng đợt cụ thể) cho tới khi có nguồn chính thức.

Những gì đã tìm được, để tham khảo:

- **Không có** trang riêng dạng "Ban Chỉ huy PCTT tỉnh Điện Biên" với CSDL
  tra cứu lịch sử như một số tỉnh khác đang có (vd. Thanh Hoá —
  [pctt.thanhhoa.gov.vn](https://pctt.thanhhoa.gov.vn/), Ninh Bình —
  [phongchongthientainb.vn](https://phongchongthientainb.vn/), Bình Định —
  [pcttbinhdinh.gov.vn](https://pcttbinhdinh.gov.vn/), Hà Nội —
  [phongchongthientai.hanoi.gov.vn](https://phongchongthientai.hanoi.gov.vn/)).
  Chưa xác định được Điện Biên có cổng tương đương hay không qua tìm kiếm web.
- **Cổng thông tin điện tử tỉnh Điện Biên** ([dienbien.gov.vn](http://www.dienbien.gov.vn))
  có đăng **bài báo/tin tức tổng kết thiệt hại theo năm** (dạng văn xuôi, không
  phải bảng dữ liệu có cấu trúc/CSV/API), ví dụ:
  - [Năm 2019 ước tính thiệt hại do thiên tai gây ra khoảng 50 tỷ đồng](http://www.dienbien.gov.vn/portal/Pages/2020-5-29/VPUB--Nam-2019-uoc-tinh-thiet-hai-do-thien-tai-gaykd6fqr.aspx)
  - Các bài tổng kết tương tự cho 2020, 2025, 2026 xuất hiện rải rác trên
    dienbien.gov.vn và báo chí (Báo Tin tức Dân tộc & Miền núi, Quân đội Nhân dân...)
    nhưng ở dạng tin bài đơn lẻ, không phải nguồn dữ liệu event-level có thể
    tải về để đối chiếu ngưỡng cảnh báo một cách hệ thống.
- **VNDMS — Hệ thống giám sát thiên tai Việt Nam** ([vndms.gov.vn](https://vndms.gov.vn/) /
  [vndms.dmptc.gov.vn](https://vndms.dmptc.gov.vn/thongtincongdong)), do Cục
  Quản lý đê điều và Phòng, chống thiên tai (Bộ NN&MT) vận hành: công khai,
  không cần đăng nhập, hiển thị bản đồ **thời gian thực** (bão, mưa, mực nước
  sông, cảnh báo lũ) toàn quốc gồm cả Điện Biên. Đây là công cụ giám sát
  hiện tại/gần-thời-gian-thực, **không phải kho dữ liệu lịch sử có thể truy
  vấn/tải về theo tỉnh** ở dạng mà nhóm xác minh được — cần kiểm tra thêm nếu
  muốn dùng cho việc backtest ngưỡng.
- **Cục Quản lý đê điều và PCTT** ([phongchongthientai.mard.gov.vn](https://phongchongthientai.mard.gov.vn/))
  có nhiều CSDL chuyên đề cấp quốc gia (đê điều, sạt lở bờ sông/biển...) nhưng
  chưa xác định được mục nào cung cấp dữ liệu lịch sử thiên tai theo
  huyện/xã của Điện Biên ở dạng có cấu trúc.

## 3. NCHMF official reference (validation layer)

- **Nguồn:** [nchmf.gov.vn/kttvsite/vi-VN/1/muong-thanh-dien-bien-w38.html](https://nchmf.gov.vn/kttvsite/vi-VN/1/muong-thanh-dien-bien-w38.html)
  — trang dự báo chính thức của Trung tâm Dự báo Khí tượng Thuỷ văn Quốc gia
  (NCHMF) cho Mường Thanh (tức phường Điện Biên Phủ, trung tâm thành phố).
  HTML server-render, không cần JS/AJAX (đã kiểm tra 2026-07-17).
- **Giới hạn quan trọng — CHỈ áp dụng cho địa điểm `dbp`:** NCHMF chỉ công bố
  1 trang dự báo / tỉnh (theo thành phố trung tâm tỉnh lỵ), không có trang
  theo xã. Đã tìm kiếm nhưng **không có** trang NCHMF riêng cho Tủa Chùa hay
  Mường Nhé (xác minh qua tìm kiếm ngày 2026-07-17) — 2 địa điểm này vẫn chỉ
  dùng Open-Meteo/OpenWeatherMap như phần 1, không có lớp đối chiếu NCHMF.
  Điều này thực ra khớp với chính tiền đề của bài toán (dự báo cấp tỉnh đã
  có sẵn, chỉ là chưa đủ chi tiết cấp xã).
- **Vai trò kiến trúc: đối chiếu (cross-check), KHÔNG phải nguồn ingest
  chính.** Open-Meteo vẫn giàu dữ liệu hơn (mưa, điểm sương, gió, đủ 7 ngày);
  giá trị của NCHMF ở đây là câu khẳng định "dự báo tiểu vùng của hệ thống
  khớp với dự báo cấp tỉnh chính thức của nhà nước" — một tín hiệu tin cậy
  cho tài liệu kiến trúc/giám khảo, không dùng để ghi đè hay thay thế
  Open-Meteo ở bất kỳ đâu khác trong hệ thống.
- **Cài đặt:**
  [`backend/src/nchmf-reference.ts`](../backend/src/nchmf-reference.ts) —
  `fetchNchmfReference()` fetch trang (timeout `NCHMF_FETCH_TIMEOUT_MS`, mặc
  định 8000ms, User-Agent riêng `SaliGuard-DienBien-Hackathon-Demo/1.0` để
  minh bạch danh tính khi gọi site chính phủ), parse bằng `cheerio` (thêm
  mới vào `package.json` — dự án trước đó chưa có lib parse HTML nào), lấy:
  nhiệt độ/độ ẩm/mốc cập nhật "hiện tại", nhiệt độ ngày/đêm "hôm nay" (NCHMF
  tách riêng 2 khối này, không gộp min/max 1 chỗ), và danh sách 10 ngày tới
  (mỗi ngày kèm nhiệt độ min/max + mô tả thời tiết dạng chữ). Trang đổi cấu
  trúc/thiếu field mong đợi → **ném lỗi rõ ràng**, không âm thầm trả 0/null
  (khớp quy ước "không bịa dữ liệu" của dự án — thresholds.py, mục 2 ở trên).
  Có cache trong bộ nhớ tiến trình: 30 phút cho kết quả thành công (NCHMF chỉ
  cập nhật ~3 lần/ngày: 04h30/15h30/22h), 5 phút cho lỗi (tránh dội request
  khi site đang lỗi/đổi cấu trúc) — không gọi lại thường xuyên hơn 30 phút,
  không có vòng lặp retry.
- **`GET /api/dienbien-forecast-validation`** (mới, cùng file `api.ts`): lấy
  dự báo Open-Meteo cho `dbp` + dữ liệu NCHMF, ghép theo ngày (YYYY-MM-DD),
  trả `{ locationCode: 'dbp', nchmfAvailable, nchmfUpdatedAt, days: [{ date,
  openMeteo: {tempMinC, tempMaxC}, nchmf: {tempMinC, tempMaxC}, deltaMaxC,
  deltaMinC }] }`. Nếu NCHMF lỗi/timeout: vẫn trả **200** với
  `nchmfAvailable: false` + `days: []` thay vì làm hỏng cả response (lớp đối
  chiếu là phụ, không phải nguồn dữ liệu chính hiển thị cho người dùng).
- **Đã kiểm thử thủ công** (curl, 2026-07-17): trả về đủ chênh lệch nhiệt độ
  cho hôm nay + các ngày tiếp theo trong khoảng trùng giữa 7 ngày Open-Meteo
  và 10 ngày NCHMF (NCHMF bắt đầu danh sách 10 ngày từ ngày mai, "hôm nay"
  lấy riêng từ khối dự báo ngày/đêm), chênh lệch quan sát được ở mức vài °C
  — hợp lý, không phải dấu hiệu đọc sai DOM.
- **Chưa xác minh giấy phép tái sử dụng dữ liệu** — trang không ghi rõ điều
  khoản sử dụng lại. nchmf.gov.vn là trang của cơ quan nhà nước (.gov.vn),
  coi là an toàn để đọc cho demo phi thương mại, nhưng đây KHÔNG phải xác
  nhận chính thức về giấy phép dữ liệu mở.

## 4. Khuyến nghị

1. **Không dùng số liệu ước lượng ở trên để hiệu chỉnh ngưỡng** trong
   `alert-dienbien.ts` — chúng chỉ là tổng thiệt hại kinh tế theo năm, không
   phải bản ghi sự kiện (thời gian, địa điểm, nhiệt độ/lượng mưa đo được).
2. Khi cần validate ngưỡng cảnh báo với thực tế, cách khả thi nhất hiện tại
   là **đối chiếu thủ công** bản tin cảnh báo của NCHMF
   ([nchmf.gov.vn](http://nchmf.gov.vn) / trang khu vực Tây Bắc) cho các đợt
   rét đậm/rét hại, mưa lớn cụ thể đã biết ngày tháng, với dữ liệu Open-Meteo
   lịch sử (`archive-api.open-meteo.com`) cho cùng thời điểm/địa điểm.
3. Liên hệ trực tiếp Sở Nông nghiệp và Môi trường tỉnh Điện Biên / Chi cục
   Thuỷ lợi và PCTT tỉnh (qua Cổng dịch vụ công tỉnh) nếu cần dữ liệu event-level
   chính thức — ngoài phạm vi các công cụ tự động đã dùng ở giai đoạn này.
