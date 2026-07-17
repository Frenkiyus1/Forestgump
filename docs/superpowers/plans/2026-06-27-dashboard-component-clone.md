# ForestGump Dashboard Component Clone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ForestGump overview page by cloning the reference admin-dashboard layout, decomposed into fine-grained reusable Svelte 5 components, rebranded to the salinity domain, wired to the real backend where endpoints exist and mocked (behind real-shaped interfaces) where they don't.

**Architecture:** A `+page.server.ts` `load` fetches `/api/stations` + `/api/latest` per station via `lib/api.ts`. Pure functions in `lib/derive.ts` turn raw data into view models (safe %, at-risk count, health %, top stations). `+page.svelte` composes fine-grained props-driven components from `lib/components/`. Mock widgets read from `lib/mock.ts` shaped to future endpoints. uPlot powers the trend chart.

**Tech Stack:** SvelteKit 2, Svelte 5 (runes), TypeScript, Tailwind v4, uPlot, Vitest (unit tests for pure logic), adapter-cloudflare.

## Global Constraints

- Svelte 5 runes only (`$state`, `$derived`, `$props`); never use `$effect` to set derived state.
- kebab-case file names; camelCase variables; SCREAMING_SNAKE_CASE constants.
- No hardcoded URLs/secrets — backend address from `PUBLIC_API_URL` env only; no fallback URL.
- Frontend wire field names stay snake_case (`station_id`, `forecast_24h`, `updated_at`); reuse backend `alert`, never recompute thresholds.
- Any `class` string over 100 chars must be split with `clsx` from `$lib/clsx`.
- Use `z.strictObject` (not `z.object`) if any Zod schema is added.
- Run `pnpm --dir dashboard lint` clean before every commit; Conventional Commits messages.
- Run Svelte MCP `svelte-autofixer` on each `.svelte` file until no issues before committing it.
- Visual style: cream page background, white rounded cards, soft warm shadows, orange accent. Alert dots always green/yellow/red.
- All commands run from repo root using `pnpm --dir dashboard ...` (Windows / PowerShell).

---

### Task 1: Add dependencies, env, and test infra

**Files:**
- Modify: `dashboard/package.json` (deps + test script)
- Create: `dashboard/vitest.config.ts`
- Create: `dashboard/.env.example`
- Modify: `dashboard/.env` (create if absent; gitignored)

**Interfaces:**
- Produces: `uplot` available for import; `vitest` runnable via `pnpm --dir dashboard test`; `PUBLIC_API_URL` env var.

- [ ] **Step 1: Install runtime + dev deps**

```bash
pnpm --dir dashboard add uplot
pnpm --dir dashboard add -D vitest @testing-library/svelte jsdom
```

- [ ] **Step 2: Add test script to package.json**

In `dashboard/package.json` `scripts`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `dashboard/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [svelte({ hot: false })],
	test: {
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.ts'],
	},
});
```

- [ ] **Step 4: Create `dashboard/.env.example`**

```bash
# Base URL of the ForestGump backend ingestion API (no trailing slash)
PUBLIC_API_URL=http://localhost:3000
```

- [ ] **Step 5: Create/append `dashboard/.env`**

```bash
PUBLIC_API_URL=http://localhost:3000
```

- [ ] **Step 6: Verify vitest runs (no tests yet = exit 0)**

Run: `pnpm --dir dashboard test`
Expected: exits 0, "No test files found" is acceptable.

- [ ] **Step 7: Commit**

```bash
git add dashboard/package.json dashboard/pnpm-lock.yaml dashboard/vitest.config.ts dashboard/.env.example
git commit -m "chore(dashboard): add uplot, vitest, and PUBLIC_API_URL env"
```

---

### Task 2: Types and API client

**Files:**
- Create: `dashboard/src/lib/types.ts`
- Create: `dashboard/src/lib/api.ts`

**Interfaces:**
- Produces:
  - `type AlertLevel = 'green' | 'yellow' | 'red'`
  - `type Station = { station_id: string; name: string; lat: number; lon: number }`
  - `type LatestReading = { station_id: string; temp: number; ec: number; level: number; forecast_24h: number; alert: AlertLevel; updated_at: string }`
  - `type StationView = { station: Station; reading: LatestReading | null }`
  - `type DashboardSummary = { total: number; greenCount: number; atRiskCount: number; safePct: number; healthPct: number; topStations: { name: string; value: number; alert: AlertLevel }[] }`
  - `async function getStations(fetchFn: typeof fetch): Promise<Station[]>`
  - `async function getLatest(fetchFn: typeof fetch, stationId: string): Promise<LatestReading>`
  - `class ApiError extends Error { status: number }`

- [ ] **Step 1: Create `dashboard/src/lib/types.ts`**

```ts
export type AlertLevel = 'green' | 'yellow' | 'red';

export interface Station {
	station_id: string;
	name: string;
	lat: number;
	lon: number;
}

export interface LatestReading {
	station_id: string;
	temp: number;
	ec: number;
	level: number;
	forecast_24h: number;
	alert: AlertLevel;
	updated_at: string;
}

export interface StationView {
	station: Station;
	reading: LatestReading | null;
}

export interface TopStation {
	name: string;
	value: number;
	alert: AlertLevel;
}

export interface DashboardSummary {
	total: number;
	greenCount: number;
	atRiskCount: number;
	safePct: number;
	healthPct: number;
	topStations: TopStation[];
}
```

- [ ] **Step 2: Create `dashboard/src/lib/api.ts`**

```ts
import { env } from '$env/dynamic/public';
import type { Station, LatestReading } from './types';

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
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --dir dashboard check`
Expected: no errors referencing `types.ts` or `api.ts`.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/types.ts dashboard/src/lib/api.ts
git commit -m "feat(dashboard): add API types and REST client"
```

---

### Task 3: Derive view models (TDD)

**Files:**
- Create: `dashboard/src/lib/derive.ts`
- Test: `dashboard/src/lib/derive.test.ts`

**Interfaces:**
- Consumes: `Station`, `LatestReading`, `StationView`, `DashboardSummary`, `TopStation` from `./types`.
- Produces:
  - `function toStationViews(stations: Station[], readings: LatestReading[]): StationView[]`
  - `function summarize(views: StationView[]): DashboardSummary`

- [ ] **Step 1: Write the failing test**

```ts
// dashboard/src/lib/derive.test.ts
import { describe, it, expect } from 'vitest';
import { toStationViews, summarize } from './derive';
import type { Station, LatestReading } from './types';

const stations: Station[] = [
	{ station_id: 'ST001', name: 'Văn Úc', lat: 20.6, lon: 106.5 },
	{ station_id: 'ST002', name: 'Bạch Đằng', lat: 20.7, lon: 106.7 },
	{ station_id: 'ST003', name: 'Lạch Tray', lat: 20.8, lon: 106.6 },
];
const readings: LatestReading[] = [
	{ station_id: 'ST001', temp: 26, ec: 0.5, level: 1, forecast_24h: 0.5, alert: 'green', updated_at: 'x' },
	{ station_id: 'ST002', temp: 27, ec: 2, level: 1, forecast_24h: 2.5, alert: 'yellow', updated_at: 'x' },
	{ station_id: 'ST003', temp: 28, ec: 5, level: 1, forecast_24h: 5, alert: 'red', updated_at: 'x' },
];

describe('toStationViews', () => {
	it('pairs each station with its reading, null when missing', () => {
		const views = toStationViews(stations, readings.slice(0, 2));
		expect(views).toHaveLength(3);
		expect(views[0].reading?.alert).toBe('green');
		expect(views[2].reading).toBeNull();
	});
});

describe('summarize', () => {
	it('computes counts, percentages, and sorted top stations', () => {
		const s = summarize(toStationViews(stations, readings));
		expect(s.total).toBe(3);
		expect(s.greenCount).toBe(1);
		expect(s.atRiskCount).toBe(2);
		expect(s.safePct).toBe(33);
		expect(s.healthPct).toBe(33);
		expect(s.topStations[0].name).toBe('Lạch Tray');
		expect(s.topStations[0].value).toBe(5);
	});

	it('handles empty input without dividing by zero', () => {
		const s = summarize([]);
		expect(s.total).toBe(0);
		expect(s.safePct).toBe(0);
		expect(s.topStations).toEqual([]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir dashboard test`
Expected: FAIL — `toStationViews`/`summarize` not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// dashboard/src/lib/derive.ts
import type { Station, LatestReading, StationView, DashboardSummary, TopStation } from './types';

export function toStationViews(stations: Station[], readings: LatestReading[]): StationView[] {
	const byId = new Map(readings.map((r) => [r.station_id, r]));
	return stations.map((station) => ({ station, reading: byId.get(station.station_id) ?? null }));
}

export function summarize(views: StationView[]): DashboardSummary {
	const total = views.length;
	const greenCount = views.filter((v) => v.reading?.alert === 'green').length;
	const atRiskCount = views.filter(
		(v) => v.reading?.alert === 'yellow' || v.reading?.alert === 'red'
	).length;
	const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

	const topStations: TopStation[] = views
		.filter((v) => v.reading !== null)
		.map((v) => ({
			name: v.station.name,
			value: v.reading!.forecast_24h,
			alert: v.reading!.alert,
		}))
		.sort((a, b) => b.value - a.value)
		.slice(0, 4);

	return {
		total,
		greenCount,
		atRiskCount,
		safePct: pct(greenCount),
		healthPct: pct(greenCount),
		topStations,
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir dashboard test`
Expected: PASS (4 assertions across 3 tests).

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/derive.ts dashboard/src/lib/derive.test.ts
git commit -m "feat(dashboard): derive station views and dashboard summary"
```

---

### Task 4: Mock data for endpoint-less widgets

**Files:**
- Create: `dashboard/src/lib/mock.ts`

**Interfaces:**
- Produces:
  - `type TrendSeries = { labels: string[]; values: number[] }`
  - `type PeakTiles = { peakSalinity: { value: number; unit: string }; peakDay: { label: string; sub: string }; topRiskStation: { name: string; sub: string } }`
  - `type AlertFeedItem = { id: string; station: string; level: AlertLevel; message: string; ago: string }`
  - `type QuickAction = { id: string; label: string }`
  - `const MOCK_TREND: TrendSeries`
  - `const MOCK_PEAKS: PeakTiles`
  - `const MOCK_ALERT_FEED: AlertFeedItem[]`
  - `const QUICK_ACTIONS: QuickAction[]`

- [ ] **Step 1: Create `dashboard/src/lib/mock.ts`**

```ts
import type { AlertLevel } from './types';

export interface TrendSeries {
	labels: string[];
	values: number[];
}

export interface PeakTiles {
	peakSalinity: { value: number; unit: string };
	peakDay: { label: string; sub: string };
	topRiskStation: { name: string; sub: string };
}

export interface AlertFeedItem {
	id: string;
	station: string;
	level: AlertLevel;
	message: string;
	ago: string;
}

export interface QuickAction {
	id: string;
	label: string;
}

// Mock: replace with GET /api/history when available.
export const MOCK_TREND: TrendSeries = {
	labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
	values: [0.6, 0.9, 1.4, 2.1, 3.2, 2.6, 1.8],
};

export const MOCK_PEAKS: PeakTiles = {
	peakSalinity: { value: 5.2, unit: 'g/L' },
	peakDay: { label: 'Thứ 6', sub: '26/06/2026' },
	topRiskStation: { name: 'Cửa sông Lạch Tray', sub: 'Dự báo 5.0 g/L' },
};

// Mock: replace with GET /api/alerts when available.
export const MOCK_ALERT_FEED: AlertFeedItem[] = [
	{ id: 'a1', station: 'Lạch Tray', level: 'red', message: 'Vượt 4 g/L — đóng cống', ago: '5 phút' },
	{ id: 'a2', station: 'Bạch Đằng', level: 'yellow', message: 'Tăng dần — chuẩn bị', ago: '22 phút' },
	{ id: 'a3', station: 'Văn Úc', level: 'green', message: 'An toàn', ago: '1 giờ' },
];

export const QUICK_ACTIONS: QuickAction[] = [
	{ id: 'q1', label: 'Bản đồ trạm' },
	{ id: 'q2', label: 'Lịch sử cảnh báo' },
	{ id: 'q3', label: 'Xuất báo cáo' },
	{ id: 'q4', label: 'Thêm trạm' },
];
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --dir dashboard check`
Expected: no errors in `mock.ts`.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/mock.ts
git commit -m "feat(dashboard): add mock data for endpoint-less widgets"
```

---

### Task 5: Tailwind theme tokens + page load function

**Files:**
- Modify: `dashboard/src/routes/layout.css` (theme tokens — verify filename; create `app.css` import if absent)
- Create: `dashboard/src/routes/+page.server.ts`

**Interfaces:**
- Consumes: `getStations`, `getLatest`, `ApiError` from `$lib/api`; `toStationViews`, `summarize` from `$lib/derive`.
- Produces: page `data` of shape `{ views: StationView[]; summary: DashboardSummary; error: string | null }`.

- [ ] **Step 1: Add theme tokens to `dashboard/src/routes/layout.css`**

Append (Tailwind v4 `@theme`):

```css
@theme {
	--color-cream: #fbf9f4;
	--color-card: #ffffff;
	--color-accent: #f59e0b;
	--color-accent-soft: #fde9c8;
}
```

- [ ] **Step 2: Create `dashboard/src/routes/+page.server.ts`**

```ts
import type { PageServerLoad } from './$types';
import { getStations, getLatest, ApiError } from '$lib/api';
import { toStationViews, summarize } from '$lib/derive';
import type { LatestReading } from '$lib/types';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'max-age=60' });
	try {
		const stations = await getStations(fetch);
		const settled = await Promise.allSettled(
			stations.map((s) => getLatest(fetch, s.station_id))
		);
		const readings = settled
			.filter((r): r is PromiseFulfilledResult<LatestReading> => r.status === 'fulfilled')
			.map((r) => r.value);

		const views = toStationViews(stations, readings);
		return { views, summary: summarize(views), error: null };
	} catch (err) {
		const message = err instanceof ApiError ? err.message : 'Unknown error loading dashboard';
		return { views: [], summary: summarize([]), error: message };
	}
};
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --dir dashboard check`
Expected: no errors. (`./$types` resolves after `svelte-kit sync`, which `check` runs.)

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/routes/layout.css dashboard/src/routes/+page.server.ts
git commit -m "feat(dashboard): add theme tokens and dashboard load function"
```

---

### Task 6: Sidebar component

**Files:**
- Create: `dashboard/src/lib/components/sidebar.svelte`

**Interfaces:**
- Produces: `<Sidebar />` — no required props; internal nav list constant.

- [ ] **Step 1: Create `dashboard/src/lib/components/sidebar.svelte`**

```svelte
<script lang="ts">
	const NAV_ITEMS = [
		{ label: 'Tổng quan', active: true },
		{ label: 'Trạm đo', active: false },
		{ label: 'Bản đồ', active: false },
		{ label: 'Cảnh báo', active: false },
		{ label: 'Lịch sử', active: false },
		{ label: 'Báo cáo', active: false },
		{ label: 'Xuất dữ liệu', active: false },
	];
</script>

<aside class="flex h-full w-64 flex-col gap-6 bg-card p-6">
	<div class="flex items-center gap-2">
		<span class="h-7 w-7 rounded-full bg-accent" aria-hidden="true"></span>
		<span class="text-lg font-semibold">ForestGump</span>
	</div>

	<label class="sr-only" for="sidebar-search">Tìm kiếm</label>
	<input
		id="sidebar-search"
		type="search"
		placeholder="Tìm kiếm"
		class="rounded-lg border border-gray-200 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent"
	/>

	<nav aria-label="Điều hướng chính">
		<ul class="flex flex-col gap-1">
			{#each NAV_ITEMS as item (item.label)}
				<li>
					<a
						href="#{item.label}"
						aria-current={item.active ? 'page' : undefined}
						class={item.active
							? 'block rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-accent'
							: 'block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50'}
					>
						{item.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</aside>
```

- [ ] **Step 2: Run svelte-autofixer (MCP) on the file; fix until clean.**

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm --dir dashboard check && pnpm --dir dashboard lint`
Expected: no errors/warnings for `sidebar.svelte`.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/components/sidebar.svelte
git commit -m "feat(dashboard): add sidebar component"
```

---

### Task 7: Stat card + gauge card

**Files:**
- Create: `dashboard/src/lib/components/stat-card.svelte`
- Create: `dashboard/src/lib/components/gauge-card.svelte`

**Interfaces:**
- Produces:
  - `<StatCard title value caption linkLabel />` — props: `title: string; value: string; caption: string; linkLabel: string`.
  - `<GaugeCard title percent linkLabel />` — props: `title: string; percent: number; linkLabel: string`.

- [ ] **Step 1: Create `dashboard/src/lib/components/stat-card.svelte`**

```svelte
<script lang="ts">
	interface Props {
		title: string;
		value: string;
		caption: string;
		linkLabel: string;
	}
	let { title, value, caption, linkLabel }: Props = $props();
</script>

<section class="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
	<h2 class="text-sm font-medium text-gray-500">{title}</h2>
	<p class="text-4xl font-bold">{value}</p>
	<p class="text-sm text-gray-500">{caption}</p>
	<a href="#report" class="mt-auto text-sm font-medium text-accent">{linkLabel} →</a>
</section>
```

- [ ] **Step 2: Create `dashboard/src/lib/components/gauge-card.svelte`**

Semicircular gauge via SVG stroke-dasharray (half-circle, radius 60, circumference of half ≈ 188.5).

```svelte
<script lang="ts">
	interface Props {
		title: string;
		percent: number;
		linkLabel: string;
	}
	let { title, percent, linkLabel }: Props = $props();

	const HALF_CIRC = Math.PI * 60; // ≈ 188.5
	const dash = $derived((Math.max(0, Math.min(100, percent)) / 100) * HALF_CIRC);
</script>

<section class="flex flex-col items-center gap-4 rounded-2xl bg-card p-6 shadow-sm">
	<h2 class="self-start text-sm font-medium text-gray-500">{title}</h2>
	<svg viewBox="0 0 140 80" class="w-40" role="img" aria-label="{title}: {percent}%">
		<path d="M10 70 A60 60 0 0 1 130 70" fill="none" stroke="#fde9c8" stroke-width="12" stroke-linecap="round" />
		<path
			d="M10 70 A60 60 0 0 1 130 70"
			fill="none"
			stroke="#f59e0b"
			stroke-width="12"
			stroke-linecap="round"
			stroke-dasharray="{dash} {HALF_CIRC}"
		/>
		<text x="70" y="68" text-anchor="middle" class="fill-gray-900 text-2xl font-bold">{percent}%</text>
	</svg>
	<a href="#goal" class="text-sm font-medium text-accent">{linkLabel} →</a>
</section>
```

- [ ] **Step 3: Run svelte-autofixer (MCP) on both files; fix until clean.**

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm --dir dashboard check && pnpm --dir dashboard lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/components/stat-card.svelte dashboard/src/lib/components/gauge-card.svelte
git commit -m "feat(dashboard): add stat-card and gauge-card components"
```

---

### Task 8: Station list + station row

**Files:**
- Create: `dashboard/src/lib/components/station-row.svelte`
- Create: `dashboard/src/lib/components/station-list.svelte`

**Interfaces:**
- Consumes: `StationView`, `AlertLevel` from `$lib/types`.
- Produces:
  - `<StationRow view />` — prop `view: StationView`.
  - `<StationList views />` — prop `views: StationView[]`.

- [ ] **Step 1: Create `dashboard/src/lib/components/station-row.svelte`**

```svelte
<script lang="ts">
	import type { StationView, AlertLevel } from '$lib/types';
	interface Props {
		view: StationView;
	}
	let { view }: Props = $props();

	const DOT: Record<AlertLevel, string> = {
		green: 'bg-green-500',
		yellow: 'bg-yellow-500',
		red: 'bg-red-600',
	};
	const dotClass = $derived(view.reading ? DOT[view.reading.alert] : 'bg-gray-300');
	const forecast = $derived(view.reading ? `${view.reading.forecast_24h} g/L` : '—');
</script>

<li class="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-gray-50">
	<span class="h-2.5 w-2.5 rounded-full {dotClass}" aria-hidden="true"></span>
	<div class="flex flex-col">
		<span class="text-sm font-medium">{view.station.name}</span>
		<span class="text-xs text-gray-500">{view.station.station_id}</span>
	</div>
	<span class="ml-auto text-sm text-gray-600">{forecast}</span>
</li>
```

- [ ] **Step 2: Create `dashboard/src/lib/components/station-list.svelte`**

```svelte
<script lang="ts">
	import type { StationView } from '$lib/types';
	import StationRow from './station-row.svelte';
	interface Props {
		views: StationView[];
	}
	let { views }: Props = $props();
</script>

<section class="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
	<header class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">Trạm đo</h2>
		<span class="text-sm text-gray-500">Mới nhất</span>
	</header>
	<ul class="flex flex-col gap-1">
		{#each views as view (view.station.station_id)}
			<StationRow {view} />
		{/each}
	</ul>
	<a href="#stations" class="text-sm font-medium text-accent">Tất cả trạm →</a>
</section>
```

- [ ] **Step 3: Run svelte-autofixer (MCP) on both files; fix until clean.**

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm --dir dashboard check && pnpm --dir dashboard lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/components/station-row.svelte dashboard/src/lib/components/station-list.svelte
git commit -m "feat(dashboard): add station list and row components"
```

---

### Task 9: uPlot trend chart

**Files:**
- Create: `dashboard/src/lib/components/trend-chart.svelte`

**Interfaces:**
- Consumes: `TrendSeries` from `$lib/mock` (shape: `{ labels: string[]; values: number[] }`).
- Produces: `<TrendChart series />` — prop `series: { labels: string[]; values: number[] }`.

- [ ] **Step 1: Create `dashboard/src/lib/components/trend-chart.svelte`**

Uses uPlot; creates on mount, destroys on unmount, resizes via ResizeObserver. No `$effect` writing to state.

```svelte
<script lang="ts">
	import uPlot from 'uplot';
	import 'uplot/dist/uPlot.min.css';

	interface Props {
		series: { labels: string[]; values: number[] };
	}
	let { series }: Props = $props();

	let container: HTMLDivElement;
	let chart: uPlot | undefined;

	$effect(() => {
		const xs = series.labels.map((_, i) => i);
		const data: uPlot.AlignedData = [xs, series.values];
		const opts: uPlot.Options = {
			width: container.clientWidth,
			height: 220,
			scales: { x: { time: false } },
			axes: [
				{ values: (_u, splits) => splits.map((i) => series.labels[i] ?? '') },
				{},
			],
			series: [
				{},
				{ stroke: '#f59e0b', fill: 'rgba(245,158,11,0.15)', width: 2, points: { show: false } },
			],
			legend: { show: false },
		};
		chart = new uPlot(opts, data, container);

		const ro = new ResizeObserver(() => chart?.setSize({ width: container.clientWidth, height: 220 }));
		ro.observe(container);

		return () => {
			ro.disconnect();
			chart?.destroy();
			chart = undefined;
		};
	});
</script>

<section class="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
	<header class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">Xu hướng độ mặn</h2>
		<span class="text-sm text-gray-500">7 ngày</span>
	</header>
	<div bind:this={container} class="w-full"></div>
</section>
```

> Note: `$effect` here runs a DOM side-effect (chart lifecycle) and returns cleanup — it does NOT set
> reactive state, so it complies with the "no `$effect` for derived state" rule.

- [ ] **Step 2: Run svelte-autofixer (MCP); fix until clean.**

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm --dir dashboard check && pnpm --dir dashboard lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/components/trend-chart.svelte
git commit -m "feat(dashboard): add uPlot salinity trend chart"
```

---

### Task 10: Stat tile, alerts feed, top stations, quick actions

**Files:**
- Create: `dashboard/src/lib/components/stat-tile.svelte`
- Create: `dashboard/src/lib/components/alerts-feed.svelte`
- Create: `dashboard/src/lib/components/top-stations.svelte`
- Create: `dashboard/src/lib/components/quick-actions.svelte`

**Interfaces:**
- Consumes: `TopStation` from `$lib/types`; `AlertFeedItem`, `QuickAction` from `$lib/mock`.
- Produces:
  - `<StatTile label value sub />` — props `label: string; value: string; sub: string`.
  - `<AlertsFeed items />` — prop `items: AlertFeedItem[]`.
  - `<TopStations items />` — prop `items: TopStation[]`.
  - `<QuickActions items />` — prop `items: QuickAction[]`.

- [ ] **Step 1: Create `dashboard/src/lib/components/stat-tile.svelte`**

```svelte
<script lang="ts">
	interface Props {
		label: string;
		value: string;
		sub: string;
	}
	let { label, value, sub }: Props = $props();
</script>

<section class="flex flex-col gap-1 rounded-2xl bg-card p-5 shadow-sm">
	<h3 class="text-xs font-medium text-gray-500">{label}</h3>
	<p class="text-2xl font-bold text-accent">{value}</p>
	<p class="text-sm text-gray-500">{sub}</p>
</section>
```

- [ ] **Step 2: Create `dashboard/src/lib/components/alerts-feed.svelte`**

```svelte
<script lang="ts">
	import type { AlertFeedItem } from '$lib/mock';
	import type { AlertLevel } from '$lib/types';
	interface Props {
		items: AlertFeedItem[];
	}
	let { items }: Props = $props();

	const DOT: Record<AlertLevel, string> = {
		green: 'bg-green-500',
		yellow: 'bg-yellow-500',
		red: 'bg-red-600',
	};
	const unread = $derived(items.filter((i) => i.level !== 'green').length);
</script>

<section class="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
	<header>
		<h2 class="text-lg font-semibold">Cảnh báo gần đây</h2>
		<p class="text-sm text-gray-500" aria-live="polite">{unread} cảnh báo cần chú ý</p>
	</header>
	<ul class="flex flex-col gap-3">
		{#each items as item (item.id)}
			<li class="flex items-center gap-3">
				<span class="h-2.5 w-2.5 rounded-full {DOT[item.level]}" aria-hidden="true"></span>
				<div class="flex flex-col">
					<span class="text-sm font-medium">{item.station}</span>
					<span class="text-xs text-gray-500">{item.message}</span>
				</div>
				<span class="ml-auto text-xs text-gray-400">{item.ago}</span>
			</li>
		{/each}
	</ul>
</section>
```

- [ ] **Step 3: Create `dashboard/src/lib/components/top-stations.svelte`**

```svelte
<script lang="ts">
	import type { TopStation } from '$lib/types';
	interface Props {
		items: TopStation[];
	}
	let { items }: Props = $props();

	const max = $derived(items.reduce((m, i) => Math.max(m, i.value), 0) || 1);
</script>

<section class="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
	<h2 class="text-lg font-semibold">Trạm độ mặn cao nhất</h2>
	<ul class="flex flex-col gap-3">
		{#each items as item (item.name)}
			<li class="flex flex-col gap-1">
				<div class="flex justify-between text-sm">
					<span>{item.name}</span>
					<span class="text-gray-500">{item.value} g/L</span>
				</div>
				<div class="h-2 rounded-full bg-accent-soft">
					<div class="h-2 rounded-full bg-accent" style="width: {(item.value / max) * 100}%"></div>
				</div>
			</li>
		{/each}
	</ul>
</section>
```

- [ ] **Step 4: Create `dashboard/src/lib/components/quick-actions.svelte`**

```svelte
<script lang="ts">
	import type { QuickAction } from '$lib/mock';
	interface Props {
		items: QuickAction[];
	}
	let { items }: Props = $props();
</script>

<section class="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm">
	<h2 class="text-lg font-semibold">Thao tác nhanh</h2>
	<div class="flex flex-wrap gap-2">
		{#each items as action (action.id)}
			<a
				href="#{action.id}"
				class="rounded-full border border-accent-soft px-4 py-2 text-sm text-accent hover:bg-accent-soft"
			>
				{action.label}
			</a>
		{/each}
	</div>
</section>
```

- [ ] **Step 5: Run svelte-autofixer (MCP) on all four files; fix until clean.**

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm --dir dashboard check && pnpm --dir dashboard lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/lib/components/stat-tile.svelte dashboard/src/lib/components/alerts-feed.svelte dashboard/src/lib/components/top-stations.svelte dashboard/src/lib/components/quick-actions.svelte
git commit -m "feat(dashboard): add stat-tile, alerts-feed, top-stations, quick-actions"
```

---

### Task 11: Assemble the page grid

**Files:**
- Modify: `dashboard/src/routes/+page.svelte` (replace skeleton)
- Modify: `dashboard/src/routes/+layout.svelte` (set cream background on body wrapper — verify existing content first)

**Interfaces:**
- Consumes: page `data` `{ views, summary, error }`; all components from `$lib/components/*`; `MOCK_TREND`, `MOCK_PEAKS`, `MOCK_ALERT_FEED`, `QUICK_ACTIONS` from `$lib/mock`.

- [ ] **Step 1: Replace `dashboard/src/routes/+page.svelte`**

```svelte
<script lang="ts">
	import type { PageData } from './$types';
	import Sidebar from '$lib/components/sidebar.svelte';
	import StatCard from '$lib/components/stat-card.svelte';
	import GaugeCard from '$lib/components/gauge-card.svelte';
	import StationList from '$lib/components/station-list.svelte';
	import TrendChart from '$lib/components/trend-chart.svelte';
	import StatTile from '$lib/components/stat-tile.svelte';
	import AlertsFeed from '$lib/components/alerts-feed.svelte';
	import TopStations from '$lib/components/top-stations.svelte';
	import QuickActions from '$lib/components/quick-actions.svelte';
	import { MOCK_TREND, MOCK_PEAKS, MOCK_ALERT_FEED, QUICK_ACTIONS } from '$lib/mock';

	let { data }: { data: PageData } = $props();
	const s = $derived(data.summary);
</script>

<div class="flex min-h-screen bg-cream">
	<Sidebar />

	<main class="flex-1 p-6">
		{#if data.error}
			<p class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
				Không tải được dữ liệu: {data.error}
			</p>
		{/if}

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			<StatCard
				title="Trạm an toàn"
				value="{s.safePct}%"
				caption="{s.greenCount}/{s.total} trạm ở mức xanh"
				linkLabel="Xem báo cáo"
			/>
			<StatCard
				title="Trạm rủi ro"
				value="{s.atRiskCount}"
				caption="Đang ở mức vàng hoặc đỏ"
				linkLabel="Xem cảnh báo"
			/>
			<GaugeCard title="Sức khỏe hệ thống" percent={s.healthPct} linkLabel="Chi tiết" />

			<div class="lg:col-span-1"><StationList views={data.views} /></div>
			<div class="lg:col-span-2"><TrendChart series={MOCK_TREND} /></div>

			<StatTile label="Độ mặn đỉnh" value="{MOCK_PEAKS.peakSalinity.value} {MOCK_PEAKS.peakSalinity.unit}" sub="7 ngày qua" />
			<StatTile label="Ngày cao nhất" value={MOCK_PEAKS.peakDay.label} sub={MOCK_PEAKS.peakDay.sub} />
			<StatTile label="Trạm rủi ro nhất" value={MOCK_PEAKS.topRiskStation.name} sub={MOCK_PEAKS.topRiskStation.sub} />

			<AlertsFeed items={MOCK_ALERT_FEED} />
			<TopStations items={s.topStations} />
			<QuickActions items={QUICK_ACTIONS} />
		</div>
	</main>
</div>
```

- [ ] **Step 2: Run svelte-autofixer (MCP) on `+page.svelte`; fix until clean.**

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm --dir dashboard check && pnpm --dir dashboard lint`
Expected: clean.

- [ ] **Step 4: Run unit tests still pass**

Run: `pnpm --dir dashboard test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/routes/+page.svelte dashboard/src/routes/+layout.svelte
git commit -m "feat(dashboard): assemble overview page grid"
```

---

### Task 12: Visual verification loop

**Files:**
- Create: `design-review/` screenshots (not committed unless useful)

**Interfaces:** none (verification only).

- [ ] **Step 1: Start dev server**

Run: `pnpm --dir dashboard dev` (background). Note the localhost URL.

> Backend must be running for real data; if not, the page renders the error banner + mock widgets — that
> still validates layout. Optionally start backend: `pnpm --dir backend dev`.

- [ ] **Step 2: Screenshot desktop + mobile**

Capture `http://localhost:5173/` at 1440px and 390px into `design-review/dashboard-desktop-v1.png` and `design-review/dashboard-mobile-v1.png` (chromium-cli or Playwright per web-ui-loop).

- [ ] **Step 3: Compare against reference image; list concrete diffs**

Write measured differences (accent hex, card radius, spacing, grid proportions, gauge shape). Focus on layout fidelity (cream bg, white rounded cards, 3-col top row, customers+growth middle row, tiles+feed+bars bottom).

- [ ] **Step 4: Fix diffs one at a time, re-screenshot (bump version), re-compare.**

Repeat until layout matches reference as closely as technically possible. State remaining gaps and why.

- [ ] **Step 5: Final lint + check + test gate**

Run: `pnpm --dir dashboard lint && pnpm --dir dashboard check && pnpm --dir dashboard test`
Expected: all clean/PASS.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "style(dashboard): match reference layout after visual review"
```

---

## Self-Review

**Spec coverage:**
- Widget mapping (spec §3) → Tasks 6–11 cover every row. ✓
- Component split (spec §4) → Tasks 6–11 create every listed component; `dashboard-grid` resolved as direct composition in `+page.svelte` (Task 11), per spec's stated default. ✓
- Shared lib `api.ts`/`types.ts`/`derive.ts`/`mock.ts` (spec §4) → Tasks 2, 3, 4. ✓
- Data contract (spec §5) → Task 2 types match `backend/src/api.ts` field names. ✓
- Data flow (spec §6) → Task 5 load + Task 11 composition + Task 4 mock parity. ✓
- Error handling (spec §7) → Task 5 try/catch + missing-env path; Task 11 error banner. ✓
- Testing/verification (spec §8) → Task 3 unit tests, autofixer steps throughout, Task 12 visual loop. ✓
- Constraints (spec §9) → Global Constraints section; runes-only noted; clsx rule applies if any class >100 chars. ✓

**Placeholder scan:** No TBD/TODO; all code steps contain full code. ✓

**Type consistency:** `StationView`, `DashboardSummary`, `TopStation`, `AlertLevel`, `AlertFeedItem`, `QuickAction`, `TrendSeries` used consistently across tasks; `getStations(fetchFn)`/`getLatest(fetchFn, id)` signatures match between Task 2 and Task 5. ✓
