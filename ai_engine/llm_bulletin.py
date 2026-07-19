"""Sinh bản tin cảnh báo bằng LLM (Gemini), NEO (grounded) vào RiskAssessment.

generate_bulletin_llm() gọi Gemini để soạn nội dung bản tin từ đánh giá rủi
ro thật (compute_risk) — model CHỈ được diễn đạt lại dữ liệu risk truyền vào,
không được bịa hiểm hoạ/số liệu ngoài đó. Dùng chung GEMINI_API_KEY với
backend (xem docker-compose*.yml). Chưa cấu hình key -> ném
LlmBulletinNotConfiguredError để bulletin.generate_bulletin() fallback về
ngân hàng template cố định (AI Engine luôn phải trả lời được).
"""

from __future__ import annotations

import json
import os

import httpx

from risk_engine import LocationInput, RiskAssessment

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
GEMINI_TIMEOUT_S = float(os.getenv("GEMINI_TIMEOUT_MS", "10000")) / 1000

SUPPORTED_LANGS = {"vi"}

SYSTEM_INSTRUCTION = (
    "Bạn soạn bản tin CẢNH BÁO THIÊN TAI cho hệ thống Forestgump (tỉnh Điện "
    "Biên), phục vụ dân và cán bộ xã. CHỈ dựa trên dữ liệu JSON 'ĐÁNH GIÁ RỦI "
    "RO' được cung cấp — KHÔNG bịa hiểm hoạ, số liệu hay địa danh ngoài dữ "
    "liệu đó. Với MỖI hiểm hoạ có alert_level khác 'green', viết ĐÚNG MỘT dòng "
    "gồm: đối tượng nhận, tên địa điểm, ngày, mức độ nguy hiểm và hành động "
    "khuyến nghị cụ thể, an toàn. Nếu mọi hiểm hoạ đều 'green', trả về đúng một "
    "dòng thông báo thời tiết bình thường. Viết tiếng Việt, ngắn gọn, rõ ràng, "
    "không thêm lời dẫn/emoji/markdown."
)


class LlmBulletinNotConfiguredError(RuntimeError):
    """GEMINI_API_KEY chưa cấu hình — caller nên fallback về template."""


def is_llm_configured() -> bool:
    return bool(GEMINI_API_KEY)


def _context_json(location: LocationInput, risk: RiskAssessment) -> str:
    return json.dumps(
        {
            "location_name": location.name,
            "date": risk.date,
            "hazards": [
                {
                    "hazard": h.hazard,
                    "alert_level": h.alert_level,
                    "risk_score": h.risk_score,
                    "detail": h.detail,
                }
                for h in risk.hazards
            ],
        },
        ensure_ascii=False,
    )


def generate_bulletin_llm(location: LocationInput, risk: RiskAssessment, lang: str = "vi") -> str:
    """Soạn bản tin cho 1 ngày bằng Gemini, neo vào `risk`. Ném
    LlmBulletinNotConfiguredError nếu thiếu key; ném lỗi khác nếu Gemini
    timeout/lỗi/trả rỗng (caller chịu trách nhiệm fallback)."""
    if not GEMINI_API_KEY:
        raise LlmBulletinNotConfiguredError("GEMINI_API_KEY chưa được cấu hình cho AI Engine")
    if lang not in SUPPORTED_LANGS:
        print(f"[BULLETIN] WARNING: chưa hỗ trợ lang='{lang}' cho LLM, dùng 'vi'.")

    context = _context_json(location, risk)
    resp = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        headers={"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY},
        json={
            "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
            "contents": [{"role": "user", "parts": [{"text": f"ĐÁNH GIÁ RỦI RO (JSON):\n{context}"}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 512},
        },
        timeout=GEMINI_TIMEOUT_S,
    )
    resp.raise_for_status()
    data = resp.json()
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        raise RuntimeError("Gemini trả về bản tin rỗng")
    return text
