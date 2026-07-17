<script lang="ts">
	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import logo from '$lib/assets/logo.png';
	import { sendChatMessage, ApiError, type ChatTurn } from '$lib/api';
	import { renderMarkdown } from '$lib/markdown';

	type ChatMessage = { id: number; role: 'user' | 'bot'; text: string };

	const WELCOME: ChatMessage = {
		id: 0,
		role: 'bot',
		text: 'Xin chào! Tôi là trợ lý SaliGuard.'
	};

	let open = $state(false);
	let draft = $state('');
	let messages = $state<ChatMessage[]>([WELCOME]);
	let nextId = $state(1);
	let inputEl = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLDivElement | null>(null);
	let sending = $state(false);
	// Id của tin bot đang hiện dần (typewriter); trong lúc đó show text thô, xong mới render markdown.
	let revealingId = $state<number | null>(null);

	const canSend = $derived(draft.trim().length > 0 && !sending);

	// Dọn timer khi rời trang.
	let timers: ReturnType<typeof setInterval>[] = [];
	onDestroy(() => {
		for (const t of timers) clearInterval(t);
	});

	function prefersReduce(): boolean {
		return (
			typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
		);
	}

	function toggle() {
		open = !open;
	}

	function scrollToEnd() {
		// Defer until the DOM has the new message rendered.
		queueMicrotask(() => listEl?.scrollTo({ top: listEl.scrollHeight }));
	}

	// Hiện câu trả lời của bot dần từng ký tự. Tôn trọng reduced-motion.
	function streamBotReply(text: string) {
		const id = nextId++;
		if (prefersReduce()) {
			messages = [...messages, { id, role: 'bot', text }];
			scrollToEnd();
			return;
		}
		messages = [...messages, { id, role: 'bot', text: '' }];
		revealingId = id;
		let i = 0;
		const timer = setInterval(() => {
			i += 1;
			messages = messages.map((m) => (m.id === id ? { ...m, text: text.slice(0, i) } : m));
			scrollToEnd();
			if (i >= text.length) {
				clearInterval(timer);
				timers = timers.filter((t) => t !== timer);
				revealingId = null;
			}
		}, 16);
		timers = [...timers, timer];
	}

	async function send() {
		const text = draft.trim();
		if (!text || sending) return;

		messages = [...messages, { id: nextId++, role: 'user', text }];
		draft = '';
		sending = true;
		scrollToEnd();

		try {
			const turns: ChatTurn[] = messages
				.filter((m) => m.id !== 0)
				.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
			while (turns.length > 0 && turns[0]?.role !== 'user') turns.shift();
			const { reply } = await sendChatMessage(fetch, turns.slice(-40));
			sending = false;
			streamBotReply(reply);
		} catch (err) {
			const errText =
				err instanceof ApiError && err.status === 503
					? 'Chatbot chưa được cấu hình. Vui lòng thử lại sau.'
					: 'Xin lỗi, hiện chưa trả lời được. Vui lòng thử lại.';
			sending = false;
			streamBotReply(errText);
		}
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			send();
		} else if (event.key === 'Escape') {
			open = false;
		}
	}
</script>

<div class="fixed right-6 bottom-6 z-50 flex flex-col items-end gap-3">
	{#if open}
		<section
			class="flex h-[26rem] max-h-[70vh] w-80 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-card shadow-lg"
			aria-label="Trợ lý SaliGuard"
		>
			<header class="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
				<img src={logo} alt="" class="h-8 w-8 shrink-0 rounded-full object-cover" />
				<div class="min-w-0">
					<p class="text-sm font-semibold">Trợ lý SaliGuard</p>
					<p class="text-xs text-gray-500">Hỏi đáp về độ mặn</p>
				</div>
				<button
					type="button"
					onclick={toggle}
					aria-label="Đóng cửa sổ chat"
					class="ml-auto rounded-lg p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-accent"
				>
					<svg
						viewBox="0 0 24 24"
						class="h-5 w-5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path d="m6 6 12 12M18 6 6 18" stroke-linecap="round" />
					</svg>
				</button>
			</header>

			<div
				bind:this={listEl}
				class="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
				aria-live="polite"
			>
				{#each messages as message (message.id)}
					{#if message.role === 'user'}
						<div class="flex justify-end">
							<p
								class="max-w-[80%] rounded-2xl rounded-br-sm bg-accent px-3 py-2 text-sm whitespace-pre-wrap text-white"
							>
								{message.text}
							</p>
						</div>
					{:else}
						<div class="flex items-end justify-start gap-2">
							<img src={logo} alt="" class="h-6 w-6 shrink-0 rounded-full object-cover" />
							<div
								class="max-w-[80%] rounded-2xl rounded-bl-sm bg-cream px-3 py-2 text-sm leading-relaxed text-gray-700"
							>
								{#if revealingId === message.id}
									<span class="whitespace-pre-wrap">{message.text}</span>
								{:else}
									<!-- renderMarkdown escapes HTML first, output is XSS-safe -->
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html renderMarkdown(message.text)}
								{/if}
							</div>
						</div>
					{/if}
				{/each}

				{#if sending}
					<div class="flex items-end justify-start gap-2" in:fade={{ duration: 150 }}>
						<img src={logo} alt="" class="h-6 w-6 shrink-0 rounded-full object-cover" />
						<div
							class="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-cream px-3 py-3"
							aria-label="Đang soạn tin"
						>
							<span class="dot"></span>
							<span class="dot"></span>
							<span class="dot"></span>
						</div>
					</div>
				{/if}
			</div>

			<form
				class="flex items-center gap-2 border-t border-gray-100 px-3 py-3"
				onsubmit={(event) => {
					event.preventDefault();
					send();
				}}
			>
				<label class="sr-only" for="chat-input">Nhập tin nhắn</label>
				<input
					bind:this={inputEl}
					bind:value={draft}
					onkeydown={onKeydown}
					id="chat-input"
					type="text"
					autocomplete="off"
					placeholder="Nhập câu hỏi…"
					class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent"
				/>
				<button
					type="submit"
					disabled={!canSend}
					aria-label="Gửi tin nhắn"
					class="rounded-lg bg-accent p-2 text-white hover:bg-amber-600 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40"
				>
					<svg
						viewBox="0 0 24 24"
						class="h-5 w-5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			</form>
		</section>
	{/if}

	<button
		type="button"
		onclick={toggle}
		aria-expanded={open}
		aria-label={open ? 'Đóng trợ lý' : 'Mở trợ lý SaliGuard'}
		class="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg transition hover:bg-amber-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
	>
		{#if open}
			<svg
				viewBox="0 0 24 24"
				class="h-6 w-6"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path d="m6 6 12 12M18 6 6 18" stroke-linecap="round" />
			</svg>
		{:else}
			<svg
				viewBox="0 0 24 24"
				class="h-6 w-6"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				aria-hidden="true"
			>
				<path
					d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		{/if}
	</button>
</div>

<style>
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
		background: #9ca3af;
		animation: dot-blink 1.4s infinite both;
	}
	.dot:nth-child(2) {
		animation-delay: 0.2s;
	}
	.dot:nth-child(3) {
		animation-delay: 0.4s;
	}
	@keyframes dot-blink {
		0%,
		80%,
		100% {
			opacity: 0.25;
			transform: translateY(0);
		}
		40% {
			opacity: 1;
			transform: translateY(-3px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.dot {
			animation: none;
		}
	}
</style>
