"""Feature engineering cho dự báo độ mặn (dùng CHUNG giữa train và serve).

Đầu vào là một chuỗi quan trắc gần đây (ascending theo thời gian, phần tử cuối
là thời điểm "hiện tại"). Hàm build_features tạo vector đặc trưng time-series:
EC hiện tại + các giá trị trễ (lag) + thống kê trượt 24h + pha thuỷ triều
(giờ trong ngày, bán nhật). Train và serve gọi cùng hàm này nên đặc trưng luôn
khớp nhau tuyệt đối.
"""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np

# Thứ tự feature CỐ ĐỊNH — phải giữ nguyên giữa train và serve.
FEATURE_NAMES: list[str] = [
    "ec",
    "temp",
    "level",
    "hour_sin",
    "hour_cos",
    "semi_sin",
    "semi_cos",
    "ec_lag_3h",
    "ec_lag_6h",
    "ec_lag_12h",
    "ec_lag_24h",
    "ec_roll_mean_24h",
    "ec_roll_max_24h",
    "ec_slope_6h",
]

HOUR = 3600.0


def _interp_at(ts: np.ndarray, ec: np.ndarray, target: float) -> float:
    """Nội suy EC tại mốc thời gian target (epoch s). np.interp tự kẹp 2 đầu."""
    return float(np.interp(target, ts, ec))


def build_features(
    ts: np.ndarray, ec: np.ndarray, temp: np.ndarray, level: np.ndarray
) -> np.ndarray:
    """Tạo 1 vector đặc trưng từ chuỗi quan trắc (ts ascending, epoch giây)."""
    ts = np.asarray(ts, dtype=float)
    ec = np.asarray(ec, dtype=float)
    temp = np.asarray(temp, dtype=float)
    level = np.asarray(level, dtype=float)

    now = ts[-1]
    ec_now = ec[-1]

    # Pha thuỷ triều theo giờ trong ngày (UTC): nhật triều 24h + bán nhật 12h.
    dt = datetime.fromtimestamp(now, tz=timezone.utc)
    h = dt.hour + dt.minute / 60.0
    hour_sin = np.sin(2 * np.pi * h / 24.0)
    hour_cos = np.cos(2 * np.pi * h / 24.0)
    semi_sin = np.sin(2 * np.pi * h / 12.0)
    semi_cos = np.cos(2 * np.pi * h / 12.0)

    lag3 = _interp_at(ts, ec, now - 3 * HOUR)
    lag6 = _interp_at(ts, ec, now - 6 * HOUR)
    lag12 = _interp_at(ts, ec, now - 12 * HOUR)
    lag24 = _interp_at(ts, ec, now - 24 * HOUR)

    mask = ts >= now - 24 * HOUR
    roll_mean = float(ec[mask].mean())
    roll_max = float(ec[mask].max())

    slope6 = (ec_now - lag6) / 6.0

    return np.array(
        [
            ec_now,
            temp[-1],
            level[-1],
            hour_sin,
            hour_cos,
            semi_sin,
            semi_cos,
            lag3,
            lag6,
            lag12,
            lag24,
            roll_mean,
            roll_max,
            slope6,
        ],
        dtype=np.float32,
    )
