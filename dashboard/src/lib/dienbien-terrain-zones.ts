// Phân loại 45 xã/phường Điện Biên (sau sáp nhập 01/07/2025, Nghị quyết
// 1661/NQ-UBTVQH15) vào 3 vùng địa hình dùng để nội suy cảnh báo thời tiết
// từ 3 điểm anchor có dữ liệu thật (xem backend/src/config/locations.ts).
//
// QUAN TRỌNG: đây KHÔNG phải dữ liệu đo đạc/khảo sát chính thức — là suy luận
// địa lý dựa trên tên gọi, huyện cũ, và đặc điểm địa hình đã biết qua tra cứu
// (không tự bịa, có nguồn tham khảo trong docs/dienbien-phase2-terrain.md).
// Mọi xã có `confidence` — 'high' | 'medium' | 'low'. UI PHẢI hiển thị khác
// biệt (vd. viền nét đứt/độ mờ) cho confidence 'low' để không đánh lừa người
// xem về độ chi tiết thật của dữ liệu. Cần chuyên gia địa phương xác nhận lại
// trước khi dùng cho cảnh báo chính thức.

import type { Terrain } from '../../../backend/src/config/locations';

export type TerrainConfidence = 'high' | 'medium' | 'low';

export interface TerrainZoneAssignment {
	terrain: Terrain;
	confidence: TerrainConfidence;
	note: string;
}

// Khoá theo đúng `name` trong dashboard/src/lib/dienbien-hotspots.ts.
export const TERRAIN_ZONE_BY_NAME: Record<string, TerrainZoneAssignment> = {
	'Xã Mường Nhé': {
		terrain: 'ven_suoi',
		confidence: 'high',
		note: 'Đã là anchor — thung lũng suối Nậm Nhé.'
	},
	'Xã Sín Thầu': {
		terrain: 'nui_cao',
		confidence: 'high',
		note: 'Cực Tây A Pa Chải, đỉnh Khoan La San, ngã ba biên giới.'
	},
	'Xã Mường Toong': {
		terrain: 'ven_suoi',
		confidence: 'medium',
		note: 'Lưu vực Nậm Núa, huyện Mường Nhé cũ.'
	},
	'Xã Nậm Kè': {
		terrain: 'ven_suoi',
		confidence: 'medium',
		note: 'Tên "Nậm" = sông suối; cụm Mường Nhé.'
	},
	'Xã Quảng Lâm': {
		terrain: 'ven_suoi',
		confidence: 'low',
		note: 'Cụm Mường Nhé, chưa xác nhận cụ thể.'
	},
	'Xã Nà Hỳ': {
		terrain: 'ven_suoi',
		confidence: 'low',
		note: 'Cụm Mường Nhé, chưa xác nhận cụ thể.'
	},
	'Xã Mường Chà': {
		terrain: 'ven_suoi',
		confidence: 'medium',
		note: 'Thị trấn cũ dọc thung lũng Nậm Mức.'
	},
	'Xã Nà Bủng': {
		terrain: 'nui_cao',
		confidence: 'low',
		note: 'Vùng cao biên giới, chưa xác nhận cụ thể.'
	},
	'Xã Chà Tở': {
		terrain: 'nui_cao',
		confidence: 'low',
		note: 'Vùng cao biên giới, chưa xác nhận cụ thể.'
	},
	'Xã Si Pa Phìn': {
		terrain: 'nui_cao',
		confidence: 'medium',
		note: 'Cao nguyên vùng cao lịch sử, độ cao lớn.'
	},
	'Xã Na Sang': {
		terrain: 'ven_suoi',
		confidence: 'medium',
		note: 'Cụm Mường Chà, dọc trục Nậm Na.'
	},
	'Xã Mường Tùng': {
		terrain: 'ven_suoi',
		confidence: 'medium',
		note: 'Hành lang Nậm Na hướng Mường Lay.'
	},
	'Xã Pa Ham': { terrain: 'ven_suoi', confidence: 'medium', note: 'Ven Nậm Na, giáp biên.' },
	'Xã Nậm Nèn': { terrain: 'ven_suoi', confidence: 'medium', note: 'Tên "Nậm" = sông suối.' },
	'Xã Mường Pồn': {
		terrain: 'ven_suoi',
		confidence: 'low',
		note: 'Có suối Mường Pồn, chưa xác nhận kỹ.'
	},
	'Xã Tủa Chùa': {
		terrain: 'nui_cao',
		confidence: 'high',
		note: 'Đã là anchor — cao nguyên đá vôi.'
	},
	'Xã Sín Chải': { terrain: 'nui_cao', confidence: 'high', note: 'Cùng cao nguyên đá Tủa Chùa.' },
	'Xã Sính Phình': { terrain: 'nui_cao', confidence: 'high', note: 'Cùng cao nguyên đá Tủa Chùa.' },
	'Xã Tủa Thàng': { terrain: 'nui_cao', confidence: 'high', note: 'Cùng cao nguyên đá Tủa Chùa.' },
	'Xã Sáng Nhè': { terrain: 'nui_cao', confidence: 'high', note: 'Cùng cao nguyên đá Tủa Chùa.' },
	'Xã Tuần Giáo': {
		terrain: 'nui_cao',
		confidence: 'medium',
		note: 'Thị trấn trong thung lũng nhỏ, bao quanh toàn núi (gần đèo Pha Đin).'
	},
	'Xã Quài Tở': {
		terrain: 'nui_cao',
		confidence: 'high',
		note: 'Gồm Tỏa Tình — vùng đèo Pha Đin, núi rất cao.'
	},
	'Xã Mường Mùn': {
		terrain: 'nui_cao',
		confidence: 'medium',
		note: 'Vùng núi huyện Tuần Giáo cũ.'
	},
	'Xã Pú Nhung': { terrain: 'nui_cao', confidence: 'medium', note: 'Vùng núi huyện Tuần Giáo cũ.' },
	'Xã Chiềng Sinh': {
		terrain: 'nui_cao',
		confidence: 'medium',
		note: 'Vùng núi huyện Tuần Giáo cũ.'
	},
	'Xã Mường Ảng': {
		terrain: 'nui_cao',
		confidence: 'medium',
		note: 'Vùng đồi cao trồng cà phê, độ cao vừa.'
	},
	'Xã Nà Tấu': { terrain: 'nui_cao', confidence: 'medium', note: 'Vùng cao phía bắc lòng chảo.' },
	'Xã Búng Lao': { terrain: 'nui_cao', confidence: 'medium', note: 'Cụm Mường Ảng cũ.' },
	'Xã Mường Lạn': { terrain: 'nui_cao', confidence: 'medium', note: 'Cụm Mường Ảng cũ.' },
	'Xã Mường Phăng': {
		terrain: 'nui_cao',
		confidence: 'medium',
		note: 'Vùng đồi quanh hồ Pá Khoang, độ cao ~800-1000m.'
	},
	'Xã Thanh Nưa': {
		terrain: 'thung_lung',
		confidence: 'high',
		note: 'Đồng bằng lòng chảo Mường Thanh, phía bắc TP.'
	},
	'Xã Thanh An': {
		terrain: 'thung_lung',
		confidence: 'high',
		note: 'Đồng bằng lòng chảo Mường Thanh.'
	},
	'Xã Thanh Yên': {
		terrain: 'thung_lung',
		confidence: 'high',
		note: 'Đồng bằng lòng chảo Mường Thanh, phía nam.'
	},
	'Xã Sam Mứn': {
		terrain: 'thung_lung',
		confidence: 'high',
		note: 'Đồng bằng lòng chảo Mường Thanh, phía nam.'
	},
	'Xã Núa Ngam': {
		terrain: 'ven_suoi',
		confidence: 'low',
		note: 'Rìa lòng chảo giáp núi, gần suối Nậm Núa.'
	},
	'Xã Mường Nhà': {
		terrain: 'nui_cao',
		confidence: 'low',
		note: 'Vùng đồi núi biên giới phía nam.'
	},
	'Xã Na Son': {
		terrain: 'nui_cao',
		confidence: 'medium',
		note: 'Trung tâm Điện Biên Đông cũ, vùng núi.'
	},
	'Xã Xa Dung': {
		terrain: 'nui_cao',
		confidence: 'medium',
		note: 'Vùng núi huyện Điện Biên Đông cũ.'
	},
	'Xã Pu Nhi': {
		terrain: 'nui_cao',
		confidence: 'medium',
		note: 'Vùng núi huyện Điện Biên Đông cũ.'
	},
	'Xã Mường Luân': {
		terrain: 'ven_suoi',
		confidence: 'low',
		note: 'Gồm Chiềng Sơ dọc suối Nậm Mã giáp Lào.'
	},
	'Xã Tìa Dình': {
		terrain: 'nui_cao',
		confidence: 'medium',
		note: 'Vùng núi cao hiểm trở, nổi tiếng xa xôi.'
	},
	'Xã Phình Giàng': {
		terrain: 'nui_cao',
		confidence: 'medium',
		note: 'Vùng núi cao huyện Điện Biên Đông cũ.'
	},
	'Phường Mường Lay': {
		terrain: 'ven_suoi',
		confidence: 'high',
		note: 'Nơi hợp lưu 3 sông (Đà, Nậm Na, Nậm Lay), nổi tiếng lũ quét.'
	},
	'Phường Điện Biên Phủ': {
		terrain: 'thung_lung',
		confidence: 'high',
		note: 'Đã là anchor — trung tâm lòng chảo Mường Thanh.'
	},
	'Phường Mường Thanh': {
		terrain: 'thung_lung',
		confidence: 'high',
		note: 'Cùng lòng chảo, tên gọi từ cánh đồng Mường Thanh.'
	}
};

/** Anchor (locations.ts) đại diện cho mỗi terrain — dùng để lấy forecast/alert nội suy. */
export const ANCHOR_CODE_BY_TERRAIN: Record<Terrain, string> = {
	thung_lung: 'dbp',
	nui_cao: 'tua-chua',
	ven_suoi: 'muong-nhe'
};
