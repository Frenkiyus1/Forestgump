# Điện Biên — Giai đoạn 2: Heatmap cảnh báo 45 xã/phường

## 0. Bài toán

`/api/dienbien-forecast` chỉ có dữ liệu THẬT (Open-Meteo/OpenWeatherMap → AI
Engine → risk) cho **3 địa điểm anchor**: `dbp` (Phường Điện Biên Phủ),
`tua-chua` (Xã Tủa Chùa), `muong-nhe` (Xã Mường Nhé) — xem
[`backend/src/config/locations.ts`](../backend/src/config/locations.ts) và
[phase1](./dienbien-phase1.md). Bản đồ tương tác ở `dashboard/src/routes/map`
hiển thị 45 xã/phường (sau sáp nhập 01/07/2025, Nghị quyết 1661/NQ-UBTVQH15,
xem [`dashboard/src/lib/dienbien-hotspots.ts`](../dashboard/src/lib/dienbien-hotspots.ts)).
Không có ngân sách/thời gian để lấy dự báo thời tiết thật cho cả 45 xã trong
giai đoạn demo này — cần một cách hiển thị heatmap cho toàn tỉnh mà KHÔNG bịa
số liệu đo cho 42 xã chưa có dữ liệu.

## 1. Cách tiếp cận: nội suy theo nhóm địa hình

Thay vì nội suy không gian (khoảng cách centroid — **không hợp lệ** vì toạ độ
SVG trong `dienbien-hotspots.ts` là toạ độ vẽ lại từ ảnh `/dienbien-map.png`,
không phải lat/lon thật, không cùng hệ quy chiếu với `dienbien-geo.ts`), mỗi
xã được gán vào 1 trong 3 nhóm địa hình đã dùng để phân loại chính 3 anchor
(`terrain: 'thung_lung' | 'nui_cao' | 'ven_suoi'` trong `locations.ts`), rồi
"mượn" thẳng dự báo/cảnh báo của anchor cùng nhóm:

- `thung_lung` (lòng chảo Mường Thanh) → anchor `dbp`
- `nui_cao` (cao nguyên đá, vùng núi cao) → anchor `tua-chua`
- `ven_suoi` (dọc sông suối, dễ lũ quét) → anchor `muong-nhe`

Cài đặt: [`dashboard/src/lib/dienbien-terrain-zones.ts`](../dashboard/src/lib/dienbien-terrain-zones.ts)
(`TERRAIN_ZONE_BY_NAME`, `ANCHOR_CODE_BY_TERRAIN`) +
[`dashboard/src/lib/dienbien-heatmap.ts`](../dashboard/src/lib/dienbien-heatmap.ts)
(`buildRegionHeat()` ghép terrain zone với response `/api/dienbien-forecast`
theo hazard + ngày đang chọn trên UI).

## 2. Nguồn suy luận terrain cho 42 xã còn lại

**Đây KHÔNG phải khảo sát địa hình chính thức.** Việc gán terrain dựa trên suy
luận từ:

- **Tên gọi hành chính cũ** (huyện trước sáp nhập) — các xã cùng huyện cũ với
  1 anchor thường có địa hình tương tự anchor đó (vd. các xã thuộc huyện Tủa
  Chùa cũ → cùng cao nguyên đá vôi với anchor `tua-chua`; các xã thuộc TP.
  Điện Biên Phủ cũ nằm trong lòng chảo Mường Thanh → cùng nhóm `dbp`).
- **Tên địa danh gốc tiếng Thái/Hmông có nghĩa địa lý** — tiền tố "Nậm" =
  sông/suối thường gợi ý địa hình `ven_suoi`.
- **Kiến thức địa lý phổ thông đã biết** về các mốc nổi tiếng (A Pa Chải,
  đèo Pha Đin, ngã ba sông tại Mường Lay...).

Không tra cứu được bản đồ địa hình/độ cao chính thức cấp xã cho toàn bộ 45 xã
trong giai đoạn này (tương tự giới hạn về ranh giới hành chính mới đã ghi ở
[phase1 §1](./dienbien-phase1.md#1-pipeline-ingest-thời-tiết)) — do đó mỗi xã
có trường `confidence`:

| `confidence` | Ý nghĩa |
|---|---|
| `high`  | Chính là anchor, hoặc cùng cụm địa lý rõ ràng với anchor (cùng cao nguyên đá, cùng lòng chảo Mường Thanh, mốc địa lý nổi tiếng đã biết) |
| `medium`| Cùng huyện cũ với anchor, tên gọi/vị trí tương đối phù hợp nhưng chưa đối chiếu địa hình cụ thể |
| `low`   | Chỉ dựa trên cụm hành chính, chưa xác nhận được đặc điểm địa hình cụ thể — nhiều khả năng sai nhóm |

12/45 xã ở mức `high`, phần còn lại `medium`/`low`.

## 3. Bắt buộc hiển thị khác biệt trên UI

Theo đúng nguyên tắc "không bịa dữ liệu" đã dùng xuyên suốt dự án (thresholds.py,
[phase0](./dienbien-phase0.md) §2, [phase1](./dienbien-phase1.md) §2/§3):

- 3 xã anchor: viền đậm liền nét, nhãn "● Dữ liệu đo thật".
- Xã `confidence: 'low'`: fill nhạt hơn + viền nét đứt, nhãn "○ Ước tính theo
  vùng địa hình (độ tin cậy thấp)".
- Xã `confidence: 'medium'`: fill bình thường, viền mảnh (không đậm như anchor).
- Chú giải cố định ở góc bản đồ giải thích quy ước màu + ký hiệu độ tin cậy.
- Caption dưới bản đồ nhắc lại nguyên tắc này bằng chữ, không chỉ dựa vào màu
  (đúng convention "always pair colour with a text label" đã có trong
  `alert-ui.ts`).

## 4. Giới hạn đã biết

1. Phân loại terrain cho 42 xã **cần chuyên gia địa phương / Sở NN&MT tỉnh
   Điện Biên xác nhận lại** trước khi dùng cho cảnh báo chính thức — đây là
   suy luận phục vụ demo, không phải khảo sát thực địa.
2. "Mượn" dữ liệu từ anchor cùng nhóm terrain bỏ qua các yếu tố vi khí hậu cục
   bộ khác (hướng sườn núi, độ che phủ rừng, khoảng cách thực tới anchor) —
   một xã `nui_cao` cách anchor `tua-chua` hàng chục km vẫn nhận đúng dự báo
   của `tua-chua`, có thể lệch so với thực tế tại chỗ.
3. Nhóm `ven_suoi` gộp chung nhiều lưu vực suối khác nhau (Nậm Nhé, Nậm Na,
   Nậm Mã...) dùng chung 1 anchor (`muong-nhe`) dù nguy cơ lũ quét phụ thuộc
   nhiều vào lưu vực cụ thể — rủi ro đánh giá sai mức độ cho các xã ở lưu vực
   khác lưu vực Nậm Nhé.
4. Nếu sau này có ranh giới hành chính mới + dữ liệu độ cao cấp xã chính thức
   (xem giới hạn về `dienbien-admin-boundaries.geojson` ở
   [phase1 §1](./dienbien-phase1.md#1-pipeline-ingest-thời-tiết)), nên thay
   toàn bộ cách tiếp cận "mượn theo nhóm" này bằng nội suy không gian thật
   (khoảng cách tới trạm quan trắc theo lat/lon, có tính độ cao).
