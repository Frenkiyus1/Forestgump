// Cấu hình 3 địa điểm demo cho hệ thống cảnh báo thời tiết sớm Điện Biên
// (rét đậm/rét hại, mưa lớn/lũ quét, sương mù dày).
//
// Toạ độ & độ cao lấy từ Open-Meteo Geocoding API + Elevation API (không tự
// bịa số liệu): https://geocoding-api.open-meteo.com/v1/search và
// https://api.open-meteo.com/v1/elevation — tra cứu ngày 2026-07-17.
//
// Tên hành chính theo Nghị quyết số 1661/NQ-UBTVQH15 (sắp xếp đơn vị hành
// chính cấp xã tỉnh Điện Biên, hiệu lực 01/07/2025): tỉnh Điện Biên bỏ cấp
// huyện, quản lý trực tiếp 45 xã/phường. `oldDistrictName` giữ lại tên cũ
// (quen thuộc, dùng trong dữ liệu lịch sử/PCTT) để tra cứu chéo.

/** Đặc điểm địa hình — phục vụ downscaling vi khí hậu ở giai đoạn sau. */
export type Terrain = 'thung_lung' | 'nui_cao' | 'ven_suoi';

export interface DienBienLocation {
  /** Mã ngắn dùng làm khoá trong API/DB (vd. weatherForecast.locationCode). */
  code: string;
  /** Tên hành chính hiện hành (sau sáp nhập 01/07/2025). */
  name: string;
  /** Tên đơn vị hành chính cũ trước sáp nhập, để đối chiếu dữ liệu lịch sử. */
  oldDistrictName: string;
  lat: number;
  lon: number;
  /** Độ cao trung tâm, mét so với mực nước biển (Open-Meteo Elevation API). */
  elevationM: number;
  terrain: Terrain;
  /** Ghi chú địa hình cụ thể — ảnh hưởng tới sương mù/rét/lũ quét cục bộ. */
  terrainNote: string;
}

export const DIEN_BIEN_LOCATIONS: DienBienLocation[] = [
  {
    code: 'dbp',
    name: 'Phường Điện Biên Phủ',
    oldDistrictName: 'TP. Điện Biên Phủ',
    lat: 21.38602,
    lon: 103.02301,
    elevationM: 482,
    terrain: 'thung_lung',
    terrainNote:
      'Nằm giữa cánh đồng Mường Thanh — lòng chảo Điện Biên được núi bao quanh, ' +
      'thoát khí kém về đêm nên dễ đọng sương mù/sương muối mùa đông.',
  },
  {
    code: 'tua-chua',
    name: 'Xã Tủa Chùa',
    oldDistrictName: 'Huyện Tủa Chùa',
    lat: 21.863,
    lon: 103.331,
    elevationM: 871,
    terrain: 'nui_cao',
    terrainNote:
      'Vùng cao nguyên đá vôi, địa hình chia cắt mạnh, nhiều bản nằm trên 1000m — ' +
      'nền nhiệt thấp hơn đáng kể so với trung tâm thành phố, rét hại xảy ra sớm và kéo dài hơn.',
  },
  {
    code: 'muong-nhe',
    name: 'Xã Mường Nhé',
    oldDistrictName: 'Huyện Mường Nhé',
    lat: 22.19236,
    lon: 102.4579,
    elevationM: 540,
    terrain: 'ven_suoi',
    terrainNote:
      'Thung lũng dọc suối Nậm Nhé sát biên giới Việt–Lào–Trung, địa hình núi dốc bao quanh — ' +
      'nguy cơ lũ quét cao khi mưa lớn tập trung ở thượng nguồn.',
  },
];

export function findLocationByCode(code: string): DienBienLocation | undefined {
  return DIEN_BIEN_LOCATIONS.find((l) => l.code === code);
}
