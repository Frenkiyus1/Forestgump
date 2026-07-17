// Shared design tokens — single source of truth for the whole app.
// Change a surface here and every page updates.
// NOTE: keep these as full literal class strings so Tailwind's scanner picks
// up the arbitrary `shadow-[...]` utilities.

/** Base surface used for every card across the app. */
export const CARD =
	'rounded-3xl border border-black/[0.04] bg-white shadow-[0_1px_2px_rgba(31,25,16,0.04),0_18px_40px_-24px_rgba(31,25,16,0.22)]';

/** Card that lifts on hover (clickable cards, KPI tiles). */
export const CARD_INTERACTIVE =
	'rounded-3xl border border-black/[0.04] bg-white shadow-[0_1px_2px_rgba(31,25,16,0.04),0_18px_40px_-24px_rgba(31,25,16,0.22)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(31,25,16,0.05),0_28px_56px_-28px_rgba(31,25,16,0.3)]';
