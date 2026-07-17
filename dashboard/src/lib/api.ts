import { env } from '$env/dynamic/public';
import type {
	Station,
	LatestReading,
	StationDetail,
	HistoryPoint,
	AlertEvent,
	StationView
} from './types';
import { MOCK_STATION_DETAILS, mockHistory, mockAlertHistory } from './stations-mock';
import { toStationViews } from './derive';

export class ApiError extends Error {
	status: number;
	constructor(message: string, status: number) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
	}
}

function baseUrl(): string {
	const url = env.PUBLIC_API_URL;
	if (!url) throw new ApiError('PUBLIC_API_URL is not configured', 0);
	return url.replace(/\/$/, '');
}

export async function getStations(fetchFn: typeof fetch): Promise<Station[]> {
	const res = await fetchFn(`${baseUrl()}/api/stations`);
	if (!res.ok) throw new ApiError('Failed to fetch stations', res.status);
	return res.json();
}

export async function getLatest(fetchFn: typeof fetch, stationId: string): Promise<LatestReading> {
	const res = await fetchFn(`${baseUrl()}/api/latest?station=${encodeURIComponent(stationId)}`);
	if (!res.ok) throw new ApiError(`Failed to fetch latest for ${stationId}`, res.status);
	return res.json();
}

export type ChatReply = { reply: string };
export type ChatTurn = { role: 'user' | 'model'; text: string };

// POST /api/chat { messages } -> { reply }. Sends the whole conversation so the
// assistant remembers context across turns.
export async function sendChatMessage(
	fetchFn: typeof fetch,
	messages: ChatTurn[]
): Promise<ChatReply> {
	const res = await fetchFn(`${baseUrl()}/api/chat`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ messages })
	});
	if (!res.ok) throw new ApiError('Failed to send chat message', res.status);
	return res.json();
}

// GET /api/stations + /api/latest per station → overview dashboard views. Used
// both by the server load() and by client-side polling on the Overview page for
// near-live updates. Throws on error (callers decide how to handle/fall back).
export async function fetchDashboardViews(fetchFn: typeof fetch): Promise<StationView[]> {
	const stations = await getStations(fetchFn);
	const settled = await Promise.allSettled(stations.map((s) => getLatest(fetchFn, s.station_id)));
	const readings = settled
		.filter((r): r is PromiseFulfilledResult<LatestReading> => r.status === 'fulfilled')
		.map((r) => r.value);
	return toStationViews(stations, readings);
}

// GET /api/stations → full station details. Falls back to mock data on any error
// so the Stations page always renders.
export async function fetchStationDetails(fetchFn: typeof fetch): Promise<StationDetail[]> {
	try {
		const res = await fetchFn(`${baseUrl()}/api/stations`, { signal: AbortSignal.timeout(2500) });
		if (!res.ok) throw new ApiError('Failed to fetch stations', res.status);
		return (await res.json()) as StationDetail[];
	} catch (err) {
		console.warn('[api] /api/stations unreachable, using fallback mock data:', err);
		return MOCK_STATION_DETAILS;
	}
}

// GET /api/alerts → threshold-crossing history. Falls back to generated mock
// data on any error so the Alerts page always renders.
export async function fetchAlertHistory(fetchFn: typeof fetch): Promise<AlertEvent[]> {
	try {
		const res = await fetchFn(`${baseUrl()}/api/alerts`, { signal: AbortSignal.timeout(2500) });
		if (!res.ok) throw new ApiError('Failed to fetch alerts', res.status);
		return (await res.json()) as AlertEvent[];
	} catch (err) {
		console.warn('[api] /api/alerts unreachable, using fallback mock data:', err);
		return mockAlertHistory();
	}
}

// GET /api/history?station=ID&from=ISO&to=ISO → readings over time.
// Falls back to generated mock history on any error.
export async function fetchHistory(
	fetchFn: typeof fetch,
	stationId: string,
	from: string,
	to: string
): Promise<HistoryPoint[]> {
	try {
		const params = new URLSearchParams({ station: stationId, from, to });
		const res = await fetchFn(`${baseUrl()}/api/history?${params}`, {
			signal: AbortSignal.timeout(2500)
		});
		if (!res.ok) throw new ApiError(`Failed to fetch history for ${stationId}`, res.status);
		return (await res.json()) as HistoryPoint[];
	} catch (err) {
		console.warn(`[api] /api/history for ${stationId} unreachable, using fallback mock:`, err);
		return mockHistory(stationId, from, to);
	}
}
