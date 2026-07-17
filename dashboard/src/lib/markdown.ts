// Renderer markdown tối giản & an toàn cho câu trả lời chatbot.
// Escape HTML TRƯỚC rồi mới áp dụng định dạng -> nội dung từ LLM không thể chèn
// thẻ HTML/script (chống XSS). Chỉ hỗ trợ tập con phổ biến Gemini hay dùng:
// in đậm, in nghiêng, gạch đầu dòng và xuống dòng.

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Định dạng inline trên một dòng đã escape: **đậm**, *nghiêng*. */
function inline(text: string): string {
	return text
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

/** Chuyển markdown -> HTML an toàn để dùng với {@html}. */
export function renderMarkdown(text: string): string {
	const lines = escapeHtml(text).split('\n');
	const out: string[] = [];
	let inList = false;

	const closeList = () => {
		if (inList) {
			out.push('</ul>');
			inList = false;
		}
	};

	for (const line of lines) {
		const bullet = line.match(/^\s*[-*]\s+(.*)$/);
		if (bullet) {
			if (!inList) {
				out.push('<ul class="my-1 list-disc space-y-0.5 pl-4">');
				inList = true;
			}
			out.push(`<li>${inline(bullet[1] ?? '')}</li>`);
		} else {
			closeList();
			out.push(line.trim() === '' ? '<br>' : `<span>${inline(line)}</span><br>`);
		}
	}
	closeList();

	return out.join('').replace(/(<br>)+$/, '');
}
