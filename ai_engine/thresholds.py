"""Ngưỡng cảnh báo thiên tai Điện Biên (bản Python).

PHẢI KHỚP backend/src/alert-dienbien.ts — nếu sửa ngưỡng ở MỘT bên, PHẢI sửa
cả bên còn lại. Backend (Node.js) và AI Engine (Python) là 2 service riêng
biệt, không tự động đồng bộ hằng số với nhau; lệch ngưỡng giữa 2 nơi sẽ khiến
cùng 1 giá trị bị phân loại cảnh báo khác nhau tuỳ nơi tính.

Nguồn & giới hạn đã biết: xem docs/architecture.md. Mưa lớn/lũ quét là PROXY
đơn giản hoá từ Quyết định 18/2021/QĐ-TTg Điều 44 (bỏ qua chiều thời gian kéo
dài + vùng nguy cơ lũ quét 1-4 vì hệ thống chưa có dữ liệu), sương mù theo
định nghĩa WMO — 2 hiểm hoạ này đã được xác nhận với người yêu cầu
(2026-07-17). Mưa đá và sạt lở đất là PROXY heuristic TỰ THIẾT KẾ (Open-Meteo
và pháp luật VN hiện KHÔNG có bảng ngưỡng chính thức cho 2 hiểm hoạ này) —
CẦN chuyên gia khí tượng/địa chất xác nhận trước khi dùng cho cảnh báo chính
thức. KHÔNG phải bảng cấp độ rủi ro thiên tai pháp lý đầy đủ.
"""

from __future__ import annotations

from typing import Literal, Optional

AlertLevel = Literal["green", "yellow", "orange", "red"]

# --- 1. Mưa đá (hail) — PROXY heuristic, CHƯA có quy định VN chính thức ----
# CAPE cao = bất ổn định đối lưu; mực đóng băng thấp = đá ít tan khi rơi xuống
# đất; showers_mm là "cổng" bắt buộc (CAPE chỉ đo tiềm năng khí quyển, không
# tự suy ra có đối lưu thật hay không — showers gần 0 nghĩa là mô hình không
# dự báo mưa đối lưu ngày đó). Ngưỡng CAPE tham khảo thang phổ biến trong khí
# tượng đối lưu, hạ thấp hơn chuẩn lục địa ôn đới vì vùng nhiệt đới/gió mùa
# thường sinh đối lưu mạnh ở CAPE thấp hơn. Mực đóng băng ~3500m/4500m là
# ngưỡng tham khảo phổ biến cho "thuận lợi/không thuận lợi" để đá rơi tới đất
# ở vùng nhiệt đới-cận nhiệt. CẦN chuyên gia khí tượng xác nhận trước khi dùng
# chính thức — xem docs/architecture.md mục 5.
HAIL_CAPE_WEAK_MIN_JKG = 500.0
HAIL_CAPE_MODERATE_MIN_JKG = 1500.0
HAIL_CAPE_STRONG_MIN_JKG = 2500.0
HAIL_FREEZING_LEVEL_HIGH_RISK_MAX_M = 3500.0  # <= mức này: đá dễ rơi tới đất
HAIL_FREEZING_LEVEL_MODERATE_RISK_MAX_M = 4500.0
HAIL_SHOWERS_GATE_MM = 1.0  # dưới mức này: chưa đủ bằng chứng đối lưu -> ép về xanh


def classify_hail(cape_jkg: float, freezing_level_m: float, showers_mm: float) -> AlertLevel:
    """Phân loại nguy cơ mưa đá (proxy) theo CAPE, mực đóng băng và mưa đối lưu."""
    if showers_mm < HAIL_SHOWERS_GATE_MM:
        return "green"
    if cape_jkg >= HAIL_CAPE_STRONG_MIN_JKG and freezing_level_m <= HAIL_FREEZING_LEVEL_HIGH_RISK_MAX_M:
        return "red"
    if cape_jkg >= HAIL_CAPE_MODERATE_MIN_JKG:
        return "orange" if freezing_level_m <= HAIL_FREEZING_LEVEL_MODERATE_RISK_MAX_M else "yellow"
    if cape_jkg >= HAIL_CAPE_WEAK_MIN_JKG:
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


# --- 3. Sạt lở đất (landslide) — PROXY heuristic, CHƯA có dữ liệu độ dốc/DEM
# Không có slope/soil-survey chính thức (ngoài phạm vi MVP, xem
# docs/architecture.md mục 7) — dùng mưa tích luỹ 3 ngày + độ ẩm đất tầng
# 9-27cm. Hệ số địa hình (núi cao rủi ro cao hơn thung lũng, NGƯỢC với lũ
# quét vốn ưu tiên ven suối) nằm ở TERRAIN_MULTIPLIER bên dưới (chỉ áp dụng
# trong risk_engine.py, không mirror sang TS — cùng cách TERRAIN_FLOOD_MULTIPLIER
# đang làm cho lũ quét).
LANDSLIDE_SOIL_MOISTURE_MODERATE_MIN = 0.25  # m3/m3
LANDSLIDE_SOIL_MOISTURE_SATURATED_MIN = 0.35  # m3/m3
LANDSLIDE_RAIN3D_L1_MIN_MM = 100.0
LANDSLIDE_RAIN3D_L2_MIN_MM = 200.0
LANDSLIDE_RAIN3D_L3_MIN_MM = 350.0


def classify_landslide(rain_3d_mm: float, soil_moisture: float) -> AlertLevel:
    """Phân loại nguy cơ sạt lở đất (proxy) theo mưa tích luỹ 3 ngày + độ ẩm đất."""
    if rain_3d_mm > LANDSLIDE_RAIN3D_L3_MIN_MM and soil_moisture >= LANDSLIDE_SOIL_MOISTURE_SATURATED_MIN:
        return "red"
    if rain_3d_mm > LANDSLIDE_RAIN3D_L2_MIN_MM:
        return "orange" if soil_moisture >= LANDSLIDE_SOIL_MOISTURE_MODERATE_MIN else "yellow"
    if rain_3d_mm >= LANDSLIDE_RAIN3D_L1_MIN_MM or soil_moisture >= LANDSLIDE_SOIL_MOISTURE_SATURATED_MIN:
        return "yellow"
    return "green"


# --- 4. Sương mù dày (dùng khi CÓ tầm nhìn đo/dự báo thực tế) ---------------
FOG_MAX_VISIBILITY_M = 1000.0
DENSE_FOG_MAX_VISIBILITY_M = 50.0


def classify_fog(visibility_m: float) -> AlertLevel:
    """Phân loại sương mù theo tầm nhìn xa (m) — nguồn: định nghĩa WMO."""
    if visibility_m < DENSE_FOG_MAX_VISIBILITY_M:
        return "red"
    if visibility_m < FOG_MAX_VISIBILITY_M:
        return "yellow"
    return "green"


# --- 5. Ngưỡng RIÊNG của AI Engine (không có trong alert-dienbien.ts) ------
# Dùng khi KHÔNG có tầm nhìn đo/dự báo thực tế (vd. dự báo 3-7 ngày từ
# Open-Meteo hiện KHÔNG có trường visibility — xem backend/src/weather-ingest.ts).
# Ước tính thay thế từ downscale.fog_risk_factor(). Ngưỡng NỘI BỘ dự án, CHƯA
# đối chiếu số liệu quan trắc thực tế (chưa có CSDL lịch sử — xem
# docs/architecture.md mục 5), cần hiệu chỉnh khi có dữ liệu.
FOG_RISK_FACTOR_YELLOW_MIN = 0.35
FOG_RISK_FACTOR_RED_MIN = 0.70

# Hệ số nhân địa hình cho lũ quét — heuristic dự án, KHÔNG phải số liệu chính
# thức (chưa có bảng "vùng nguy cơ lũ quét 1-4" chính thức cho Điện Biên, xem
# docs/architecture.md mục 4). Lấy cảm hứng từ nguyên tắc "có thể điều
# chỉnh tăng cấp khi nhiều yếu tố rủi ro cộng dồn" của QĐ 18/2021/QĐ-TTg,
# KHÔNG phải áp dụng trực tiếp điều khoản đó cho địa hình.
TERRAIN_FLOOD_MULTIPLIER: dict[str, float] = {
    "ven_suoi": 1.3,
    "nui_cao": 1.2,
    "thung_lung": 1.0,
}

# Hệ số nhân địa hình cho sạt lở đất — heuristic dự án riêng, KHÔNG dùng
# TERRAIN_FLOOD_MULTIPLIER ở trên vì địa hình ảnh hưởng NGƯỢC chiều: núi cao
# dốc là yếu tố chi phối sạt lở (khác lũ quét vốn ưu tiên ven suối), thung
# lũng bằng phẳng rủi ro trượt tại chỗ thấp hơn.
LANDSLIDE_TERRAIN_MULTIPLIER: dict[str, float] = {
    "nui_cao": 1.4,
    "ven_suoi": 1.15,
    "thung_lung": 0.9,
}

# Mốc điểm 0-100 dùng chung cho mọi hazard khi quy đổi alert_level <-> risk_score
# liên tục (xem risk_engine.py). Không phải ngưỡng thiên tai — chỉ là thang điểm nội bộ.
SCORE_YELLOW_MIN = 25.0
SCORE_ORANGE_MIN = 60.0
SCORE_RED_MIN = 85.0
