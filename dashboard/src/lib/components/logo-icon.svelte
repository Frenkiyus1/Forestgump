<script lang="ts">
	interface Props {
		class?: string;
	}
	let { class: className = '' }: Props = $props();
</script>

<!--
  SVG recreation of the SaliGuard circular logo mark.
  Elements: teal circuit ring → blue water-drop gradient → green leaf plant → wave fill.
  Always used alongside "SaliGuard" text, so aria-hidden="true".
-->
<svg viewBox="0 0 56 56" class={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
	<defs>
		<linearGradient id="sg-drop" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="#4ED8F2" />
			<stop offset="100%" stop-color="#1976D2" />
		</linearGradient>
		<linearGradient id="sg-leaf" x1="1" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="#81C784" />
			<stop offset="100%" stop-color="#2E7D32" />
		</linearGradient>
		<clipPath id="sg-drop-clip">
			<path
				d="M28 11C36 17 39 25 39 34C39 42.5 34.5 48 28 48C21.5 48 17 42.5 17 34C17 25 20 17 28 11Z"
			/>
		</clipPath>
	</defs>

	<!-- Outer teal ring -->
	<circle cx="28" cy="28" r="25.5" fill="none" stroke="#26C6DA" stroke-width="1.5" />

	<!-- Circuit node + trace — top -->
	<circle cx="28" cy="2.5" r="1.8" fill="#26C6DA" />
	<line x1="28" y1="4.3" x2="28" y2="10" stroke="#26C6DA" stroke-width="0.9" />

	<!-- Circuit node + trace — right -->
	<circle cx="53.5" cy="28" r="1.8" fill="#26C6DA" />
	<line x1="51.7" y1="28" x2="46" y2="28" stroke="#26C6DA" stroke-width="0.9" />
	<circle cx="46" cy="28" r="1.2" fill="#26C6DA" />

	<!-- Circuit node + trace — left -->
	<circle cx="2.5" cy="28" r="1.8" fill="#26C6DA" />
	<line x1="4.3" y1="28" x2="10" y2="28" stroke="#26C6DA" stroke-width="0.9" />
	<circle cx="10" cy="28" r="1.2" fill="#26C6DA" />

	<!-- Water drop body (pointed top, round bottom) -->
	<path
		d="M28 11C36 17 39 25 39 34C39 42.5 34.5 48 28 48C21.5 48 17 42.5 17 34C17 25 20 17 28 11Z"
		fill="url(#sg-drop)"
	/>

	<!-- Wave fills clipped to drop shape -->
	<g clip-path="url(#sg-drop-clip)">
		<path d="M17 37Q22.5 32 28 37Q33.5 42 39 37L39 48L17 48Z" fill="#1565C0" opacity="0.55" />
		<path d="M17 41Q22.5 37 28 41Q33.5 45 39 41L39 48L17 48Z" fill="#0D47A1" opacity="0.4" />
	</g>

	<!-- Stem -->
	<line
		x1="28"
		y1="43"
		x2="28"
		y2="17"
		stroke="#1B5E20"
		stroke-width="1.5"
		stroke-linecap="round"
	/>

	<!-- Left leaf -->
	<path d="M28 34C25 28 21 21 22 16C23 13 26.5 14.5 28 34Z" fill="url(#sg-leaf)" />

	<!-- Right leaf -->
	<path d="M28 34C31 28 35 21 34 16C33 13 29.5 14.5 28 34Z" fill="url(#sg-leaf)" />
</svg>
