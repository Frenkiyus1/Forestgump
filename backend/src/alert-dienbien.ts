// Logic phân loại mức cảnh báo cho hệ thống thời tiết sớm Điện Biên — tách
// riêng để tái dùng và unit-test, theo đúng pattern của backend/src/alert.ts
// (độ mặn). 4 hiểm hoạ: mưa đá, sạt lở đất, mưa lớn/lũ quét, sương mù dày.
//
// QUAN TRỌNG — nguồn ngưỡng & giới hạn đã biết (đọc trước khi sửa số liệu):
// Đây KHÔNG phải bảng "cấp độ rủi ro thiên tai" pháp lý đầy đủ theo Quyết
// định 18/2021/QĐ-TTg. Mưa lớn/lũ quét (Điều 44) còn phụ thuộc số ngày mưa
// kéo dài + "vùng nguy cơ lũ quét 1-4" (bản đồ phân vùng quốc gia) mà hệ
// thống chưa có dữ liệu — đã trao đổi & thống nhất với người yêu cầu
// (2026-07-17) dùng ngưỡng ĐƠN GIẢN HOÁ. Mưa đá và sạt lở đất là PROXY
// heuristic TỰ THIẾT KẾ (Open-Meteo/pháp luật VN hiện KHÔNG có bảng ngưỡng
// chính thức cho 2 hiểm hoạ này) — CẦN chuyên gia khí tượng/địa chất xác
// nhận trước khi dùng cho cảnh báo chính thức. Không dùng các giá trị này
// làm căn cứ công bố cấp độ rủi ro thiên tai chính thức — chỉ phục vụ cảnh
// báo kỹ thuật sớm. Xem thêm docs/dienbien-phase0.md, docs/architecture.md.

/** Mức cảnh báo dùng chung cho 4 hiểm hoạ (không phải mọi hiểm hoạ đều dùng hết 4 mức). */
export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red';

// --- 1. Mưa đá (hail) — PROXY heuristic, CHƯA có quy định VN chính thức --
// CAPE cao = bất ổn định đối lưu; mực đóng băng thấp = đá ít tan khi rơi
// xuống đất; showersMm là "cổng" bắt buộc (CAPE chỉ đo tiềm năng khí quyển,
// không tự suy ra có đối lưu thật hay không). Ngưỡng CAPE tham khảo thang
// phổ biến trong khí tượng đối lưu, hạ thấp hơn chuẩn lục địa ôn đới vì vùng
// nhiệt đới/gió mùa thường sinh đối lưu mạnh ở CAPE thấp hơn. Mực đóng băng
// ~3500m/4500m là ngưỡng tham khảo phổ biến cho "thuận lợi/không thuận lợi"
// để đá rơi tới đất ở vùng nhiệt đới-cận nhiệt. CẦN chuyên gia khí tượng xác
// nhận trước khi dùng chính thức — xem docs/architecture.md mục 5.
const HAIL_CAPE_WEAK_MIN_JKG = 500;
const HAIL_CAPE_MODERATE_MIN_JKG = 1500;
const HAIL_CAPE_STRONG_MIN_JKG = 2500;
const HAIL_FREEZING_LEVEL_HIGH_RISK_MAX_M = 3500; // <= mức này: đá dễ rơi tới đất
const HAIL_FREEZING_LEVEL_MODERATE_RISK_MAX_M = 4500;
const HAIL_SHOWERS_GATE_MM = 1; // dưới mức này: chưa đủ bằng chứng đối lưu -> ép về xanh

/** Phân loại nguy cơ mưa đá (proxy) theo CAPE, mực đóng băng và mưa đối lưu. */
export function classifyHail(capeJkg: number, freezingLevelM: number, showersMm: number): AlertLevel {
  if (showersMm < HAIL_SHOWERS_GATE_MM) return 'green';
  if (capeJkg >= HAIL_CAPE_STRONG_MIN_JKG && freezingLevelM <= HAIL_FREEZING_LEVEL_HIGH_RISK_MAX_M) {
    return 'red';
  }
  if (capeJkg >= HAIL_CAPE_MODERATE_MIN_JKG) {
    return freezingLevelM <= HAIL_FREEZING_LEVEL_MODERATE_RISK_MAX_M ? 'orange' : 'yellow';
  }
  if (capeJkg >= HAIL_CAPE_WEAK_MIN_JKG) return 'yellow';
  return 'green';
}

// --- 2. Sạt lở đất (landslide) — PROXY heuristic, CHƯA có dữ liệu độ dốc/DEM
// Không có slope/soil-survey chính thức (ngoài phạm vi MVP) — dùng mưa tích
// luỹ 3 ngày + độ ẩm đất tầng 9-27cm. Hệ số địa hình chỉ áp dụng trong
// ai_engine/risk_engine.py (không mirror sang đây), cùng cách hệ số địa hình
// lũ quét chỉ áp dụng phía risk_engine.
const LANDSLIDE_SOIL_MOISTURE_MODERATE_MIN = 0.25; // m3/m3
const LANDSLIDE_SOIL_MOISTURE_SATURATED_MIN = 0.35; // m3/m3
const LANDSLIDE_RAIN3D_L1_MIN_MM = 100;
const LANDSLIDE_RAIN3D_L2_MIN_MM = 200;
const LANDSLIDE_RAIN3D_L3_MIN_MM = 350;

/** Phân loại nguy cơ sạt lở đất (proxy) theo mưa tích luỹ 3 ngày + độ ẩm đất. */
export function classifyLandslide(rain3dMm: number, soilMoisture: number): AlertLevel {
  if (rain3dMm > LANDSLIDE_RAIN3D_L3_MIN_MM && soilMoisture >= LANDSLIDE_SOIL_MOISTURE_SATURATED_MIN) {
    return 'red';
  }
  if (rain3dMm > LANDSLIDE_RAIN3D_L2_MIN_MM) {
    return soilMoisture >= LANDSLIDE_SOIL_MOISTURE_MODERATE_MIN ? 'orange' : 'yellow';
  }
  if (rain3dMm >= LANDSLIDE_RAIN3D_L1_MIN_MM || soilMoisture >= LANDSLIDE_SOIL_MOISTURE_SATURATED_MIN) {
    return 'yellow';
  }
  return 'green';
}

// --- 3. Mưa lớn / lũ quét (proxy đơn giản hoá) ----------------------------
// Nguồn: Quyết định 18/2021/QĐ-TTg, Điều 44 (cấp độ rủi ro thiên tai do mưa
// lớn) — 3 mốc cường độ mưa xuất hiện nhất quán ở nhiều nguồn tra cứu độc lập:
//   - 100–200 mm/24h (hoặc 50–100 mm/12h)  → cấp 1 (vàng)
//   - trên 200–400 mm/24h                  → cấp 2 (cam)
//   - trên 400 mm/24h                      → cấp 3 trở lên (đỏ)
// GIỚI HẠN ĐÃ BIẾT: bảng gốc Điều 44 còn phụ thuộc số ngày mưa kéo dài và số
// huyện/xã bị ảnh hưởng trong phạm vi tỉnh; tiêu chí lũ quét/sạt lở riêng còn
// phụ thuộc "vùng nguy cơ lũ quét 1-4" (bản đồ phân vùng quốc gia) — hệ thống
// hiện CHƯA có dữ liệu 2 chiều này nên hàm dưới đây chỉ dùng cường độ mưa tại
// 1 điểm làm proxy, KHÔNG PHẢI cấp độ rủi ro thiên tai chính thức.
const HEAVY_RAIN_L1_MIN_24H_MM = 100;
const HEAVY_RAIN_L1_MIN_12H_MM = 50;
const HEAVY_RAIN_L2_MIN_24H_MM = 200;
const HEAVY_RAIN_L3_MIN_24H_MM = 400;

/**
 * Phân loại nguy cơ mưa lớn/lũ quét (proxy) theo lượng mưa đo/dự báo.
 * `rain12hMm` không bắt buộc — nếu không có, chỉ xét theo mm/24h.
 */
export function classifyHeavyRainFloodRisk(rain24hMm: number, rain12hMm?: number): AlertLevel {
  if (rain24hMm > HEAVY_RAIN_L3_MIN_24H_MM) return 'red';
  if (rain24hMm > HEAVY_RAIN_L2_MIN_24H_MM) return 'orange';
  if (
    rain24hMm >= HEAVY_RAIN_L1_MIN_24H_MM ||
    (rain12hMm !== undefined && rain12hMm >= HEAVY_RAIN_L1_MIN_12H_MM)
  ) {
    return 'yellow';
  }
  return 'green';
}

// --- 4. Sương mù dày -------------------------------------------------------
// Nguồn: định nghĩa khí tượng của Tổ chức Khí tượng Thế giới (WMO), nhất
// quán giữa các nguồn tra cứu:
//   - Sương mù: tầm nhìn ngang < 1000 m
//   - Sương mù dày/nguy hiểm giao thông: tầm nhìn ngang < 50 m
// KHÔNG dùng bảng Điều 51 QĐ 18/2021/QĐ-TTg vì các nguồn tra cứu cho số liệu
// mâu thuẫn nhau (500-1000m/200-500m/<200m ở một nguồn, ≥50m/<50m ở nguồn
// khác) và chưa xác minh được bản gốc — xem docs/dienbien-phase0.md.
const FOG_MAX_VISIBILITY_M = 1000; // dưới ngưỡng này: có sương mù
const DENSE_FOG_MAX_VISIBILITY_M = 50; // dưới ngưỡng này: sương mù dày, nguy hiểm

/** Phân loại sương mù theo tầm nhìn xa (m). */
export function classifyFog(visibilityM: number): AlertLevel {
  if (visibilityM < DENSE_FOG_MAX_VISIBILITY_M) return 'red';
  if (visibilityM < FOG_MAX_VISIBILITY_M) return 'yellow';
  return 'green';
}
