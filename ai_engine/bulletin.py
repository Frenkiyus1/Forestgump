"""Bộ sinh bản tin cảnh báo từ RiskAssessment.

generate_bulletin() ưu tiên gọi LLM (Gemini, xem llm_bulletin.py) để soạn bản
tin — NEO (grounded) vào chính RiskAssessment vừa tính, model không được bịa
hiểm hoạ/số liệu ngoài đó. TEMPLATES bên dưới giờ đóng vai trò FALLBACK bắt
buộc: khi GEMINI_API_KEY chưa cấu hình hoặc lời gọi LLM lỗi/timeout/rỗng,
generate_bulletin() tự quay về điền biến vào template cố định — đảm bảo AI
Engine luôn trả lời được kể cả khi LLM không khả dụng.

Hiện chỉ có template tiếng Việt ("vi"). Để chỗ cho tiếng Thái/Mông sau — xem
SUPPORTED_LANGS và generate_bulletin().
"""

from __future__ import annotations

from risk_engine import HazardRisk, LocationInput, RiskAssessment
from thresholds import AlertLevel
from llm_bulletin import LlmBulletinNotConfiguredError, generate_bulletin_llm

SUPPORTED_LANGS = {"vi"}

# Khoá: (hazard, alert_level). "audience" = đối tượng nhận bản tin.
# "headline"/"action" dùng .format(location_name=..., date=...).
TEMPLATES: dict[tuple[str, AlertLevel], dict[str, str]] = {
    ("hail", "green"): {
        "audience": "Dân/cán bộ xã",
        "headline": "{location_name} ngày {date}: chưa có nguy cơ mưa đá.",
        "action": "Theo dõi bản tin thời tiết định kỳ.",
    },
    ("hail", "yellow"): {
        "audience": "Dân/cán bộ xã",
        "headline": "Cảnh báo NGUY CƠ MƯA ĐÁ tại {location_name} ngày {date}.",
        "action": "Che chắn mái nhà kính/mái tôn, đưa vật nuôi vào chuồng khi trời chuyển giông.",
    },
    ("hail", "orange"): {
        "audience": "Dân/cán bộ xã",
        "headline": "Cảnh báo MƯA ĐÁ tại {location_name} ngày {date}, nguy cơ hại cây trồng/mái nhà.",
        "action": (
            "Che chắn cây trồng, nông sản, phương tiện. Trú ẩn nơi kiên cố khi có giông, "
            "tránh xa cửa kính."
        ),
    },
    ("hail", "red"): {
        "audience": "Dân/cán bộ xã",
        "headline": "NGUY HIỂM: NGUY CƠ MƯA ĐÁ DIỆN RỘNG tại {location_name} ngày {date}.",
        "action": (
            "Trú ẩn ngay nơi kiên cố khi có giông sét/mưa đá. Không trú dưới cây to hoặc mái tôn "
            "mỏng. Sơ tán vật nuôi, che chắn tài sản trước khi giông đến."
        ),
    },
    ("landslide", "green"): {
        "audience": "Dân/cán bộ xã",
        "headline": "{location_name} ngày {date}: chưa có nguy cơ sạt lở đất.",
        "action": "Theo dõi bản tin thời tiết định kỳ.",
    },
    ("landslide", "yellow"): {
        "audience": "Dân/cán bộ xã",
        "headline": "Cảnh báo NGUY CƠ SẠT LỞ ĐẤT tại {location_name} ngày {date} do mưa tích luỹ.",
        "action": "Theo dõi vết nứt, sụt đất quanh nhà và taluy. Hạn chế đi lại gần sườn dốc sau mưa lớn.",
    },
    ("landslide", "orange"): {
        "audience": "Dân/cán bộ xã",
        "headline": "Cảnh báo SẠT LỞ ĐẤT tại {location_name} ngày {date}, đất đã bão hoà nước.",
        "action": (
            "Di dời khỏi khu vực gần taluy dương/sườn dốc có dấu hiệu nứt, sụt. "
            "Chuẩn bị sơ tán khi cần."
        ),
    },
    ("landslide", "red"): {
        "audience": "Dân/cán bộ xã",
        "headline": "NGUY HIỂM: SẠT LỞ ĐẤT tại {location_name} ngày {date}.",
        "action": (
            "Sơ tán ngay khỏi khu vực chân/sườn núi dốc, taluy có dấu hiệu nứt. Không quay lại "
            "cho đến khi chính quyền xác nhận an toàn."
        ),
    },
    ("heavy_rain_flood", "green"): {
        "audience": "Dân/cán bộ xã",
        "headline": "{location_name} ngày {date}: chưa có mưa lớn/nguy cơ lũ quét.",
        "action": "Theo dõi bản tin thời tiết định kỳ.",
    },
    ("heavy_rain_flood", "yellow"): {
        "audience": "Dân/cán bộ xã",
        "headline": "Cảnh báo MƯA LỚN tại {location_name} ngày {date}.",
        "action": "Theo dõi mực nước suối/khe quanh khu vực, chuẩn bị di dời tài sản nếu mưa tiếp tục tăng.",
    },
    ("heavy_rain_flood", "orange"): {
        "audience": "Dân/cán bộ xã",
        "headline": "Cảnh báo MƯA RẤT LỚN, NGUY CƠ LŨ QUÉT tại {location_name} ngày {date}.",
        "action": (
            "Hạn chế qua suối/ngầm tràn. Di dời tài sản, vật nuôi lên cao. "
            "Theo dõi sát bản tin cảnh báo tiếp theo."
        ),
    },
    ("heavy_rain_flood", "red"): {
        "audience": "Dân/cán bộ xã",
        "headline": "NGUY HIỂM: LŨ QUÉT tại {location_name} ngày {date}.",
        "action": (
            "Không qua suối/ngầm tràn đêm nay. Di dời tài sản, vật nuôi lên cao trước 18h. "
            "Sẵn sàng sơ tán theo hướng dẫn của chính quyền xã."
        ),
    },
    ("fog", "green"): {
        "audience": "Dân/cán bộ xã",
        "headline": "{location_name} ngày {date}: tầm nhìn bình thường.",
        "action": "Không cần lưu ý đặc biệt.",
    },
    ("fog", "yellow"): {
        "audience": "Dân/cán bộ xã",
        "headline": "Sương mù tại {location_name} ngày {date}, tầm nhìn giảm.",
        "action": "Bật đèn khi lái xe, giảm tốc độ trên đường đèo/dốc, đặc biệt sáng sớm.",
    },
    ("fog", "orange"): {
        "audience": "Dân/cán bộ xã",
        "headline": "Sương mù dày tại {location_name} ngày {date}, tầm nhìn hạn chế đáng kể.",
        "action": "Hạn chế di chuyển đường đèo/dốc/ven suối sáng sớm nếu không cần thiết. Bật đèn sương mù.",
    },
    ("fog", "red"): {
        "audience": "Dân/cán bộ xã",
        "headline": "SƯƠNG MÙ DÀY ĐẶC tại {location_name} ngày {date}, tầm nhìn rất hạn chế.",
        "action": (
            "Hạn chế di chuyển, đặc biệt đường đèo/dốc/ven suối. Nếu bắt buộc di chuyển: "
            "bật đèn sương mù, giảm tốc tối đa."
        ),
    },
}


def _format_hazard(location: LocationInput, date: str, hazard: HazardRisk) -> str | None:
    """Điền template cho 1 hiểm hoạ; trả None nếu green (không cần cảnh báo) hoặc thiếu template."""
    template = TEMPLATES.get((hazard.hazard, hazard.alert_level))
    if template is None:
        print(f"[BULLETIN] WARNING: chưa có template cho ({hazard.hazard}, {hazard.alert_level})")
        return None
    if hazard.alert_level == "green":
        return None

    headline = template["headline"].format(location_name=location.name, date=date)
    return f"[{template['audience']}] {headline} {template['action']}"


def _generate_bulletin_template(location: LocationInput, risk: RiskAssessment, lang: str = "vi") -> str:
    """Điền biến vào ngân hàng template cố định (đường FALLBACK khi LLM không
    khả dụng) — logic gốc trước khi có llm_bulletin.py, giữ nguyên hành vi."""
    if lang not in SUPPORTED_LANGS:
        print(f"[BULLETIN] WARNING: chưa có bản dịch cho lang='{lang}', dùng 'vi'.")
        lang = "vi"

    lines = [_format_hazard(location, risk.date, hazard) for hazard in risk.hazards]
    messages = [line for line in lines if line is not None]

    if not messages:
        return f"[Dân/cán bộ xã] {location.name} ngày {risk.date}: thời tiết bình thường, chưa có cảnh báo."

    return "\n".join(messages)


def generate_bulletin(location: LocationInput, risk: RiskAssessment, lang: str = "vi") -> str:
    """Sinh bản tin cảnh báo cho 1 ngày từ RiskAssessment.

    Ưu tiên gọi Gemini (llm_bulletin.generate_bulletin_llm), neo vào chính
    `risk` vừa tính. Fallback về ngân hàng template cố định
    (_generate_bulletin_template) khi GEMINI_API_KEY chưa cấu hình hoặc lời
    gọi LLM lỗi/timeout/rỗng — AI Engine phải luôn trả lời được, không phụ
    thuộc uptime của Gemini.
    """
    try:
        return generate_bulletin_llm(location, risk, lang)
    except LlmBulletinNotConfiguredError:
        return _generate_bulletin_template(location, risk, lang)
    except Exception as exc:  # noqa: BLE001 - lỗi gọi LLM không được làm sập bản tin cảnh báo
        print(f"[BULLETIN] WARNING: lỗi gọi LLM ({exc}), fallback template.")
        return _generate_bulletin_template(location, risk, lang)
