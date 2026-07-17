import type { AlertType } from './types';

export type Location = {
	id: string;
	name: string;
	terrain: string;
	primaryRisk: AlertType;
	lat: number;
	lon: number;
};

// TODO: verify coordinates — hiện lấy gần đúng theo trung tâm hành chính, cần đối chiếu
// lại với toạ độ trạm quan trắc thật của đội hạ tầng trước khi lên production.
export const LOCATIONS: Location[] = [
	{
		id: 'tp-dien-bien-phu',
		name: 'TP. Điện Biên Phủ',
		terrain: 'Lòng chảo, ven sông Nậm Rốm',
		primaryRisk: 'suong-mu',
		lat: 21.3891,
		lon: 103.0156
	},
	{
		id: 'muong-nhe',
		name: 'Mường Nhé',
		terrain: 'Vùng cao dốc đứng, đầu nguồn suối',
		primaryRisk: 'lu-quet',
		lat: 22.1167,
		lon: 102.4667
	},
	{
		id: 'tua-chua',
		name: 'Tủa Chùa',
		terrain: 'Cao nguyên đá, trên 1000m',
		primaryRisk: 'bang-gia',
		lat: 21.9667,
		lon: 103.3667
	}
];

export function getLocation(id: string): Location | undefined {
	return LOCATIONS.find((l) => l.id === id);
}
