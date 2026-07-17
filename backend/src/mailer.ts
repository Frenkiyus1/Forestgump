import 'dotenv/config';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export interface AlertMailOptions {
  to: string;
  stationName: string;
  province: string;
  currentEc: number;
  alertLevel: 'yellow' | 'red';
}

export async function sendAlertEmail(opts: AlertMailOptions): Promise<void> {
  const { to, stationName, province, currentEc, alertLevel } = opts;

  const isRed = alertLevel === 'red';
  const levelLabel = isRed ? 'NGUY HIỂM (Đỏ)' : 'CẢNH BÁO (Vàng)';
  const action = isRed
    ? 'Đóng cống ngay, ngừng lấy nước!'
    : 'Chuẩn bị đóng cống, kiểm tra nguồn nước.';

  await transporter.sendMail({
    from: `"SaliGuard Alert" <${process.env.GMAIL_USER}>`,
    to,
    subject: `[SaliGuard] ${levelLabel} — Ngập mặn tại ${province}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: ${isRed ? '#dc2626' : '#d97706'}; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
          <p style="margin: 0; font-size: 13px; opacity: 0.85;">SaliGuard · Hệ thống cảnh báo ngập mặn sớm</p>
          <h1 style="margin: 6px 0 0; font-size: 22px;">⚠️ ${levelLabel}</h1>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px; background: #fff;">
          <p style="margin: 0 0 16px; font-size: 15px;">
            Trạm đo <strong>${stationName}</strong> ghi nhận độ mặn đo được HIỆN TẠI đạt
            <strong style="color: ${isRed ? '#dc2626' : '#d97706'};">${currentEc.toFixed(2)} g/L</strong>
            — vượt ngưỡng an toàn cho khu vực <strong>${province}</strong>.
          </p>
          <div style="background: #fef9f0; border-left: 3px solid ${isRed ? '#dc2626' : '#d97706'}; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 14px; font-weight: 600;">${action}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 8px 0; color: #6b7280;">Trạm đo</td>
              <td style="padding: 8px 0; font-weight: 500;">${stationName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 8px 0; color: #6b7280;">Khu vực</td>
              <td style="padding: 8px 0; font-weight: 500;">${province}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f3f4f6;">
              <td style="padding: 8px 0; color: #6b7280;">Độ mặn hiện tại</td>
              <td style="padding: 8px 0; font-weight: 500;">${currentEc.toFixed(2)} g/L</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Mức cảnh báo</td>
              <td style="padding: 8px 0; font-weight: 600; color: ${isRed ? '#dc2626' : '#d97706'};">${levelLabel}</td>
            </tr>
          </table>
          <p style="margin: 20px 0 0; font-size: 12px; color: #9ca3af;">
            Email này được gửi tự động từ SaliGuard. Vào dashboard để xem chi tiết: <a href="https://saliguard.vn" style="color: #d97706;">saliguard.vn</a>
          </p>
        </div>
      </div>
    `,
  });

  console.log(`[MAIL] Alert sent to ${to} (${levelLabel}, ${province})`);
}
