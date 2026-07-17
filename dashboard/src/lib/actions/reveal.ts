import { prefersReducedMotion } from '$lib/motion';
import type { Action } from 'svelte/action';

interface RevealParams {
	delay?: number;
}

export const reveal: Action<HTMLElement, RevealParams | undefined> = (node, params) => {
	if (prefersReducedMotion()) return {};

	const delay = params?.delay ?? 0;

	node.style.opacity = '0';
	node.style.transform = 'translateY(28px)';

	function show() {
		const t = `opacity 0.9s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.9s cubic-bezier(0.22,1,0.36,1) ${delay}ms`;
		node.style.transition = t;
		node.style.opacity = '1';
		node.style.transform = 'translateY(0)';
	}

	let obs: IntersectionObserver | null = null;

	// rAF ensures the initial opacity:0 is painted before we start observing,
	// preventing the IntersectionObserver from firing synchronously and
	// skipping the animation on already-visible elements.
	requestAnimationFrame(() => {
		obs = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					show();
					obs?.disconnect();
					obs = null;
				}
			},
			{ threshold: 0.05, rootMargin: '0px 0px -16px 0px' }
		);
		obs.observe(node);
	});

	return {
		destroy() {
			obs?.disconnect();
		}
	};
};
