# Điện Biên — Giai đoạn 0: Khung bài toán

Pivot từ bài toán xâm nhập mặn (Hải Phòng) sang cảnh báo thời tiết sớm cho
Điện Biên: rét đậm/rét hại, mưa lớn/lũ quét, sương mù dày. Tài liệu này tóm
tắt 3 địa điểm demo và bảng ngưỡng cảnh báo dùng trong
[`backend/src/config/locations.ts`](../backend/src/config/locations.ts) và
[`backend/src/alert-dienbien.ts`](../backend/src/alert-dienbien.ts).

## 1. Ba địa điểm demo

Toạ độ & độ cao lấy từ Open-Meteo Geocoding API (`geocoding-api.open-meteo.com/v1/search`)
và Elevation API (`api.open-meteo.com/v1/elevation`), tra cứu ngày 2026-07-17.

Tên hành chính hiện hành theo **Nghị quyết số 1661/NQ-UBTVQH15** (sắp xếp
đơn vị hành chính cấp xã tỉnh Điện Biên, hiệu lực 01/07/2025): tỉnh Điện Biên
bỏ cấp huyện, còn 45 xã/phường quản lý trực tiếp bởi tỉnh
([nguồn](https://xaydungchinhsach.chinhphu.vn/sap-xep-dvhc-danh-sach-45-xa-phuong-cua-tinh-dien-bien-119250622184906998.htm)).
Tên cũ (huyện) được giữ lại trong `oldDistrictName` để đối chiếu dữ liệu lịch sử.

| Mã (`code`) | Tên hiện hành | Tên cũ | Lat | Lon | Độ cao (m) | Địa hình |
|---|---|---|---|---|---|---|
| `dbp` | Phường Điện Biên Phủ | TP. Điện Biên Phủ | 21.38602 | 103.02301 | 482 | Thung lũng (lòng chảo Mường Thanh) |
| `tua-chua` | Xã Tủa Chùa | Huyện Tủa Chùa | 21.863 | 103.331 | 871 | Núi cao (cao nguyên đá vôi) |
| `muong-nhe` | Xã Mường Nhé | Huyện Mường Nhé | 22.19236 | 102.4579 | 540 | Ven suối (thung lũng suối Nậm Nhé, sát biên giới) |

Ghi chú địa hình chi tiết (ảnh hưởng downscaling vi khí hậu ở giai đoạn sau)
nằm trong field `terrainNote` của từng địa điểm trong `locations.ts`.

## 2. Bảng ngưỡng cảnh báo

**Cảnh báo quan trọng:** đây KHÔNG phải bảng "cấp độ rủi ro thiên tai" pháp lý
đầy đủ theo Quyết định 18/2021/QĐ-TTg. Khi tra cứu, các nguồn thứ cấp
(luatvietnam.vn, thuvienphapluat.vn...) cho số liệu **mâu thuẫn nhau** ở
Điều 53 (rét hại) và Điều 51 (sương mù), và bảng mưa lớn/lũ quét (Điều 44)
còn phụ thuộc số ngày mưa kéo dài + "vùng nguy cơ lũ quét 1-4" (bản đồ phân
vùng quốc gia) mà hệ thống chưa có dữ liệu để tính đúng. Đã dừng lại hỏi và
thống nhất với người yêu cầu (2026-07-17) dùng ngưỡng đơn giản hoá bên dưới,
có nguồn trích dẫn rõ ràng cho từng mục — **không dùng để công bố cấp độ rủi
ro thiên tai chính thức**, chỉ phục vụ cảnh báo kỹ thuật sớm nội bộ.

### 2.1. Rét đậm / rét hại

Nguồn: định nghĩa nghiệp vụ bản tin của Trung tâm Dự báo Khí tượng Thuỷ văn
Quốc gia (NCHMF) — nhất quán giữa nhiều nguồn tra cứu độc lập
([vnmha.mae.gov.vn](https://vnmha.mae.gov.vn/tim-hieu-ve-khong-khi-lanh-ret-dam-ret-hai-15720.htm),
[thuvienphapluat.vn](https://thuvienphapluat.vn/hoi-dap-phap-luat/ret-dam-ret-hai-la-gi-tan-suat-va-thoi-gian-ban-hanh-ban-tin-ve-ret-dam-ret-hai-duoc-quy-dinh-nhu-t-138019994.html)).

| Mức | Ngưỡng (nhiệt độ trung bình ngày) | AlertLevel |
|---|---|---|
| Bình thường | > 15°C | `green` |
| Rét đậm | 13°C < Ttb ≤ 15°C | `yellow` |
| Rét hại | Ttb ≤ 13°C | `red` |

Áp dụng chủ yếu cho đồng bằng/trung du Bắc Bộ & Bắc Trung Bộ; ở vùng núi cao
(vd. Tủa Chùa) rét đậm/rét hại có thể kéo dài gần như cả tháng thay vì từng
đợt — cần lưu ý khi diễn giải cảnh báo.

**Giới hạn đã biết:** đây là ngưỡng *nghiệp vụ bản tin*, không phải bảng cấp
độ rủi ro thiên tai (Điều 53 QĐ 18/2021/QĐ-TTg) — bảng đó còn có chiều "số
ngày kéo dài" mà số liệu tra cứu được không thống nhất giữa các nguồn thứ
cấp (8–13°C/>10 ngày ở một nguồn, 10–13°C/3–5 ngày ở nguồn khác), chưa xác
minh được bản gốc (Công báo Chính phủ) nên không đưa vào code.

### 2.2. Mưa lớn / lũ quét (proxy đơn giản hoá)

Nguồn: Quyết định 18/2021/QĐ-TTg, Điều 44 (cấp độ rủi ro thiên tai do mưa
lớn) — chỉ lấy 3 mốc cường độ mưa, xuất hiện nhất quán giữa nhiều nguồn tra
cứu độc lập (thuvienphapluat.vn, luatvietnam.vn).

| Mức | Ngưỡng | AlertLevel |
|---|---|---|
| Bình thường | < 100mm/24h và < 50mm/12h | `green` |
| Cấp 1 | 100–200mm/24h hoặc 50–100mm/12h | `yellow` |
| Cấp 2 | trên 200–400mm/24h | `orange` |
| Cấp 3 trở lên | trên 400mm/24h | `red` |

**Giới hạn đã biết:** bảng gốc Điều 44 còn phụ thuộc (a) số ngày mưa kéo dài
liên tục và (b) số huyện/xã bị ảnh hưởng trong phạm vi tỉnh; tiêu chí lũ
quét/sạt lở riêng còn phụ thuộc "vùng nguy cơ lũ quét 1-4" — một bản đồ phân
vùng quốc gia mà hệ thống **chưa có dữ liệu**. Vì vậy hàm
`classifyHeavyRainFloodRisk` chỉ dùng cường độ mưa tại 1 điểm làm proxy kỹ
thuật, không thay thế bản tin cảnh báo chính thức của NCHMF/Ban Chỉ huy PCTT.

### 2.3. Sương mù dày

Nguồn: định nghĩa khí tượng của Tổ chức Khí tượng Thế giới (WMO) — nhất quán
giữa các nguồn tra cứu.

| Mức | Ngưỡng (tầm nhìn ngang) | AlertLevel |
|---|---|---|
| Bình thường | ≥ 1000 m | `green` |
| Sương mù | 50 m – dưới 1000 m | `yellow` |
| Sương mù dày, nguy hiểm giao thông | < 50 m | `red` |

**Giới hạn đã biết:** KHÔNG dùng bảng Điều 51 QĐ 18/2021/QĐ-TTg vì số liệu
tra cứu được mâu thuẫn giữa các nguồn thứ cấp (500–1000m/200–500m/<200m ở
một nguồn, ≥50m/<50m ở nguồn khác) và chưa xác minh được bản gốc.

## 3. Việc cần làm khi có bản gốc pháp lý

Nếu có được bản gốc (Công báo Chính phủ hoặc file chính thức) của Quyết định
18/2021/QĐ-TTg, cần: (1) đối chiếu lại Điều 44/51/53, (2) nếu số liệu khác
với bảng trên thì cập nhật `alert-dienbien.ts` + test, (3) cân nhắc bổ sung
dữ liệu vùng nguy cơ lũ quét 1-4 để tính đúng cấp độ mưa lớn/lũ quét theo
đúng quy định pháp lý thay vì proxy cường độ mưa đơn điểm.
