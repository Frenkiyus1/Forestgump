import { browser } from '$app/environment';

/** True when the user has requested reduced motion. SSR-safe (false on server). */
export function prefersReducedMotion(): boolean {
	return browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
