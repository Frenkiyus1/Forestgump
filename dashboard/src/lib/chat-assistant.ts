import { fetchChatAnswer } from './api';
import { getForecast } from './weather';
import { generateBulletin } from './bulletin';
import { LOCATIONS } from './locations';
import { ALERT_LABEL, HAZARD_LABEL } from './alert-ui';

const NO_MATCH_LOCATION_HINT =
	'Bạn có thể hỏi tôi về một khu vực cụ thể, ví dụ: "Tủa Chùa có cảnh báo gì không?"';

function findMentionedLocation(question: string) {
	const q = question.toLowerCase();
	return LOCATIONS.find((l) => q.includes(l.name.toLowerCase()));
}

/**
 * Trả lời câu hỏi tự do — ưu tiên gọi backend POST /api/chat (Gemini, neo vào
 * dữ liệu forecast/risk thật). Nếu backend chưa cấu hình GEMINI_API_KEY hoặc
 * không kết nối được, fallback về câu trả lời rule-based cục bộ
 * (answerChatFallback) thay vì để chat widget crash.
 */
export async function answerChat(question: string): Promise<string> {
	try {
		return await fetchChatAnswer(question);
	} catch (err) {
		console.error('[chat] Backend /api/chat không khả dụng, dùng fallback cục bộ:', err);
		return answerChatFallback(question);
	}
}

/**
 * Trả lời rule-based cục bộ dựa trên dữ liệu forecast thật (qua weather.ts) —
 * không gọi LLM. Luôn kèm lý do (nguồn gốc cảnh báo), theo đúng nguyên tắc
 * "không hộp đen" của dự án. Dùng khi backend/Gemini không khả dụng.
 */
async function answerChatFallback(question: string): Promise<string> {
	const mentioned = findMentionedLocation(question);
	const targets = mentioned ? [mentioned] : LOCATIONS;
	const forecasts = await Promise.all(targets.map((l) => getForecast(l.id)));

	if (mentioned) {
		const forecast = forecasts[0];
		if (forecast.alert) {
			const bulletin = await generateBulletin(forecast, 'vi');
			return (
				`**${mentioned.name}** đang có cảnh báo **${ALERT_LABEL[forecast.alert.level]}** — ` +
				`${HAZARD_LABEL[forecast.alert.type!]}, còn khoảng ${forecast.alert.hoursAhead} giờ.\n\n` +
				`${bulletin.action}\n\n*Vì sao:* ${forecast.alert.reason}`
			);
		}
		return `**${mentioned.name}** hiện an toàn, không có cảnh báo nào đang hoạt động.`;
	}

	const active = forecasts
		.map((f, i) => ({ alert: f.alert, loc: targets[i] }))
		.filter((x) => x.alert !== null);

	if (active.length === 0) {
		return (
			'Hiện tại cả 3 khu vực (TP. Điện Biên Phủ, Mường Nhé, Tủa Chùa) đều an toàn, không có ' +
			`cảnh báo nào đang hoạt động. ${NO_MATCH_LOCATION_HINT}`
		);
	}

	const lines = active.map(
		({ alert, loc }) =>
			`- **${loc.name}**: ${ALERT_LABEL[alert!.level]} — ${HAZARD_LABEL[alert!.type!]}, còn ${alert!.hoursAhead} giờ`
	);
	return `Đang có cảnh báo ở:\n${lines.join('\n')}\n\nHỏi tôi tên khu vực cụ thể để biết hành động cần làm.`;
}
