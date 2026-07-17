import { browser } from '$app/environment';

const PROFILE_KEY = 'forestgump_profile';

export interface UserProfile {
	province: string;
	district: string;
	commune: string;
	farmType: string;
	farmArea: string;
	waterSource: string;
	alertThreshold: string;
	leadTime: string;
	experience: string;
}

function empty(): UserProfile {
	return {
		province: '',
		district: '',
		commune: '',
		farmType: '',
		farmArea: '',
		waterSource: '',
		alertThreshold: '',
		leadTime: '',
		experience: ''
	};
}

export function getProfile(): UserProfile {
	if (!browser) return empty();
	const raw = localStorage.getItem(PROFILE_KEY);
	if (!raw) return empty();
	try {
		return { ...empty(), ...(JSON.parse(raw) as Partial<UserProfile>) };
	} catch {
		return empty();
	}
}

export function saveProfile(p: UserProfile): void {
	if (!browser) return;
	localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export const FARM_TYPES = [
	{ id: 'rice', vi: 'Lúa nước', en: 'Wet rice' },
	{ id: 'veggie', vi: 'Rau màu', en: 'Vegetables' },
	{ id: 'fruit', vi: 'Cây ăn quả', en: 'Fruit trees' },
	{ id: 'aqua', vi: 'Thủy sản', en: 'Aquaculture' },
	{ id: 'mixed', vi: 'Kết hợp nhiều loại', en: 'Mixed farming' }
];

export const AREAS = [
	{ id: 'xs', vi: 'Dưới 0.5 ha', en: 'Under 0.5 ha' },
	{ id: 'sm', vi: '0.5 – 2 ha', en: '0.5 – 2 ha' },
	{ id: 'md', vi: '2 – 5 ha', en: '2 – 5 ha' },
	{ id: 'lg', vi: 'Trên 5 ha', en: 'Over 5 ha' }
];

export const WATER_SOURCES = [
	{ id: 'canal', vi: 'Kênh mương thủy lợi', en: 'Irrigation canal' },
	{ id: 'river', vi: 'Sông / Hồ / Đầm', en: 'River / Lake / Pond' },
	{ id: 'well', vi: 'Giếng khoan / đào', en: 'Borehole / Dug well' },
	{ id: 'multi', vi: 'Nhiều nguồn phối hợp', en: 'Multiple sources' }
];

export const THRESHOLDS = [
	{ id: 'sensitive', vi: 'Nhạy cao — EC ≥ 0.5 g/L', en: 'High sensitivity — EC ≥ 0.5 g/L' },
	{ id: 'standard', vi: 'Tiêu chuẩn — EC ≥ 1 g/L', en: 'Standard — EC ≥ 1 g/L' },
	{ id: 'critical', vi: 'Khẩn cấp — EC > 4 g/L', en: 'Critical only — EC > 4 g/L' }
];

export const LEAD_TIMES = [
	{ id: '24h', vi: '24 giờ trước', en: '24 hours ahead' },
	{ id: '48h', vi: '48 giờ trước', en: '48 hours ahead' },
	{ id: '72h', vi: '72 giờ trước', en: '72 hours ahead' }
];

export const EXPERIENCES = [
	{ id: 'never', vi: 'Chưa bao giờ bị ảnh hưởng', en: 'Never affected' },
	{ id: 'mild', vi: 'Bị ảnh hưởng nhẹ vài lần', en: 'Mildly affected a few times' },
	{ id: 'heavy', vi: 'Đã thiệt hại nặng', en: 'Suffered heavy losses' }
];
