"""Bộ sinh bản tin cảnh báo từ RiskAssessment — ngân hàng template cố định.

QUAN TRỌNG: generate_bulletin() CHỈ điền biến số vào template đã kiểm duyệt
trước trong TEMPLATES bên dưới — KHÔNG dùng LLM tự do sinh nội dung cảnh báo
an toàn tính mạng. Đây là nguyên tắc bắt buộc: nội dung cảnh báo (đặc biệt
hành động khuyến nghị khi có nguy cơ lũ quét/rét hại) phải nhất quán và đã
được rà soát trước, không để mô hình sinh ngẫu nhiên.

Hiện chỉ có template tiếng Việt ("vi"). Để chỗ cho tiếng Thái/Mông sau — xem
SUPPORTED_LANGS và generate_bulletin().
"""

from __future__ import annotations

from risk_engine import HazardRisk, LocationInput, RiskAssessment
from thresholds import AlertLevel

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


def generate_bulletin(location: LocationInput, risk: RiskAssessment, lang: str = "vi") -> str:
    """Sinh bản tin cảnh báo cho 1 ngày từ RiskAssessment, điền biến vào mẫu cố định.

    Gộp tất cả hiểm hoạ KHÔNG ở mức 'green' thành các dòng cảnh báo riêng biệt
    (mỗi hazard 1 dòng). Nếu mọi hiểm hoạ đều 'green', trả về 1 dòng thông báo
    bình thường. Không có template dịch sẵn cho `lang` -> fallback về "vi" và
    log warning, KHÔNG tự bịa bản dịch.
    """
    if lang not in SUPPORTED_LANGS:
        print(f"[BULLETIN] WARNING: chưa có bản dịch cho lang='{lang}', dùng 'vi'.")
        lang = "vi"

    lines = [_format_hazard(location, risk.date, hazard) for hazard in risk.hazards]
    messages = [line for line in lines if line is not None]

    if not messages:
        return f"[Dân/cán bộ xã] {location.name} ngày {risk.date}: thời tiết bình thường, chưa có cảnh báo."

    return "\n".join(messages)
