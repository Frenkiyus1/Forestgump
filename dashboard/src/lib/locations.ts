import type { AlertType } from './types';

export type Location = {
	id: string;
	name: string;
	terrain: string;
	primaryRisk: AlertType;
	lat: number;
	lon: number;
};

// Toạ độ khớp với backend/src/config/locations.ts (DIEN_BIEN_LOCATIONS, nguồn
// Open-Meteo Geocoding/Elevation API) — 3 địa điểm này là anchor có dữ liệu đo
// thật cho GET /api/dienbien-forecast; id ở đây khác backend (lịch sử UI cũ)
// nhưng lat/lon PHẢI khớp để không lệch dữ liệu khi tra cứu theo toạ độ.
export const LOCATIONS: Location[] = [
	{
		id: 'tp-dien-bien-phu',
		name: 'TP. Điện Biên Phủ',
		terrain: 'Lòng chảo, ven sông Nậm Rốm',
		primaryRisk: 'suong-mu',
		lat: 21.38602,
		lon: 103.02301
	},
	{
		id: 'muong-nhe',
		name: 'Mường Nhé',
		terrain: 'Vùng cao dốc đứng, đầu nguồn suối',
		primaryRisk: 'lu-quet',
		lat: 22.19236,
		lon: 102.4579
	},
	{
		id: 'tua-chua',
		name: 'Tủa Chùa',
		terrain: 'Cao nguyên đá, trên 1000m',
		primaryRisk: 'bang-gia',
		lat: 21.863,
		lon: 103.331
	}
];

export function getLocation(id: string): Location | undefined {
	return LOCATIONS.find((l) => l.id === id);
}
