// Tích hợp Stringee REST API: gọi thoại cảnh báo khẩn cấp, SMS làm phương án dự phòng.
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const STRINGEE_SID = process.env.STRINGEE_SID ?? '';
const STRINGEE_SECRET = process.env.STRINGEE_SECRET ?? '';
const STRINGEE_FROM_NUMBER = process.env.STRINGEE_FROM_NUMBER ?? '';
const ALERT_TO_NUMBER = process.env.ALERT_TO_NUMBER ?? '';
const PUBLIC_WEBHOOK_URL = process.env.PUBLIC_WEBHOOK_URL ?? '';

const STRINGEE_CALL_URL = 'https://api.stringee.com/v1/call2/callout';
const STRINGEE_SMS_URL = 'https://api.stringee.com/v1/sms';
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // Stringee REST API yêu cầu JWT còn hạn khi gọi

export interface AlertCallData {
  stationId: string;
  level: string;
  ec: number;
}

/** Sinh JWT truy cập Stringee REST API (SID làm issuer, ký bằng secret, hết hạn sau 1h). */
export function getAccessToken(): string {
  const payload = {
    jti: `${STRINGEE_SID}-${Date.now()}`,
    iss: STRINGEE_SID,
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
    rest_api: true,
  };

  return jwt.sign(payload, STRINGEE_SECRET, {
    algorithm: 'HS256',
    header: { typ: 'JWT', alg: 'HS256', cty: 'stringee-api;v=1' },
  });
}

/** Gọi điện thoại cảnh báo khẩn cấp qua Stringee Call API. */
export async function sendAlertCall(alertData: AlertCallData): Promise<void> {
  const token = getAccessToken();

  await axios.post(
    STRINGEE_CALL_URL,
    {
      from: {
        type: 'internal',
        number: STRINGEE_FROM_NUMBER,
        alias: STRINGEE_FROM_NUMBER,
      },
      to: [
        {
          type: 'external',
          number: ALERT_TO_NUMBER,
          alias: ALERT_TO_NUMBER,
        },
      ],
      answer_url: `${PUBLIC_WEBHOOK_URL}/api/webhook/stringee`,
    },
    {
      headers: {
        'X-STRINGEE-AUTH': token,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log(
    `[STRINGEE] Alert call triggered for station "${alertData.stationId}" (${alertData.level}, ${alertData.ec} g/L)`
  );
}

/** Gửi SMS cảnh báo — phương án dự phòng khi cuộc gọi thoại thất bại. */
export async function sendAlertSMS(message: string): Promise<void> {
  const token = getAccessToken();

  await axios.post(
    STRINGEE_SMS_URL,
    {
      from: STRINGEE_FROM_NUMBER,
      to: ALERT_TO_NUMBER,
      text: message,
    },
    {
      headers: {
        'X-STRINGEE-AUTH': token,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log('[STRINGEE] Fallback SMS sent');
}
