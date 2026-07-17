<script lang="ts">
	import { resolve } from '$app/paths';
	import { fade } from 'svelte/transition';
	import { clsx } from '$lib/clsx';
	import { prefersReducedMotion } from '$lib/motion';
	import { ALERT_LABEL, ALERT_STRIP, ALERT_HEX } from '$lib/alert-ui';
	import type { StationDetail, RiverKey } from '$lib/types';

	interface Props {
		stations: StationDetail[];
		/** Station id highlighted from the sidebar — its marker enlarges + opens. */
		focusId?: string | null;
	}
	let { stations, focusId = null }: Props = $props();

	// ---------------------------------------------------------------------------
	// Cả 3 cửa sông trong nền (Cấm / Lạch Tray / Văn Úc) đều có một HÀNG TRẠM nối
	// tiếp nhau, mỗi trạm gán vào ĐÚNG nhánh sông của nó qua field `station.river`
	// (xem stations-mock.ts). Trong từng nhánh:
	//   - 1 TRẠM TỔNG HỢP (isAggregate) đứng riêng ở mũi cửa sông, ngoài cùng ra
	//     phía biển — đại diện cho cả nhánh, tách khỏi hàng trạm quan trắc.
	//   - 4 trạm quan trắc còn lại nối đuôi nhau NGAY SAU đó: mặn nhất (EC cao)
	//     gần cửa sông, vơi dần ngược lên thượng nguồn.
	//
	// Mỗi nhánh là một polyline lấy CHÍNH XÁC từ đường cong bezier vẽ nhánh sông đó
	// bên dưới rồi quy đổi sang % theo viewBox 1000×780 (nền dùng
	// preserveAspectRatio="none" nên % khớp tuyệt đối với hình sông ở MỌI kích
	// thước khung).
	// ---------------------------------------------------------------------------

	// Mỗi nhánh: polyline theo thứ tự CỬA SÔNG (mặn nhất) → THƯỢNG NGUỒN.
	// Điểm [0] là mũi cửa sông kéo ra sát biển (dùng làm mốc lấy mẫu, KHÔNG phải
	// nơi đặt trạm tổng hợp — điểm đó nằm trên vùng biển, xem AGGREGATE_F).
	const RIVER_LINES: Record<RiverKey, { x: number; y: number }[]> = {
		cam: [
			{ x: 75.1, y: 48.7 },
			{ x: 60.2, y: 41.4 },
			{ x: 49.6, y: 36.6 },
			{ x: 39.5, y: 32.7 },
			{ x: 29.7, y: 29.4 },
			{ x: 20.2, y: 26.8 },
			{ x: 10.6, y: 24.9 },
			{ x: 2.3, y: 23.6 }
		],
		lachtray: [
			{ x: 59.6, y: 70.2 },
			{ x: 51.1, y: 62.3 },
			{ x: 44.6, y: 57.8 },
			{ x: 37.5, y: 53.9 },
			{ x: 29.5, y: 50.8 },
			{ x: 20.8, y: 48.4 },
			{ x: 11.4, y: 46.9 },
			{ x: 2.6, y: 46.2 }
		],
		vanuc: [
			{ x: 51.5, y: 71.8 },
			{ x: 42.8, y: 71.7 },
			{ x: 37.4, y: 71.4 },
			{ x: 31.3, y: 70.9 },
			{ x: 24.6, y: 70.4 },
			{ x: 17.3, y: 69.9 },
			{ x: 9.3, y: 69.5 },
			{ x: 1.9, y: 69.3 }
		]
	};
	const DEFAULT_RIVER: RiverKey = 'lachtray';

	// Điểm trên một polyline tại tỉ lệ chiều dài f (0..1) — y hệt hàm gốc, dùng
	// chung cho cả 3 nhánh.
	function sampleFrac(line: { x: number; y: number }[], f: number) {
		const seg = line
			.slice(0, -1)
			.map((p, i) => Math.hypot(line[i + 1].x - p.x, line[i + 1].y - p.y));
		const total = seg.reduce((a, b) => a + b, 0);
		const target = f * total;
		let acc = 0;
		for (let i = 0; i < seg.length; i++) {
			if (acc + seg[i] >= target || i === seg.length - 1) {
				const t = seg[i] ? (target - acc) / seg[i] : 0;
				const a = line[i],
					b = line[i + 1];
				return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
			}
			acc += seg[i];
		}
		return { x: line[0].x, y: line[0].y };
	}

	// Trạm quan trắc: mặn nhất gần cửa sông trước, vơi dần lên thượng nguồn.
	// F0 nhích vào một chút (không phải 0) để chừa khoảng trống cho trạm tổng
	// hợp đứng riêng ngoài mũi cửa sông, không bị chồng lên nhau.
	const F0 = 0.16,
		F1 = 0.97;

	// Vị trí trạm tổng hợp: toạ độ % CỐ ĐỊNH (không lấy mẫu trên polyline) chọn
	// thủ công cho từng nhánh sao cho (1) luôn rơi vào vùng ĐẤT LIỀN — xác nhận
	// bằng cách dò giao điểm với hình biển vẽ ở nền — và (2) tách hẳn khỏi hàng
	// trạm quan trắc lẫn hai trạm tổng hợp còn lại: Lạch Tray đặt LỆCH LÊN TRÊN
	// (phía bắc) còn Văn Úc đặt LỆCH XUỐNG DƯỚI (phía nam) nhánh sông của chúng —
	// hai cửa sông này ở khá gần nhau nên nếu cùng nằm trên polyline sẽ đè lên
	// nhau (đặc biệt là halo + nhãn "Tổng hợp" khi hover).
	const AGGREGATE_POS: Record<RiverKey, { x: number; y: number }> = {
		cam: { x: 70, y: 26 },
		lachtray: { x: 60, y: 54 },
		vanuc: { x: 40, y: 80 }
	};

	const placed = $derived.by(() => {
		const groups: Record<RiverKey, StationDetail[]> = { cam: [], lachtray: [], vanuc: [] };
		for (const s of stations) {
			groups[s.river ?? DEFAULT_RIVER].push(s);
		}

		const out: { station: StationDetail; x: number; y: number; isAggregate: boolean }[] = [];
		for (const river of Object.keys(groups) as RiverKey[]) {
			const line = RIVER_LINES[river];
			const all = groups[river];
			const aggregates = all.filter((s) => s.isAggregate);
			const monitors = [...all.filter((s) => !s.isAggregate)].sort((a, b) => b.ec - a.ec);

			for (const station of aggregates) {
				const p = AGGREGATE_POS[river];
				out.push({ station, x: p.x, y: p.y, isAggregate: true });
			}
			monitors.forEach((station, i, arr) => {
				const f = arr.length === 1 ? F0 : F0 + (F1 - F0) * (i / (arr.length - 1));
				const p = sampleFrac(line, f);
				out.push({ station, x: p.x, y: p.y, isAggregate: false });
			});
		}
		return out;
	});

	let hovered = $state<string | null>(null);
	const activeId = $derived(hovered ?? focusId);

	// --- Zoom / pan (transform trên lớp bản đồ; marker tự bù tỉ lệ để không phình) ---
	const MIN_SCALE = 1;
	const MAX_SCALE = 10;
	let scale = $state(1);
	let tx = $state(0);
	let ty = $state(0);
	let frameEl = $state<HTMLDivElement | null>(null);
	let dragging = $state(false);
	let moved = false;
	let lastX = 0;
	let lastY = 0;

	const reduced = $derived(prefersReducedMotion());
	const mapFade = $derived({ duration: reduced ? 0 : 400 });

	function clamp(v: number, lo: number, hi: number) {
		return Math.min(hi, Math.max(lo, v));
	}

	function zoomAt(cx: number, cy: number, factor: number) {
		const next = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
		if (next === scale) return;
		// giữ điểm dưới con trỏ cố định khi zoom
		tx = cx - ((cx - tx) / scale) * next;
		ty = cy - ((cy - ty) / scale) * next;
		scale = next;
		clampPan();
	}

	// Không cho kéo lộ ra ngoài khung.
	function clampPan() {
		if (!frameEl) return;
		const w = frameEl.clientWidth;
		const h = frameEl.clientHeight;
		tx = clamp(tx, w - w * scale, 0);
		ty = clamp(ty, h - h * scale, 0);
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		if (!frameEl) return;
		const rect = frameEl.getBoundingClientRect();
		zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
	}

	function onPointerDown(e: PointerEvent) {
		// Nhấn xuống bắt đầu từ marker (thẻ <a>) thì bỏ qua pan: nếu vẫn bắt
		// pointer capture ở đây, capture đó "nuốt" luôn click/navigation của
		// marker (Chromium điều hướng click theo phần tử đang capture, không
		// theo toạ độ chuột) → bấm vào trạm không bao giờ mở được trang chi tiết.
		if ((e.target as HTMLElement).closest('a')) return;
		dragging = true;
		moved = false;
		lastX = e.clientX;
		lastY = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const dx = e.clientX - lastX;
		const dy = e.clientY - lastY;
		if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
		lastX = e.clientX;
		lastY = e.clientY;
		tx += dx;
		ty += dy;
		clampPan();
	}
	function onPointerUp(e: PointerEvent) {
		dragging = false;
		(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
	}

	function zoomButton(factor: number) {
		if (!frameEl) return;
		zoomAt(frameEl.clientWidth / 2, frameEl.clientHeight / 2, factor);
	}
	function reset() {
		scale = 1;
		tx = 0;
		ty = 0;
	}

	// Chặn điều hướng nếu vừa kéo (drag) chứ không phải click.
	function onMarkerClick(e: MouseEvent) {
		if (moved) e.preventDefault();
	}

	const layerTransform = $derived(`translate(${tx}px, ${ty}px) scale(${scale})`);
	const pinInverse = $derived(`scale(${1 / scale})`);
</script>

<div
	class="relative h-full w-full overflow-hidden rounded-3xl bg-[#eef3f7]"
	in:fade={mapFade}
	bind:this={frameEl}
	onwheel={onWheel}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointerleave={onPointerUp}
	role="application"
	aria-label="Bản đồ trạm đo — cuộn để phóng to, kéo để di chuyển"
	style="touch-action: none; cursor: {dragging ? 'grabbing' : 'grab'};"
>
	<!-- Lớp bản đồ (nền + marker) áp transform zoom/pan -->
	<div
		class="absolute inset-0 origin-top-left"
		style="transform: {layerTransform}; will-change: transform;"
	>
		<!-- Nền cửa sông (giữ nguyên bản đồ cũ, palette-matched, không cần tile ngoài).
		     preserveAspectRatio="none" để viewBox 1000×780 map TUYẾN TÍNH sang 0–100%
		     của khung — khớp CHÍNH XÁC với marker đặt bằng left/top %, ở mọi kích thước
		     màn hình (không còn lệch như kiểu "slice" cắt/co theo tỉ lệ khung). -->
		<svg
			viewBox="0 0 1000 780"
			preserveAspectRatio="none"
			class="absolute inset-0 h-full w-full"
			aria-hidden="true"
		>
			<defs>
				<linearGradient id="sea" x1="0" y1="0" x2="1" y2="1">
					<stop offset="0%" stop-color="#cfe3ef" />
					<stop offset="100%" stop-color="#aecbde" />
				</linearGradient>
				<linearGradient id="land" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="#f3f1e7" />
					<stop offset="100%" stop-color="#e8ead9" />
				</linearGradient>
			</defs>

			<rect x="0" y="0" width="1000" height="780" fill="url(#land)" />

			<!-- biển phía đông-nam (vịnh Bắc Bộ) -->
			<path
				d="M1000,780 L1000,140 C880,180 820,300 700,360 C600,410 560,520 470,560 C560,640 760,700 1000,720 Z"
				fill="url(#sea)"
			/>

			<!-- các nhánh sông đổ ra cửa (Cấm / Lạch Tray / Văn Úc) -->
			<g fill="none" stroke="#bcd6e6" stroke-linecap="round">
				<path d="M-20,180 C220,200 420,250 700,360" stroke-width="26" opacity="0.9" />
				<path d="M-20,360 C240,360 430,420 560,520" stroke-width="22" opacity="0.85" />
				<path d="M-20,540 C200,540 360,560 470,560" stroke-width="18" opacity="0.8" />
			</g>

			<g fill="none" stroke="#d8d9c4" stroke-width="2" opacity="0.6">
				<path d="M60,120 C260,150 500,150 760,120" />
				<path d="M40,640 C260,620 520,640 780,660" />
			</g>
		</svg>

		<!-- Markers: trạm quan trắc = giọt nước lộn ngược (map pin, tip chạm đúng
		     điểm trên nhánh sông); trạm tổng hợp (isAggregate) = nút tròn (hub) có
		     TÂM chạm đúng điểm trên nhánh sông — để thẳng hàng tự nhiên với hàng
		     trạm quan trắc phía sau nó trên cùng nhánh thay vì "nổi" lệch khỏi hàng.
		     Cả hai đều bù tỉ lệ (pinInverse) để giữ kích thước khi zoom. Nhãn "Tổng
		     hợp" LUÔN hiện (không chỉ khi hover) để phân biệt với trạm quan trắc. -->
		{#each placed as p (p.station.station_id)}
			{@const active = activeId === p.station.station_id}
			<a
				href={resolve(`/stations/${p.station.station_id}`)}
				onclick={onMarkerClick}
				class={clsx('absolute focus-visible:outline-none', active ? 'z-30' : 'z-10')}
				style="left: {p.x}%; top: {p.y}%; transform: translate(-50%, {p.isAggregate
					? '-50%'
					: '-100%'}) {pinInverse}; transform-origin: 50% {p.isAggregate ? '50%' : '100%'};"
				onmouseenter={() => (hovered = p.station.station_id)}
				onmouseleave={() => (hovered = null)}
				onfocus={() => (hovered = p.station.station_id)}
				onblur={() => (hovered = null)}
				aria-label="{p.station.name} — {p.isAggregate ? 'Trạm tổng hợp — ' : ''}{ALERT_LABEL[
					p.station.alert
				]}, EC {p.station.ec} g/L"
			>
				{#if p.isAggregate}
					<!-- nút tròn (hub) của trạm tổng hợp -->
					<span class="relative block h-12 w-12">
						<span
							class="absolute top-1/2 left-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full opacity-60"
							style="background: {ALERT_HEX[p.station.alert]}"
							aria-hidden="true"
						></span>
						<svg
							viewBox="0 0 40 40"
							class="absolute inset-0 h-full w-full drop-shadow-[0_2px_4px_rgba(31,25,16,0.35)]"
							class:scale-110={active}
							aria-hidden="true"
						>
							<defs>
								<linearGradient id="agg-fill-{p.station.station_id}" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stop-color={ALERT_HEX[p.station.alert]} stop-opacity="0.82" />
									<stop offset="100%" stop-color={ALERT_HEX[p.station.alert]} />
								</linearGradient>
							</defs>
							<circle
								cx="20"
								cy="20"
								r="17"
								fill="url(#agg-fill-{p.station.station_id})"
								stroke="#ffffff"
								stroke-width="2.75"
							/>
							<circle
								cx="20"
								cy="20"
								r="12.5"
								fill="none"
								stroke="#ffffff"
								stroke-width="1.25"
								opacity="0.9"
							/>
							<!-- icon "hub": 1 nút trung tâm nối 3 nút vệ tinh — tượng trưng cho việc gộp
							     nhiều trạm quan trắc thành một giá trị đại diện. -->
							<g stroke="#ffffff" stroke-width="1.3" opacity="0.95">
								<line x1="20" y1="20" x2="20" y2="13.4" />
								<line x1="20" y1="20" x2="25.7" y2="23.5" />
								<line x1="20" y1="20" x2="14.3" y2="23.5" />
							</g>
							<circle cx="20" cy="13.4" r="2.1" fill="#ffffff" />
							<circle cx="25.7" cy="23.5" r="2.1" fill="#ffffff" />
							<circle cx="14.3" cy="23.5" r="2.1" fill="#ffffff" />
							<circle cx="20" cy="20" r="3.2" fill="#ffffff" />
						</svg>

						<span
							class="absolute top-full left-1/2 z-10 mt-1 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-white/95 px-2 py-0.5 text-[9px] font-semibold tracking-wide whitespace-nowrap text-gray-600 uppercase shadow-sm"
							style="border-color: {ALERT_HEX[p.station.alert]}40"
						>
							<span
								class="h-1.5 w-1.5 rounded-full"
								style="background: {ALERT_HEX[p.station.alert]}"
								aria-hidden="true"
							></span>
							Tổng hợp
						</span>
					</span>
				{:else}
					<!-- giọt nước lộn ngược của trạm quan trắc -->
					<span class="relative block h-9 w-6">
						<span
							class="absolute -top-0.5 -left-0.5 h-7 w-7 animate-ping rounded-full opacity-60"
							style="background: {ALERT_HEX[p.station.alert]}"
							aria-hidden="true"
						></span>
						<svg
							viewBox="0 0 24 36"
							class="absolute inset-0 h-full w-full drop-shadow-[0_2px_3px_rgba(31,25,16,0.35)]"
							class:scale-110={active}
							aria-hidden="true"
						>
							<path
								d="M12 0C5.37 0 0 5.37 0 12c0 9 12 24 12 24s12-15 12-24C24 5.37 18.63 0 12 0z"
								fill={ALERT_HEX[p.station.alert]}
								stroke="#ffffff"
								stroke-width="1.5"
							/>
							<circle cx="12" cy="12" r="4.5" fill="#ffffff" />
						</svg>
					</span>
				{/if}

				<!-- popover -->
				{#if active}
					<div
						class={clsx(
							'absolute left-1/2 z-20 -ml-26 w-52 rounded-2xl border border-black/[0.06] bg-white p-3 shadow-[0_12px_30px_-12px_rgba(31,25,16,0.4)]',
							p.y < 50 ? 'top-full mt-2' : 'bottom-full mb-1'
						)}
					>
						<p class="text-sm font-semibold tracking-tight text-gray-900">{p.station.name}</p>
						<p class="text-xs text-gray-500">{p.station.region}</p>
						{#if p.isAggregate}
							<!-- Trạm tổng hợp là số liệu TRUNG BÌNH, không phải cảm biến vật lý —
							     nên popover chỉ hiện dự báo + mức cảnh báo của cả nhánh, KHÔNG hiện
							     độ mặn hiện tại (dễ hiểu nhầm là số đo trực tiếp). -->
							<div class="mt-2 flex items-end justify-between">
								<p class="text-xl font-semibold tracking-tight text-gray-900">
									{p.station.forecast_24h}<span class="ml-0.5 text-xs font-medium text-gray-400"
										>g/L · 24h</span
									>
								</p>
								<span class="flex items-center gap-1.5">
									<span
										class={clsx('h-2.5 w-2.5 rounded-full', ALERT_STRIP[p.station.alert])}
										aria-hidden="true"
									></span>
									<span class="text-xs font-medium text-gray-600"
										>{ALERT_LABEL[p.station.alert]}</span
									>
								</span>
							</div>
							<p class="mt-1 text-xs text-gray-500">
								Dự báo 48h: <span class="font-medium text-gray-700"
									>{p.station.forecast_48h} g/L</span
								>
							</p>
						{:else}
							<div class="mt-2 flex items-end justify-between">
								<p class="text-xl font-semibold tracking-tight text-gray-900">
									{p.station.ec}<span class="ml-0.5 text-xs font-medium text-gray-400">g/L</span>
								</p>
								<span class="flex items-center gap-1.5">
									<span
										class={clsx('h-2.5 w-2.5 rounded-full', ALERT_STRIP[p.station.alert])}
										aria-hidden="true"
									></span>
									<span class="text-xs font-medium text-gray-600"
										>{ALERT_LABEL[p.station.alert]}</span
									>
								</span>
							</div>
							<p class="mt-1 text-xs text-gray-500">
								Dự báo 24h: <span class="font-medium text-gray-700"
									>{p.station.forecast_24h} g/L</span
								>
							</p>
						{/if}
						<p class="mt-2 text-xs font-medium text-accent">Xem chi tiết →</p>
					</div>
				{/if}
			</a>
		{/each}
	</div>

	<!-- Nút zoom -->
	<div class="absolute right-3 bottom-3 z-30 flex flex-col gap-1.5">
		<button
			type="button"
			onclick={() => zoomButton(1.4)}
			aria-label="Phóng to"
			class="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-lg text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-accent"
		>
			+
		</button>
		<button
			type="button"
			onclick={() => zoomButton(1 / 1.4)}
			aria-label="Thu nhỏ"
			class="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-lg text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-accent"
		>
			−
		</button>
		{#if scale > 1}
			<button
				type="button"
				onclick={reset}
				aria-label="Về mặc định"
				class="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-accent"
			>
				<svg
					viewBox="0 0 24 24"
					class="h-4 w-4"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.4 2.6L3 8" stroke-linecap="round" />
					<path d="M3 3v5h5" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
		{/if}
	</div>
</div>
