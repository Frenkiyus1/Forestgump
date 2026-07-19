// Client gọi Gemini API (Google AI) cho tính năng hỏi-đáp tự do trong chat
// widget của Dashboard. Bản tin cảnh báo chính thức (ai_engine/bulletin.py)
// gọi Gemini RIÊNG, từ phía Python (xem ai_engine/llm_bulletin.py) — không
// dùng client này — cùng nguyên tắc grounding: neo vào RiskAssessment thật,
// fallback template khi LLM lỗi/chưa cấu hình (xem CLAUDE.md mục 4). Câu trả
// lời của client này luôn được "neo" (grounded) vào dữ liệu forecast/risk
// thật truyền qua `contextJson` — không để model tự bịa số liệu.

import 'dotenv/config';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS ?? 10000);

const SYSTEM_INSTRUCTION =
  'Bạn là trợ lý hỏi-đáp cho hệ thống cảnh báo thiên tai Forestgump (tỉnh Điện ' +
  'Biên). CHỈ trả lời dựa trên dữ liệu JSON trong phần "DỮ LIỆU HIỆN TẠI" — ' +
  'KHÔNG bịa số liệu, KHÔNG suy đoán ngoài dữ liệu đó. Nếu câu hỏi không liên ' +
  'quan tới 3 địa điểm (TP. Điện Biên Phủ, Mường Nhé, Tủa Chùa) hoặc dữ liệu ' +
  'không đủ để trả lời, nói rõ là không có thông tin thay vì đoán. Trả lời ' +
  'ngắn gọn bằng tiếng Việt; khi có cảnh báo đang hoạt động, luôn nêu lý do ' +
  '(nguồn gốc cảnh báo từ dữ liệu) — không hộp đen.';

export class GeminiNotConfiguredError extends Error {}

/**
 * Trả lời `question`, neo vào `contextJson` (forecast + risk thật của các
 * địa điểm demo). Ném lỗi nếu GEMINI_API_KEY chưa cấu hình, timeout, hoặc
 * Gemini trả lỗi/rỗng — route handler (api.ts) chịu trách nhiệm fallback.
 */
export async function askGemini(question: string, contextJson: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new GeminiNotConfiguredError('GEMINI_API_KEY chưa được cấu hình trên backend');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [
            {
              role: 'user',
              parts: [{ text: `DỮ LIỆU HIỆN TẠI (JSON):\n${contextJson}\n\nCÂU HỎI: ${question}` }],
            },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Gemini API trả về status ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text.trim()) throw new Error('Gemini trả về câu trả lời rỗng');
    return text.trim();
  } finally {
    clearTimeout(timeoutId);
  }
}
