"""Downscaling nhiệt độ theo cao độ + ước tính nguy cơ sương mù theo địa hình.

MVP rule-based, KHÔNG phải mô hình vật lý khí quyển đầy đủ (không mô phỏng
nghịch nhiệt, độ ẩm theo lớp khí quyển, hướng phơi sườn núi...). Dùng để hiệu
chỉnh sai lệch giữa độ cao ô lưới dự báo (Open-Meteo) và độ cao thực tế của
địa điểm — quan trọng ở vùng núi chia cắt mạnh như Tủa Chùa, nơi 1 ô lưới có
thể chênh hàng trăm mét so với bản/xã cụ thể (xem backend/src/config/locations.ts).
"""

from __future__ import annotations

# Lapse rate môi trường chuẩn (International Standard Atmosphere) ~6.5°C/km.
# Đây là con số vật lý phổ quát (không phải ngưỡng thiên tai cần tra cứu văn
# bản pháp lý), nhưng vẫn chỉ là XẤP XỈ TUYẾN TÍNH trung bình toàn cầu.
DEFAULT_LAPSE_RATE_C_PER_100M = 0.65

# Ngưỡng heuristic NỘI BỘ cho fog_risk_factor — dự án tự định nghĩa để ước
# tính xu hướng, CHƯA đối chiếu số liệu quan trắc thực tế (chưa có CSDL lịch
# sử thiên tai Điện Biên, xem docs/architecture.md mục 5). KHÔNG phải ngưỡng khí
# tượng chính thức — cần hiệu chỉnh khi có dữ liệu quan trắc.
FOG_FULL_RISK_SPREAD_C = 2.5  # chênh nhiệt-điểm sương <= mức này: rủi ro tối đa
FOG_ZERO_RISK_SPREAD_C = 6.0  # chênh nhiệt-điểm sương >= mức này: gần như không sương mù
FOG_HUMIDITY_FULL_RISK_PCT = 95.0
VALLEY_TERRAIN_MULTIPLIER = 1.3  # thung lũng: sương mù bức xạ dễ tụ ban đêm
DEFAULT_TERRAIN_MULTIPLIER = 1.0


def downscale_temperature(
    temp_grid: float,
    elevation_grid: float,
    elevation_target: float,
    lapse_rate: float = DEFAULT_LAPSE_RATE_C_PER_100M,
) -> float:
    """Hiệu chỉnh nhiệt độ dự báo (ứng với độ cao ô lưới) về độ cao thực tế.

    Dùng lapse rate khí quyển chuẩn (mặc định 0.65°C/100m) — đây là XẤP XỈ
    TUYẾN TÍNH, không phải mô hình vật lý đầy đủ: bỏ qua nghịch nhiệt (temperature
    inversion — khá phổ biến vào đêm mùa đông ở các lòng chảo/thung lũng như
    Điện Biên Phủ, có thể khiến nhiệt độ thực tế CAO hơn dự đoán tuyến tính),
    độ ẩm, bức xạ mặt trời, hướng phơi sườn núi. Sai số có thể lớn khi chênh
    cao rất lớn (>1000m) hoặc trong điều kiện nghịch nhiệt.

    Args:
        temp_grid: nhiệt độ dự báo tại độ cao ô lưới tham chiếu (°C).
        elevation_grid: độ cao ô lưới dự báo dùng làm tham chiếu (m). Nếu
            không rõ độ cao ô lưới thực tế (Open-Meteo không luôn trả kèm),
            có thể truyền bằng elevation_target để bỏ qua hiệu chỉnh (delta=0).
        elevation_target: độ cao thực tế của địa điểm cần hiệu chỉnh (m).
        lapse_rate: tốc độ giảm nhiệt theo độ cao (°C/100m), mặc định 0.65.

    Returns:
        Nhiệt độ đã hiệu chỉnh về độ cao thực tế (°C). Độ cao tăng -> nhiệt độ giảm.
    """
    elevation_diff_m = elevation_target - elevation_grid
    return temp_grid - lapse_rate * (elevation_diff_m / 100.0)


def fog_risk_factor(humidity: float, temp: float, dew_point: float, terrain_type: str) -> float:
    """Ước tính hệ số nguy cơ sương mù bức xạ (heuristic, KHÔNG phải xác suất chuẩn hoá).

    Sương mù bức xạ dễ hình thành khi (1) nhiệt độ gần điểm sương (chênh lệch
    temp - dew_point nhỏ, không khí gần bão hoà) và (2) độ ẩm tương đối cao.
    Địa hình thung lũng ("thung_lung") làm tăng hệ số vì khí lạnh/ẩm dồn xuống
    đáy thung lũng ban đêm (đối lưu khí lạnh) khiến sương mù dễ tụ và lâu tan
    hơn so với vùng núi cao/ven suối thoáng khí.

    Trả về số không âm, thường trong khoảng ~0-1.3 (đã nhân hệ số địa hình) —
    dùng làm ĐẦU VÀO cho risk_engine.compute_risk, KHÔNG phải tầm nhìn (m) và
    KHÔNG thay thế alert-dienbien.ts's classify_fog() khi có tầm nhìn đo thực
    tế (xem thresholds.py).

    Args:
        humidity: độ ẩm tương đối (%).
        temp: nhiệt độ không khí (°C).
        dew_point: điểm sương (°C).
        terrain_type: loại địa hình — khớp Terrain trong locations.ts
            ('thung_lung' | 'nui_cao' | 'ven_suoi').

    Returns:
        Hệ số nguy cơ sương mù (>= 0, không có trần cứng do hệ số địa hình nhân thêm).
    """
    # Về lý thuyết temp luôn >= dew_point; kẹp về 0 để chống nhiễu số/làm tròn.
    spread = max(0.0, temp - dew_point)

    if spread <= FOG_FULL_RISK_SPREAD_C:
        spread_factor = 1.0
    elif spread >= FOG_ZERO_RISK_SPREAD_C:
        spread_factor = 0.0
    else:
        span = FOG_ZERO_RISK_SPREAD_C - FOG_FULL_RISK_SPREAD_C
        spread_factor = 1.0 - (spread - FOG_FULL_RISK_SPREAD_C) / span

    humidity_factor = max(0.0, min(1.0, humidity / FOG_HUMIDITY_FULL_RISK_PCT))
    base = spread_factor * humidity_factor

    terrain_multiplier = (
        VALLEY_TERRAIN_MULTIPLIER if terrain_type == "thung_lung" else DEFAULT_TERRAIN_MULTIPLIER
    )
    return base * terrain_multiplier
