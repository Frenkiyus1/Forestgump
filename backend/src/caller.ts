// Gửi cảnh báo đẩy tới điện thoại qua ntfy.sh (free, không cần tài khoản).
// Cài app ntfy trên máy, subscribe đúng topic = NTFY_TOPIC để nhận thông báo reo.

const NTFY_TOPIC = process.env.NTFY_TOPIC;
const NTFY_SERVER = process.env.NTFY_SERVER ?? 'https://ntfy.sh';

/**
 * Bắn 1 thông báo cảnh báo đỏ tới ntfy → điện thoại reo + hiện thông báo.
 * Lưu ý: header HTTP (Title) chỉ nhận ASCII nên bỏ dấu; phần body UTF-8 nên
 * giữ nguyên tiếng Việt có dấu, ntfy hiển thị đúng.
 */
export async function sendAlertPush(stationName: string, forecast24h: number): Promise<void> {
  if (!NTFY_TOPIC) {
    console.warn('[PUSH] NTFY_TOPIC chưa cấu hình — bỏ qua');
    return;
  }

  const res = await fetch(`${NTFY_SERVER}/${NTFY_TOPIC}`, {
    method: 'POST',
    headers: {
      Title: 'CANH BAO NGAP MAN DO', // ASCII-only cho header
      Priority: 'urgent', // reo + heads-up, kêu cả khi im lặng
      Tags: 'rotating_light', // icon 🚨
    },
    body: `Phát hiện xâm nhập mặn tại ${stationName} — ${forecast24h.toFixed(1)} g/L. Đóng cống ngay!`,
  });

  if (!res.ok) {
    throw new Error(`ntfy ${res.status}: ${await res.text()}`);
  }
  console.log(`[PUSH] Đã gửi cảnh báo tới ntfy topic "${NTFY_TOPIC}"`);
}
