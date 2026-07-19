// Client gửi SMS cảnh báo thật qua SMS gateway ngoài (thay thế payload mô
// phỏng của GET /api/mock-notify?channel=sms cho kênh SMS cụ thể) — xem
// docs/architecture.md mục 5/7. CHƯA cấu hình số điện thoại người nhận cố
// định hay API key thật trong repo: SMS_GATEWAY_URL/SMS_API_KEY để trống ở
// .env.example, số điện thoại người nhận do caller truyền vào từng request
// (POST /api/notify/sms), không lưu danh sách thuê bao trong code.
//
// Hình dạng request/response dưới đây là generic REST (phổ biến ở các
// gateway kiểu eSMS/SpeedSMS/Twilio) — CHỈNH LẠI theo đúng API của gateway
// thật sẽ dùng trước khi đưa vào production.

import 'dotenv/config';

const SMS_GATEWAY_URL = process.env.SMS_GATEWAY_URL;
const SMS_API_KEY = process.env.SMS_API_KEY;
const SMS_SENDER_ID = process.env.SMS_SENDER_ID ?? 'ForestGump';
const SMS_TIMEOUT_MS = Number(process.env.SMS_TIMEOUT_MS ?? 8000);

export class SmsNotConfiguredError extends Error {}

export interface SmsSendResult {
  to: string;
  message: string;
  providerMessageId?: string;
}

/**
 * Gửi 1 SMS cảnh báo tới `to` (số điện thoại do caller truyền, KHÔNG đọc từ
 * danh sách cố định trong code/env). Ném `SmsNotConfiguredError` nếu
 * SMS_GATEWAY_URL/SMS_API_KEY chưa cấu hình — route handler (api.ts) chịu
 * trách nhiệm trả 503 thay vì để lỗi rơi xuống 500 chung chung.
 */
export async function sendSms(to: string, message: string): Promise<SmsSendResult> {
  if (!SMS_GATEWAY_URL || !SMS_API_KEY) {
    throw new SmsNotConfiguredError(
      'SMS_GATEWAY_URL/SMS_API_KEY chưa được cấu hình trên backend'
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SMS_TIMEOUT_MS);

  try {
    const res = await fetch(SMS_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SMS_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({ to, message, sender: SMS_SENDER_ID }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`SMS gateway trả về status ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json().catch(() => ({}))) as { messageId?: string };
    return data.messageId ? { to, message, providerMessageId: data.messageId } : { to, message };
  } finally {
    clearTimeout(timeoutId);
  }
}
