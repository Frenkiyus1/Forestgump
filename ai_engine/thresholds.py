"""Ngưỡng cảnh báo thiên tai Điện Biên (bản Python).

PHẢI KHỚP backend/src/alert-dienbien.ts — nếu sửa ngưỡng ở MỘT bên, PHẢI sửa
cả bên còn lại. Backend (Node.js) và AI Engine (Python) là 2 service riêng
biệt, không tự động đồng bộ hằng số với nhau; lệch ngưỡng giữa 2 nơi sẽ khiến
cùng 1 giá trị bị phân loại cảnh báo khác nhau tuỳ nơi tính.

Nguồn & giới hạn đã biết: xem docs/dienbien-phase0.md. Đây LÀ các ngưỡng đã
được xác nhận với người yêu cầu (2026-07-17) — rét đậm/rét hại theo định
nghĩa nghiệp vụ NCHMF, mưa lớn/lũ quét là PROXY đơn giản hoá từ Quyết định
18/2021/QĐ-TTg Điều 44 (bỏ qua chiều thời gian kéo dài + vùng nguy cơ lũ quét
1-4 vì hệ thống chưa có dữ liệu), sương mù theo định nghĩa WMO. KHÔNG phải
bảng cấp độ rủi ro thiên tai pháp lý đầy đủ.
"""

from __future__ import annotations

from typing import Literal, Optional

AlertLevel = Literal["green", "yellow", "orange", "red"]

# --- 1. Rét đậm / rét hại ---------------------------------------------------
COLD_SEVERE_MAX_C = 13.0  # <= ngưỡng này: rét hại (đỏ)
COLD_DAMP_MAX_C = 15.0  # <= ngưỡng này (và > rét hại): rét đậm (vàng)


def classify_cold_damage(avg_temp_c: float) -> AlertLevel:
    """Phân loại rét đậm/rét hại theo nhiệt độ trung bình ngày (°C)."""
    if avg_temp_c <= COLD_SEVERE_MAX_C:
        return "red"
    if avg_temp_c <= COLD_DAMP_MAX_C:
        return "yellow"
    return "green"


# --- 2. Mưa lớn / lũ quét (proxy đơn giản hoá) ------------------------------
HEAVY_RAIN_L1_MIN_24H_MM = 100.0
HEAVY_RAIN_L1_MIN_12H_MM = 50.0
HEAVY_RAIN_L2_MIN_24H_MM = 200.0
HEAVY_RAIN_L3_MIN_24H_MM = 400.0


def classify_heavy_rain_flood_risk(
    rain_24h_mm: float, rain_12h_mm: Optional[float] = None
) -> AlertLevel:
    """Phân loại nguy cơ mưa lớn/lũ quét (proxy) theo lượng mưa đo/dự báo."""
    if rain_24h_mm > HEAVY_RAIN_L3_MIN_24H_MM:
        return "red"
    if rain_24h_mm > HEAVY_RAIN_L2_MIN_24H_MM:
        return "orange"
    if rain_24h_mm >= HEAVY_RAIN_L1_MIN_24H_MM or (
        rain_12h_mm is not None and rain_12h_mm >= HEAVY_RAIN_L1_MIN_12H_MM
    ):
        return "yellow"
    return "green"


# --- 3. Sương mù dày (dùng khi CÓ tầm nhìn đo/dự báo thực tế) ---------------
FOG_MAX_VISIBILITY_M = 1000.0
DENSE_FOG_MAX_VISIBILITY_M = 50.0


def classify_fog(visibility_m: float) -> AlertLevel:
    """Phân loại sương mù theo tầm nhìn xa (m) — nguồn: định nghĩa WMO."""
    if visibility_m < DENSE_FOG_MAX_VISIBILITY_M:
        return "red"
    if visibility_m < FOG_MAX_VISIBILITY_M:
        return "yellow"
    return "green"


# --- 4. Ngưỡng RIÊNG của AI Engine (không có trong alert-dienbien.ts) ------
# Dùng khi KHÔNG có tầm nhìn đo/dự báo thực tế (vd. dự báo 3-7 ngày từ
# Open-Meteo hiện KHÔNG có trường visibility — xem backend/src/weather-ingest.ts).
# Ước tính thay thế từ downscale.fog_risk_factor(). Ngưỡng NỘI BỘ dự án, CHƯA
# đối chiếu số liệu quan trắc thực tế (chưa có CSDL lịch sử — xem
# docs/dienbien-phase1.md), cần hiệu chỉnh khi có dữ liệu.
FOG_RISK_FACTOR_YELLOW_MIN = 0.35
FOG_RISK_FACTOR_RED_MIN = 0.70

# Hệ số nhân địa hình cho lũ quét — heuristic dự án, KHÔNG phải số liệu chính
# thức (chưa có bảng "vùng nguy cơ lũ quét 1-4" chính thức cho Điện Biên, xem
# docs/dienbien-phase0.md mục 2.2). Lấy cảm hứng từ nguyên tắc "có thể điều
# chỉnh tăng cấp khi nhiều yếu tố rủi ro cộng dồn" của QĐ 18/2021/QĐ-TTg,
# KHÔNG phải áp dụng trực tiếp điều khoản đó cho địa hình.
TERRAIN_FLOOD_MULTIPLIER: dict[str, float] = {
    "ven_suoi": 1.3,
    "nui_cao": 1.2,
    "thung_lung": 1.0,
}

# Mốc điểm 0-100 dùng chung cho mọi hazard khi quy đổi alert_level <-> risk_score
# liên tục (xem risk_engine.py). Không phải ngưỡng thiên tai — chỉ là thang điểm nội bộ.
SCORE_YELLOW_MIN = 25.0
SCORE_ORANGE_MIN = 60.0
SCORE_RED_MIN = 85.0
