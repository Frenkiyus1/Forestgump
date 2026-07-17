import type { StationDetail, HistoryPoint, AlertLevel, AlertEvent } from './types';

// Các vùng (quận/huyện) khớp với roster trạm mở rộng bên dưới — trải dọc theo
// 3 nhánh sông chính của Hải Phòng (Cấm / Lạch Tray / Văn Úc).
export const HAI_PHONG_REGIONS = [
	'Tiên Lãng',
	'Thủy Nguyên',
	'Hải An',
	'Kiến Thụy',
	'Cát Hải',
	'Vĩnh Bảo',
	'Đồ Sơn',
	'Hồng Bàng',
	'Ngô Quyền',
	'Kiến An',
	'An Dương',
	'An Lão'
];

function alertFor(ec: number): AlertLevel {
	if (ec > 4) return 'red';
	if (ec >= 1) return 'yellow';
	return 'green';
}

function minsAgo(mins: number): string {
	return new Date(Date.now() - mins * 60_000).toISOString();
}

// Roster trạm dọc 3 nhánh sông chính đổ ra biển ở Hải Phòng — mỗi nhánh 4 trạm
// quan trắc riêng lẻ (mặn nhất ở cửa sông, vơi dần lên thượng nguồn) + 1 trạm
// TỔNG HỢP đại diện cho cả nhánh (giá trị = trung bình 4 trạm quan trắc, không
// phải cảm biến vật lý riêng — xem station-map.svelte để biết cách hiển thị).
// Tên trạm bám theo địa danh/cầu THẬT dọc từng sông ngoài đời (Cầu Bính, Cầu
// Kiền, Cầu Hoàng Văn Thụ trên sông Cấm; Cầu Rào, Cầu Niệm trên Lạch Tray;
// Cầu Khuể trên Văn Úc). ST001 là trạm phần cứng thật duy nhất; các trạm còn
// lại là dữ liệu minh hoạ cho lộ trình mở rộng mạng lưới.
export const MOCK_STATION_DETAILS: StationDetail[] = [
	// ---------- Sông Cấm (bắc: Thủy Nguyên / Hải An / Cát Hải) ----------
	{
		station_id: 'ST002',
		name: 'Cửa sông Bạch Đằng',
		region: 'Thủy Nguyên',
		lat: 20.7891,
		lon: 106.7654,
		ec: 4.6,
		temp: 29.3,
		level: 1.9,
		forecast_24h: 5.0,
		forecast_48h: 5.2,
		alert: alertFor(4.6),
		battery: 73,
		signal: 4,
		trend: 'up',
		updated_at: minsAgo(6),
		river: 'cam'
	},
	{
		station_id: 'ST006',
		name: 'Cửa Nam Triệu',
		region: 'Cát Hải',
		lat: 20.83,
		lon: 106.85,
		ec: 2.6,
		temp: 29.6,
		level: 2.0,
		forecast_24h: 2.9,
		forecast_48h: 3.1,
		alert: alertFor(2.6),
		battery: 80,
		signal: 3,
		trend: 'up',
		updated_at: minsAgo(9),
		river: 'cam'
	},
	{
		station_id: 'ST004',
		name: 'Cửa Cấm',
		region: 'Hải An',
		lat: 20.855,
		lon: 106.72,
		ec: 1.4,
		temp: 28.1,
		level: 1.4,
		forecast_24h: 1.7,
		forecast_48h: 1.5,
		alert: alertFor(1.4),
		battery: 92,
		signal: 4,
		trend: 'flat',
		updated_at: minsAgo(18),
		river: 'cam'
	},
	{
		station_id: 'ST009',
		name: 'Cầu Kiền',
		region: 'Thủy Nguyên',
		lat: 20.86,
		lon: 106.62,
		ec: 0.8,
		temp: 27.0,
		level: 1.0,
		forecast_24h: 1.0,
		forecast_48h: 0.9,
		alert: alertFor(0.8),
		battery: 70,
		signal: 3,
		trend: 'flat',
		updated_at: minsAgo(20),
		river: 'cam'
	},
	{
		station_id: 'ST013',
		name: 'Trạm tổng hợp sông Cấm',
		region: 'Thủy Nguyên',
		lat: 20.86,
		lon: 106.8,
		ec: 2.35,
		temp: 28.5,
		level: 1.6,
		forecast_24h: 2.7,
		forecast_48h: 2.8,
		alert: alertFor(2.35),
		battery: 95,
		signal: 4,
		trend: 'up',
		updated_at: minsAgo(2),
		river: 'cam',
		isAggregate: true
	},

	// ---------- Sông Lạch Tray (giữa: Hải An / Đồ Sơn / Ngô Quyền / Kiến An) ----------
	{
		station_id: 'ST008',
		name: 'Bến Đồ Sơn',
		region: 'Đồ Sơn',
		lat: 20.71,
		lon: 106.78,
		ec: 3.1,
		temp: 28.7,
		level: 1.6,
		forecast_24h: 3.5,
		forecast_48h: 3.8,
		alert: alertFor(3.1),
		battery: 57,
		signal: 3,
		trend: 'up',
		updated_at: minsAgo(15),
		river: 'lachtray'
	},
	{
		station_id: 'ST003',
		name: 'Cửa sông Lạch Tray',
		region: 'Hải An',
		lat: 20.8123,
		lon: 106.6892,
		ec: 2.9,
		temp: 28.9,
		level: 1.7,
		forecast_24h: 3.3,
		forecast_48h: 3.0,
		alert: alertFor(2.9),
		battery: 64,
		signal: 3,
		trend: 'up',
		updated_at: minsAgo(11),
		river: 'lachtray'
	},
	{
		station_id: 'ST010',
		name: 'Cầu Rào',
		region: 'Ngô Quyền',
		lat: 20.845,
		lon: 106.7,
		ec: 2.0,
		temp: 28.3,
		level: 1.5,
		forecast_24h: 2.3,
		forecast_48h: 2.1,
		alert: alertFor(2.0),
		battery: 66,
		signal: 4,
		trend: 'up',
		updated_at: minsAgo(14),
		river: 'lachtray'
	},
	{
		station_id: 'ST011',
		name: 'Cầu Niệm',
		region: 'Kiến An',
		lat: 20.8,
		lon: 106.63,
		ec: 0.5,
		temp: 27.4,
		level: 1.1,
		forecast_24h: 0.6,
		forecast_48h: 0.5,
		alert: alertFor(0.5),
		battery: 55,
		signal: 3,
		trend: 'down',
		updated_at: minsAgo(30),
		river: 'lachtray'
	},
	{
		station_id: 'ST014',
		name: 'Trạm tổng hợp sông Lạch Tray',
		region: 'Kiến An',
		lat: 20.8,
		lon: 106.72,
		ec: 2.1,
		temp: 28.3,
		level: 1.5,
		forecast_24h: 2.4,
		forecast_48h: 2.4,
		alert: alertFor(2.1),
		battery: 95,
		signal: 4,
		trend: 'up',
		updated_at: minsAgo(2),
		river: 'lachtray',
		isAggregate: true
	},

	// ---------- Sông Văn Úc (nam: Tiên Lãng / Kiến Thụy / An Lão / Vĩnh Bảo) ----------
	{
		station_id: 'ST001',
		name: 'Cửa sông Văn Úc',
		region: 'Tiên Lãng',
		lat: 20.6712,
		lon: 106.5483,
		ec: 2.1,
		temp: 28.4,
		level: 1.5,
		forecast_24h: 2.6,
		forecast_48h: 2.9,
		alert: alertFor(2.1),
		battery: 88,
		signal: 4,
		trend: 'up',
		updated_at: minsAgo(3),
		river: 'vanuc'
	},
	{
		station_id: 'ST012',
		name: 'Cầu Khuể',
		region: 'An Lão',
		lat: 20.72,
		lon: 106.58,
		ec: 1.2,
		temp: 27.8,
		level: 1.3,
		forecast_24h: 1.4,
		forecast_48h: 1.3,
		alert: alertFor(1.2),
		battery: 60,
		signal: 2,
		trend: 'flat',
		updated_at: minsAgo(26),
		river: 'vanuc'
	},
	{
		station_id: 'ST005',
		name: 'Sông Đa Độ',
		region: 'Kiến Thụy',
		lat: 20.74,
		lon: 106.62,
		ec: 0.6,
		temp: 27.6,
		level: 1.2,
		forecast_24h: 0.9,
		forecast_48h: 0.8,
		alert: alertFor(0.6),
		battery: 41,
		signal: 2,
		trend: 'down',
		updated_at: minsAgo(24),
		river: 'vanuc'
	},
	{
		station_id: 'ST007',
		name: 'Sông Thái Bình',
		region: 'Vĩnh Bảo',
		lat: 20.61,
		lon: 106.45,
		ec: 0.4,
		temp: 27.2,
		level: 1.1,
		forecast_24h: 0.6,
		forecast_48h: 0.5,
		alert: alertFor(0.4),
		battery: 19,
		signal: 1,
		trend: 'down',
		updated_at: minsAgo(52),
		river: 'vanuc'
	},
	{
		station_id: 'ST015',
		name: 'Trạm tổng hợp sông Văn Úc',
		region: 'Tiên Lãng',
		lat: 20.65,
		lon: 106.52,
		ec: 1.1,
		temp: 27.8,
		level: 1.3,
		forecast_24h: 1.4,
		forecast_48h: 1.4,
		alert: alertFor(1.1),
		battery: 95,
		signal: 4,
		trend: 'flat',
		updated_at: minsAgo(2),
		river: 'vanuc',
		isAggregate: true
	}
];

// Deterministic pseudo-random from a string seed so a station's history is stable.
function seed(str: string): number {
	let h = 0;
	for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
	return h;
}

// Deterministic alert history derived from the station roster. Red stations
// produce danger events, caution stations yellow ones, and "safe" stations a
// single past spike — so the history list always shows realistic variety.
// Trạm tổng hợp bị loại khỏi lịch sử cảnh báo — nó là số liệu trung bình tính
// toán, không phải một cảm biến vật lý thật sự "kích hoạt" cảnh báo.
export function mockAlertHistory(): AlertEvent[] {
	const out: AlertEvent[] = [];

	for (const st of MOCK_STATION_DETAILS.filter((s) => !s.isAggregate)) {
		const s = seed(st.station_id);
		const plan: AlertEvent['level'][] =
			st.alert === 'red'
				? ['red', 'red', 'yellow']
				: st.alert === 'yellow'
					? ['yellow', 'yellow']
					: ['yellow']; // a green station that crossed caution earlier

		plan.forEach((level, i) => {
			const hoursAgo = 3 + ((s >> (i * 3)) & 31) + i * 22; // spread across ~a week
			const ts = new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
			const frac = ((s >> i) & 7) / 7;
			const ec =
				level === 'red'
					? Number((4.1 + frac * 1.4).toFixed(1))
					: Number((1.1 + frac * 2.6).toFixed(1));
			out.push({
				id: `${st.station_id}-${i}`,
				station_id: st.station_id,
				station: st.name,
				region: st.region,
				level,
				ec,
				message:
					level === 'red'
						? 'EC exceeded 4 g/L — close the gates immediately'
						: 'EC crossed the 1 g/L caution threshold',
				ts
			});
		});
	}

	return out.sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
}

export function mockHistory(stationId: string, from: string, to: string): HistoryPoint[] {
	const start = new Date(from).getTime();
	const end = new Date(to).getTime();
	const span = Math.max(end - start, 3_600_000);
	const points = 48;
	const step = span / points;
	const base = MOCK_STATION_DETAILS.find((s) => s.station_id === stationId)?.ec ?? 1.5;
	const s = seed(stationId);

	return Array.from({ length: points + 1 }, (_, i) => {
		const t = start + i * step;
		const wave = Math.sin((i / points) * Math.PI * 2 + (s % 7)) * 0.6;
		const drift = (i / points) * 0.4;
		const jitter = (((s >> (i % 16)) & 7) - 3) * 0.05;
		const ec = Math.max(0.1, base * 0.6 + wave + drift + jitter);
		return {
			ts: new Date(t).toISOString(),
			ec: Number(ec.toFixed(2)),
			temp: Number((27 + Math.sin(i / 6) * 1.5).toFixed(1)),
			level: Number((1.2 + Math.sin(i / 9) * 0.4).toFixed(2))
		};
	});
}
