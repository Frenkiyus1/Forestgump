import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { getStations, getLatestReading, getAlerts } from './db.js';
import { mockDetail } from './mock.js';
import { classifyAlert } from './alert.js';
import type { ChatTurn } from './schemas.js';

/** Model Gemini dùng cho chatbot (đổi qua env CHAT_MODEL nếu cần). */
const CHAT_MODEL = process.env.CHAT_MODEL ?? 'gemini-3.1-flash-lite';
const REAL_STATION_ID = process.env.REAL_STATION_ID ?? 'ST001';

/** API key Gemini (chấp nhận cả GEMINI_API_KEY lẫn GOOGLE_API_KEY). */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

/** Lỗi khi chưa cấu hình API key — để API trả 503 thân thiện. */
export class ChatUnavailableError extends Error {}

/**
 * Dựng ngữ cảnh số liệu hiện trường (mọi trạm) để nhét vào system instruction,
 * giúp Gemini trả lời chính xác theo dữ liệu thật thay vì bịa.
 */
async function buildStationContext(): Promise<string> {
  const stations = await getStations();
  const lines = await Promise.all(
    stations.map(async (s) => {
      const m = mockDetail(s.station_id);
      let ec = m.ec;
      let forecast24 = m.forecast_24h;
      let forecast48 = m.forecast_48h;

      if (s.station_id === REAL_STATION_ID) {
        const row = await getLatestReading(s.station_id);
        if (row) {
          ec = row.ec;
          forecast24 = row.forecast_24h ?? row.ec;
          forecast48 = row.forecast_48h ?? forecast24;
        }
      }

      const alert = classifyAlert(forecast24);
      return `- ${s.station_id} ${s.name} (${s.region}): độ mặn ${ec} g/L, dự báo 24h ${forecast24} g/L, 48h ${forecast48} g/L, mức ${alert}`;
    })
  );

  const alerts = await getAlerts(20);
  return [
    'Số liệu các trạm quan trắc (cập nhật gần nhất):',
    ...lines,
    '',
    `Số sự kiện vượt ngưỡng gần đây: ${alerts.length}.`,
  ].join('\n');
}

const SYSTEM_BASE = `Bạn là trợ lý ảo của SaliGuard - hệ thống cảnh báo sớm xâm nhập mặn cho nông dân ven biển Hải Phòng.
Nhiệm vụ: trả lời câu hỏi về độ mặn, cảnh báo và các trạm đo, đưa khuyến nghị tưới tiêu/đóng cống.
Ngưỡng cảnh báo độ mặn: dưới 1 g/L an toàn (xanh), 1-4 g/L cảnh báo (vàng - chuẩn bị đóng cống), trên 4 g/L nguy hiểm (đỏ - đóng cống ngay).
Quy tắc trả lời:
- Trả lời bằng tiếng Việt, ngắn gọn, trực tiếp, dễ hiểu cho nông dân.
- CHỈ dựa vào số liệu trạm được cung cấp bên dưới; nếu không có dữ liệu thì nói rõ là chưa có.
- Không bịa số liệu hay trạm không tồn tại.`;

/**
 * Gửi cả mạch hội thoại tới Gemini kèm ngữ cảnh số liệu trạm (để nhớ ngữ cảnh
 * giữa các lượt), trả về câu trả lời cho lượt mới nhất.
 */
export async function askChat(messages: ChatTurn[]): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new ChatUnavailableError('GEMINI_API_KEY chưa được cấu hình');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const context = await buildStationContext();

  const contents = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  const response = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents,
    config: {
      systemInstruction: `${SYSTEM_BASE}\n\n${context}`,
      maxOutputTokens: 1024,
    },
  });

  return (response.text ?? '').trim();
}
