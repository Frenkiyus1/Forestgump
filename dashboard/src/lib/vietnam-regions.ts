// Nationwide expansion roadmap: the three macro-regions of Vietnam and the
// coastal provinces most exposed to saltwater intrusion in each. Only Hải
// Phòng has live field stations today (see stations-mock.ts) — every other
// province is a planned/display-only placeholder until hardware ships there.

export type RegionKey = 'bac' | 'trung' | 'nam';

export interface ProvinceEntry {
	name: string;
	/** True only for the province with real deployed stations (Hải Phòng). */
	hasData: boolean;
}

export interface VietnamRegion {
	key: RegionKey;
	name: string;
	shortLabel: string;
	blurb: string;
	provinces: ProvinceEntry[];
}

export const VIETNAM_REGIONS: VietnamRegion[] = [
	{
		key: 'bac',
		name: 'Miền Bắc',
		shortLabel: 'Bắc',
		blurb: 'Đồng bằng sông Hồng — cửa sông ven biển từ Hải Phòng đến Ninh Bình.',
		provinces: [
			{ name: 'Hải Phòng', hasData: true },
			{ name: 'Nam Định', hasData: false },
			{ name: 'Ninh Bình', hasData: false }
		]
	},
	{
		key: 'trung',
		name: 'Miền Trung',
		shortLabel: 'Trung',
		blurb: 'Dải ven biển miền Trung, từ Thanh Hóa đến Đà Nẵng.',
		provinces: [
			{ name: 'Thanh Hóa', hasData: false },
			{ name: 'Nghệ An', hasData: false },
			{ name: 'Hà Tĩnh', hasData: false },
			{ name: 'Quảng Bình', hasData: false },
			{ name: 'Thừa Thiên Huế', hasData: false },
			{ name: 'Đà Nẵng', hasData: false }
		]
	},
	{
		key: 'nam',
		name: 'Miền Nam',
		shortLabel: 'Nam',
		blurb: 'Đồng bằng sông Cửu Long — vùng nhiễm mặn nặng nhất cả nước.',
		provinces: [
			{ name: 'Bến Tre', hasData: false },
			{ name: 'Tiền Giang', hasData: false },
			{ name: 'Long An', hasData: false },
			{ name: 'Trà Vinh', hasData: false },
			{ name: 'Sóc Trăng', hasData: false },
			{ name: 'Cà Mau', hasData: false },
			{ name: 'Kiên Giang', hasData: false },
			{ name: 'Bạc Liêu', hasData: false }
		]
	}
];
