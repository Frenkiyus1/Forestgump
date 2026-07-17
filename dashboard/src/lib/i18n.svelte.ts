import { browser } from '$app/environment';

export type Lang = 'vi' | 'en';
const LANG_KEY = 'forestgump_lang';

const dict: Record<Lang, Record<string, string>> = {
	vi: {
		// nav
		'nav.overview': 'Tổng quan',
		'nav.stations': 'Trạm đo',
		'nav.map': 'Bản đồ',
		'nav.alerts': 'Cảnh báo',
		'nav.reports': 'Báo cáo',
		'nav.settings': 'Cài đặt',
		'nav.logout': 'Đăng xuất',
		search: 'Tìm kiếm',
		// settings
		'settings.title': 'Cài đặt',
		'settings.close': 'Đóng',
		'settings.tab.profile': 'Thông tin cá nhân',
		'settings.tab.language': 'Ngôn ngữ',
		'settings.save': 'Lưu thay đổi',
		'settings.saved': 'Đã lưu',
		// profile form
		'profile.province': 'Tỉnh / Thành phố',
		'profile.district': 'Quận / Huyện',
		'profile.commune': 'Xã / Phường',
		'profile.commune.hint': 'tùy chọn',
		'profile.farmType': 'Loại canh tác',
		'profile.farmArea': 'Diện tích',
		'profile.waterSource': 'Nguồn nước',
		'profile.alertThreshold': 'Ngưỡng cảnh báo',
		'profile.leadTime': 'Thời gian báo trước',
		'profile.experience': 'Kinh nghiệm với mặn',
		'profile.select': 'Chọn...',
		// language tab
		'lang.title': 'Ngôn ngữ hiển thị',
		'lang.desc': 'Áp dụng ngay — không cần tải lại trang.',
		'lang.vi': 'Tiếng Việt',
		'lang.en': 'English',
		// home
		'home.title': 'Tổng quan độ mặn',
		'home.sub':
			'{total} trạm đo trên cả nước. Dự báo trước 24–72 giờ, cảnh báo theo ngưỡng 1 & 4 g/L.',
		'kpi.safe': 'Trạm an toàn',
		'kpi.safe.sub': '{pct}% mạng lưới',
		'kpi.risk': 'Có nguy cơ',
		'kpi.risk.sub': 'Vàng hoặc đỏ',
		'kpi.peak': 'Độ mặn cao nhất',
		'kpi.peak.sub': 'Dự báo 24 giờ',
		'kpi.level': 'Mực nước TB',
		'kpi.level.sub': 'Toàn mạng lưới',
		'alert.green': 'An toàn',
		'alert.yellow': 'Thận trọng',
		'alert.red': 'Nguy hiểm'
	},
	en: {
		// nav
		'nav.overview': 'Overview',
		'nav.stations': 'Stations',
		'nav.map': 'Map',
		'nav.alerts': 'Alerts',
		'nav.reports': 'Reports',
		'nav.settings': 'Settings',
		'nav.logout': 'Log out',
		search: 'Search',
		// settings
		'settings.title': 'Settings',
		'settings.close': 'Close',
		'settings.tab.profile': 'User profile',
		'settings.tab.language': 'Language',
		'settings.save': 'Save changes',
		'settings.saved': 'Saved',
		// profile form
		'profile.province': 'Province / City',
		'profile.district': 'District',
		'profile.commune': 'Commune',
		'profile.commune.hint': 'optional',
		'profile.farmType': 'Farm type',
		'profile.farmArea': 'Farm area',
		'profile.waterSource': 'Water source',
		'profile.alertThreshold': 'Alert threshold',
		'profile.leadTime': 'Lead time',
		'profile.experience': 'Salinity experience',
		'profile.select': 'Select...',
		// language tab
		'lang.title': 'Display language',
		'lang.desc': 'Takes effect immediately — no page reload needed.',
		'lang.vi': 'Tiếng Việt',
		'lang.en': 'English',
		// home
		'home.title': 'Salinity overview',
		'home.sub':
			'{total} field stations nationwide. Forecasts run 24–72 hours ahead, flagged against the 1 & 4 g/L thresholds.',
		'kpi.safe': 'Safe stations',
		'kpi.safe.sub': '{pct}% of network',
		'kpi.risk': 'At risk',
		'kpi.risk.sub': 'Yellow or red',
		'kpi.peak': 'Peak salinity',
		'kpi.peak.sub': '24h forecast',
		'kpi.level': 'Avg water level',
		'kpi.level.sub': 'Across network',
		'alert.green': 'Safe',
		'alert.yellow': 'Caution',
		'alert.red': 'Danger'
	}
};

class I18nState {
	lang = $state<Lang>(browser ? ((localStorage.getItem(LANG_KEY) as Lang) ?? 'vi') : 'vi');

	setLang(l: Lang): void {
		this.lang = l;
		if (browser) localStorage.setItem(LANG_KEY, l);
	}

	t(key: string, vars?: Record<string, string | number>): string {
		const str = dict[this.lang][key] ?? dict.en[key] ?? key;
		if (!vars) return str;
		return str.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
	}
}

export const i18n = new I18nState();

export function t(key: string, vars?: Record<string, string | number>): string {
	return i18n.t(key, vars);
}
