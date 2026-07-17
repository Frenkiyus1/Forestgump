# SaliGuard Dashboard — Component Clone Design

**Date:** 2026-06-27
**Block:** `/dashboard` (SvelteKit, Svelte 5, Tailwind v4)
**Goal:** Reproduce the reference admin-dashboard layout (the "OrangeFarm" CRM mockup) as the SaliGuard
overview page, decomposed into fine-grained reusable Svelte 5 components, rebranded to the
salinity-warning domain, wired to the real backend API where endpoints exist.

## 1. Scope

- Build the overview page at `dashboard/src/routes/+page.svelte`.
- Clone the reference **layout and visual style** (cream background, white rounded cards, soft shadows,
  orange accent), not its CRM content.
- Rebrand every widget to SaliGuard domain (stations, salinity, alerts, forecasts).
- Split into fine-grained, props-driven components under `dashboard/src/lib/components/`.
- Wire stations + latest readings to the real backend. Mock the rest behind the same prop interface.

**Out of scope (later work):** station detail page, alerts history page, polling/auto-refresh,
new backend endpoints (`/api/history`, `/api/alerts`), authentication, the sidebar search function.

## 2. Visual direction (decisions locked)

- **Accent:** warm orange (faithful to reference). Cream page background, white rounded cards.
- **Alert dots/badges:** always green / yellow / red per the SaliGuard threshold table — independent of
  the orange accent.
- **Chart:** uPlot (CLAUDE.md mandate). `uplot` to be added to `dashboard` deps.

## 3. Widget → SaliGuard mapping

| Reference widget         | SaliGuard widget                                   | Data source                          |
|--------------------------|----------------------------------------------------|--------------------------------------|
| Sidebar (OrangeFarm)     | Sidebar (SaliGuard): Dashboard, Stations, Map, Alerts, History, Reports, Export | static |
| Revenues 15%             | **Stations safe %** (green / total)                | real — derived from latest readings  |
| Lost deals 4%            | **Stations at risk** (yellow + red count)          | real — derived from latest readings  |
| Quarter goal 84% gauge   | **System health gauge** (% stations green)         | real — derived from latest readings  |
| Customers list           | **Stations list** (name, river mouth, alert dot)   | real — `/api/stations` + `/api/latest` |
| Growth area chart        | **Salinity trend chart**                           | mock — no `/api/history` yet          |
| Top month/year/buyer     | **Peak salinity / Peak day / Highest-risk station**| mock                                  |
| Chats widget             | **Recent alerts feed**                             | mock — no `/api/alerts` yet           |
| Top states bars          | **Top stations by forecast salinity**              | real — derived from latest readings   |
| New deals tags           | **Quick actions** (latest alerts / nav shortcuts)  | static                                |

## 4. Component breakdown

All under `dashboard/src/lib/components/` (kebab-case files, Svelte 5 runes, props-driven, Tailwind):

- `sidebar.svelte` — logo, search box (visual only), nav list, user/profile footer.
- `stat-card.svelte` — big-number card (percent + caption + footer link). Used for "safe %" and "at risk".
- `gauge-card.svelte` — semicircular gauge with center percent. Used for "system health".
- `station-list.svelte` — card wrapper + header (title, sort control visual) + list of rows.
- `station-row.svelte` — one station: avatar/marker, name, river mouth, alert dot, hover actions.
- `trend-chart.svelte` — uPlot wrapper. Receives `{ series, labels }` via `$props()`, creates chart on
  mount, **destroys on unmount**, handles resize.
- `stat-tile.svelte` — small labelled tile (label, big value, sub-line). Used for the 3 peak tiles.
- `alerts-feed.svelte` — "Recent alerts" card with avatars/rows + unread count.
- `top-stations.svelte` — horizontal bar list (station name + value bar), like "Top states".
- `quick-actions.svelte` — tag/pill grid of shortcuts (like "New deals").
- `dashboard-grid.svelte` — owns the responsive CSS grid that places the cards; receives the widgets as
  snippets or composes them directly. (Decide during implementation: snippet slots vs direct composition;
  default to direct composition in `+page.svelte` if grid stays simple.)

### Shared lib

- `lib/api.ts` — ALL REST calls. `getStations()`, `getLatest(stationId)`; reads `PUBLIC_API_URL`.
- `lib/types.ts` — `Station`, `LatestReading` (must match `backend/src/api.ts` exactly) + derived view
  types: `StationView` (station + reading + alert), `DashboardSummary` (safePct, atRisk, healthPct,
  topStations).
- `lib/derive.ts` — pure functions turning `Station[] + LatestReading[]` into the view models above.
  Keeps components dumb and lets logic be unit-reasoned in isolation.

## 5. Data contract (must match backend exactly)

```ts
type Station = { station_id: string; name: string; lat: number; lon: number };
type AlertLevel = 'green' | 'yellow' | 'red';
type LatestReading = {
  station_id: string;
  temp: number; ec: number; level: number;
  forecast_24h: number;
  alert: AlertLevel;
  updated_at: string;
};
```

Field names stay snake_case on the wire (frontend reuses backend `alert`, never recomputes thresholds).

## 6. Data flow

1. `dashboard/src/routes/+page.server.ts` — `export const prerender = false`; `load()` calls
   `api.ts` to fetch `/api/stations`, then `/api/latest?station=` for each station (parallel).
   Sets a short `Cache-Control` via `setHeaders`. Returns `{ stations, readings }`.
2. `+page.svelte` — receives `data`, computes view models with `lib/derive.ts` (via `$derived`).
3. View models passed as `$props()` to the components.
4. Mock widgets (trend, tiles, alerts-feed, quick-actions) get mock data from a `lib/mock.ts` module,
   shaped to the SAME prop interface a future real endpoint would satisfy — so wiring later is a
   data-source swap only, no component change.

## 7. Error handling

- `api.ts` throws typed errors on non-2xx; `load()` catches and returns an `error` field so the page can
  render a degraded state (cards show "—" / "unavailable") instead of crashing.
- Missing `PUBLIC_API_URL` → `load()` returns the error state; no hardcoded URL fallback.

## 8. Testing / verification

- `pnpm --dir dashboard lint` clean (prettier + eslint).
- `pnpm --dir dashboard check` clean (svelte-check).
- Svelte MCP `svelte-autofixer` run on each new `.svelte` file until no issues.
- Run `vite dev`, screenshot at 1440px and 390px into `design-review/`, compare against the reference
  image; iterate per the web-ui-loop until layout matches.

## 9. Constraints / conventions (from CLAUDE.md)

- Svelte 5 runes only (`$state`, `$derived`, `$props`); no `$effect` for derived state.
- kebab-case files, camelCase vars, SCREAMING_SNAKE_CASE consts.
- No hardcoded URLs/secrets — `PUBLIC_API_URL` via env.
- `clsx` for any `class` string over 100 chars.
- Conventional Commits; run `pnpm lint` before any commit.
