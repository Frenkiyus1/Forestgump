# SaliGuard - AI-Powered Salinity Intrusion Early Warning System
**Project Context & Instructions for AI Assistant**

## 1. Project Overview
SaliGuard is an IoT-based early warning system for saltwater intrusion (24h - 72h ahead), aimed at farmers in coastal areas (Hai Phong, Vietnam).
The system uses field sensors to collect hydrological data, processes it through an AI model on the server to produce forecasts, and displays warnings on a web Dashboard.

## 2. Monorepo Architecture & Tech Stack
The project is organized as a Monorepo, consisting of 4 main blocks:

- **/firmware**: Code flashed onto the edge device.
  - *Tech:* ESP32, C/C++, PlatformIO, PubSubClient library (MQTT), ArduinoJson.
  - *Role:* Read sensors (EC, Temperature, Water level), send JSON over the 4G network (MQTT over TLS).

- **/backend**: Data ingestion and flow management service (Ingestion Service).
  - *Tech:* Node.js, TypeScript, Express.js, the `mqtt` and `pg` libraries.
  - *Role:* Subscribe to the MQTT Broker, store data in the Database, call the AI Engine to get forecasts, and provide a REST API for the Dashboard.

- **/ai_engine**: Computation and forecasting service.
  - *Tech:* Python 3, FastAPI, XGBoost, Pandas, Numpy.
  - *Role:* Run the trained XGBoost model, receive input from the Backend via HTTP POST and return salinity forecasts for the next 24h and 48h.

- **/dashboard**: Web user interface.
  - *Tech:* SvelteKit (Svelte 5), TypeScript, TailwindCSS, uPlot (charts).
  - *Role:* Call the REST API from the Backend, display the map, historical charts and alert cards (Green/Yellow/Red). Deployed on Cloudflare Pages.

- **Database / Infrastructure:** - PostgreSQL + TimescaleDB (uses only a single `telemetry` table as a hypertable).
  - Mosquitto MQTT Broker.

## 3. Data Flow
1. `ESP32` publishes a JSON string to the topic `waterqa/<station_id>/telemetry`.
2. `Backend (Node.js)` receives the message and inserts it directly into the `telemetry` table in PostgreSQL.
3. `Backend (Node.js)` sends a POST request carrying {temp, ec, level} to the `AI Engine (Python/FastAPI)` on port 8000.
4. `AI Engine` uses the XGBoost model to compute and returns JSON `{"forecast_24h": value}`.
5. `Backend` receives the result; if it exceeds 4 g/L (red level) it triggers an alert, and also updates the data to serve the API.
6. `Dashboard (Svelte 5)` calls the REST API to render the UI.

## 4. Coding Conventions & AI Guidelines
When helping write code for this project, the AI must strictly follow these rules:

- **TypeScript / JavaScript:** Use ES6+ syntax, prefer `async/await` over `.then()`. Always declare clear types/interfaces for data payloads.
- **Svelte 5:** You MUST use Runes syntax (`$state`, `$derived`, `$effect`) for the reactivity system; do not use the old Svelte 4 syntax. Splitting into independent Components is encouraged.
- **Python:** Write clean code with full type hinting (e.g. `def predict(data: dict) -> dict:`).
- **Security:** Never hardcode passwords, tokens, or URLs. You must use `process.env` (Node.js) or `os.getenv` (Python) to read configuration from the `.env` file.
- **Formatting:** Always format responses clearly; when creating a new file you must specify the exact relative path (e.g. `backend/src/db.ts`).
- **Context Awareness:** Automatically identify which block the file you are working on belongs to (firmware, backend, ai, or dashboard) in order to use the correct language and libraries.

Here are several guidelines you must always follow:

- Follow https://svelte.dev/llms.txt when writing Svelte code.
  - Do not update states using `$effect`. If a variable depends on states, use `$derived` instead.
- You must always use Svelte 5 syntax and Tailwind utility classes whenever possible.
- You must use kebab-case rather than camelCase or snake_case for file names.
- You must use camelCase for variables and SCREAMING_SNAKE_CASE for constants.
- Use Zod to validate inputs passed to remote functions. Instructions are provided at https://zod.dev/llms.txt.
  - Prefer `z.strictObject` over `z.object` when possible.
- Use `form` remote functions instead of form actions when adding a form. Look into https://svelte.dev/docs/kit/llms.txt to understand what a remote function is. Do not use `onsubmit` for form submissions. Client-side preflight schema and server-side remote function schema must be the same Zod schema. Export it from a shared file (e.g. `./schema.ts`) as `.remote.ts` files cannot export Zod schemas.
- Use `prerender` remote functions to fetch data that only needs to be updated once per deployment.
- Use `load` functions rather than `query` remote functions to fetch dynamic data. Add `Cache-Control` header via `setHeaders` appropriately. Since the website is static by default, add `export const prerender = false` (or `export const prerender = "auto"` if page can be prerendered) to `+page.server.ts` to allow fetching dynamic data.
- If any `class` property is too long (i.e. over 100 characters), you must divide it into multiple lines using the `clsx` utility imported using `import { clsx } from "$lib/clsx"`. Keep the lines balanced in length.
- You must write Drizzle code following instructions provided at https://orm.drizzle.team/llms.txt.
  - Table names and column names must use the camelCase convention in TypeScript and snake_case in Postgres.
  - Use the Postgres schema `cncSchema` when writing a Drizzle schema.

## 5. Frontend (Dashboard) — Details for the `/dashboard` block

> This section is supplementary and specific to the `/dashboard` block. The Svelte 5 rules,
> naming, `clsx`, Zod, `form`/`load`/`prerender` functions, `pnpm lint`, Conventional Commits and
> MCP tools are already covered in **Section 4** and the "Available MCP Tools" part below — they are
> NOT repeated here; this section only records the dashboard-specific details.

### 5.1. Architectural principles
- The Dashboard does **NOT** connect directly to the Database. It only calls the Backend's **REST API** over HTTPS.
- Centralize **all API calls into a single file** `src/lib/api.ts` to make it easy to change the address and handle errors in one place.

### 5.2. Data contract with the Backend (MUST match exactly)
Field names on the frontend must match `backend/src/api.ts` exactly:
```ts
// GET /api/stations
type Station = { station_id: string; name: string; lat: number; lon: number };

// GET /api/latest?station=ID
type LatestReading = {
  station_id: string;
  temp: number;          // °C
  ec: number;            // salinity (g/L)
  level: number;         // water level (m)
  forecast_24h: number;  // 24h forecast (g/L)
  alert: "green" | "yellow" | "red";  // computed by the backend → the frontend REUSES it, does not recompute
  updated_at: string;    // ISO timestamp
};
```
- `alert` is computed by the backend using the 1 & 4 g/L thresholds. The API currently returns **mock data** — build the UI first.
- Error handling: `400` (missing `station`), `404` (station not found).
- Endpoints **to come**: `GET /api/history?station=ID&from=&to=` (charts), `GET /api/alerts` (alert history).

### 5.3. Configuration & security
- The backend address is read from the env var `PUBLIC_API_URL` (do not hardcode — see **Security, Section 4**).
- **CORS:** the dashboard (Cloudflare) is on a different domain from the API (VPS) → the backend must allow the dashboard's domain.
- Both sides use HTTPS.

### 5.4. Suggested folder structure
```
dashboard/src/
├── routes/
│   ├── +page.svelte / +page.server.ts   # Overview: grid of station cards (load /api/stations + /api/latest)
│   ├── station/[id]/+page.svelte        # Single station detail (chart)
│   └── alerts/+page.svelte              # Alert history
└── lib/
    ├── api.ts            # ALL REST API calls go here
    ├── types.ts          # Station, LatestReading...
    ├── chart.svelte      # uPlot chart component
    └── station-card.svelte
```

### 5.5. Display & charts
- **Real-time = polling** (re-call the API every few minutes); a WebSocket is NOT needed. Clean up
  `setInterval` when leaving the page; do not update `$state` incorrectly inside `$effect` — use `$derived`.
- **uPlot**: wrap it in a `chart.svelte` component, receive data via `$props()`, **destroy** the chart on
  unmount, and handle resize.

### 5.6. Alert colors (mapped from the `alert` field)
| `alert` | Salinity | Tailwind class | Meaning |
|---------|----------|----------------|---------|
| `green`  | < 1 g/L  | `bg-green-500`  | Safe — normal irrigation |
| `yellow` | 1–4 g/L  | `bg-yellow-500` | Caution — prepare to close gates |
| `red`    | > 4 g/L  | `bg-red-600`    | Danger — close gates immediately |

### 5.7. Cloudflare Pages deployment
- Use `adapter-cloudflare`; dynamic pages must set `export const prerender = false` (see **Section 4**).
- Build with `npm run build`; declare the `PUBLIC_API_URL` env var on Cloudflare. Pushing code → auto build & deploy.


## Available MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

- When making a Git commit, follow the Conventional Commits specification for commit messages.
- Always run `pnpm lint` before committing. Fix all issues until `pnpm lint` no longer returns warnings or errors.

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:
