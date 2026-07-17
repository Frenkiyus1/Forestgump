// Logic phân loại mức cảnh báo cho hệ thống thời tiết sớm Điện Biên — tách
// riêng để tái dùng và unit-test, theo đúng pattern của backend/src/alert.ts
// (độ mặn). 3 hiểm hoạ: rét đậm/rét hại, mưa lớn/lũ quét, sương mù dày.
//
// QUAN TRỌNG — nguồn ngưỡng & giới hạn đã biết (đọc trước khi sửa số liệu):
// Đây KHÔNG phải bảng "cấp độ rủi ro thiên tai" pháp lý đầy đủ theo Quyết
// định 18/2021/QĐ-TTg. Khi tra cứu văn bản gốc, các nguồn thứ cấp (luatvietnam,
// thuvienphapluat...) cho số liệu MÂU THUẪN nhau ở Điều 53 (rét hại) và Điều 51
// (sương mù), và bảng mưa lớn/lũ quét (Điều 44) còn phụ thuộc số ngày mưa kéo
// dài + "vùng nguy cơ lũ quét 1-4" (bản đồ phân vùng quốc gia) mà hệ thống
// chưa có dữ liệu. Đã trao đổi & thống nhất với người yêu cầu (2026-07-17)
// dùng các ngưỡng ĐƠN GIẢN HOÁ, có nguồn trích dẫn rõ cho từng hàm bên dưới.
// Không dùng các giá trị này làm căn cứ công bố cấp độ rủi ro thiên tai chính
// thức — chỉ phục vụ cảnh báo kỹ thuật sớm. Xem thêm docs/dienbien-phase0.md.

/** Mức cảnh báo dùng chung cho 3 hiểm hoạ (không phải mọi hiểm hoạ đều dùng hết 4 mức). */
export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red';

// --- 1. Rét đậm / rét hại -------------------------------------------------
// Nguồn: định nghĩa nghiệp vụ của Trung tâm Dự báo Khí tượng Thuỷ văn Quốc gia
// (NCHMF) cho bản tin rét đậm/rét hại — nhất quán giữa nhiều nguồn tra cứu
// độc lập (vnmha.mae.gov.vn, thuvienphapluat.vn...):
//   - Rét đậm: 13°C < nhiệt độ trung bình ngày ≤ 15°C
//   - Rét hại: nhiệt độ trung bình ngày ≤ 13°C
// Đây là ngưỡng NGHIỆP VỤ BẢN TIN, không phải bảng cấp độ rủi ro thiên tai
// (Điều 53 QĐ 18/2021/QĐ-TTg) — bảng đó còn có yếu tố số ngày kéo dài mà các
// nguồn tra cứu cho số liệu không thống nhất, chưa xác minh được bản gốc.
const COLD_SEVERE_MAX_C = 13; // <= ngưỡng này: rét hại (đỏ)
const COLD_DAMP_MAX_C = 15; // <= ngưỡng này (và > rét hại): rét đậm (vàng)

/**
 * Phân loại rét đậm/rét hại theo nhiệt độ trung bình ngày (°C).
 * `avgTempC` nên là xấp xỉ (tempMin + tempMax) / 2 từ dự báo Open-Meteo —
 * đây là XẤP XỈ, không hoàn toàn giống cách tính "nhiệt độ trung bình ngày"
 * nghiệp vụ (trung bình các obs 1h/7h/13h/19h) của NCHMF.
 */
export function classifyColdDamage(avgTempC: number): AlertLevel {
  if (avgTempC <= COLD_SEVERE_MAX_C) return 'red'; // rét hại
  if (avgTempC <= COLD_DAMP_MAX_C) return 'yellow'; // rét đậm
  return 'green';
}

// --- 2. Mưa lớn / lũ quét (proxy đơn giản hoá) ----------------------------
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

// --- 3. Sương mù dày -------------------------------------------------------
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
