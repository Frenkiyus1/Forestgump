# Điện Biên — Giai đoạn 1: Data pipeline

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

## 3. Khuyến nghị

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
