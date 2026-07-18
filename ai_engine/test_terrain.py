"""Test nhánh ML #3 — rủi ro sạt lở/lũ quét theo xã (terrain_features.py,
terrain_engine.py, live_features.py, endpoint /assess-terrain-risk*).

Toàn bộ test chạy OFFLINE: phần live API chỉ test các hàm parse thuần
(parse_open_meteo_rain/flood) trên payload giả — không gọi mạng.
"""

from __future__ import annotations

import math
from datetime import datetime

from fastapi.testclient import TestClient

from app import app
from live_features import parse_open_meteo_flood, parse_open_meteo_rain
from terrain_engine import get_registry, predict_terrain_risk
from terrain_features import (
    TERRAIN_FEATURE_NAMES,
    build_terrain_features,
    load_communes,
    risk_score_to_level,
)

client = TestClient(app)


# --- terrain_features -------------------------------------------------------


def test_load_communes_du_130_xa_ten_duy_nhat():
    communes = load_communes()
    assert len(communes) == 130
    assert "Mường Phăng" in communes
    record = communes["Mường Phăng"]
    assert 20.0 < record.centroid_lat < 23.0
    assert 102.0 < record.centroid_lon < 104.0
    # Cấp cảnh báo trong CSV phải khớp ngưỡng quy đổi từ risk score.
    for c in communes.values():
        assert risk_score_to_level(c.baseline_risk_satlo) == c.baseline_level_satlo
        assert risk_score_to_level(c.baseline_risk_luquet) == c.baseline_level_luquet


def test_risk_score_to_level_nguong_02_04_06_08():
    assert risk_score_to_level(0.0) == 1
    assert risk_score_to_level(0.19) == 1
    assert risk_score_to_level(0.2) == 2
    assert risk_score_to_level(0.39) == 2
    assert risk_score_to_level(0.4) == 3
    assert risk_score_to_level(0.6) == 4
    assert risk_score_to_level(0.8) == 5
    assert risk_score_to_level(1.0) == 5


def test_build_terrain_features_dung_thu_tu_va_do_dai():
    commune = load_communes()["Mường Phăng"]
    features = build_terrain_features(
        commune, rain_1h_mm=1.0, rain_24h_mm=10.0, rain_72h_mm=50.0, rain_next_24h_mm=5.0
    )
    assert len(features) == len(TERRAIN_FEATURE_NAMES)
    assert features[0] == commune.slope_mean
    assert features[1] == math.log1p(commune.flow_accum_max)
    assert math.isnan(features[4])  # elevation_m=None -> NaN
    assert features[5:] == [1.0, 10.0, 50.0, 5.0]


# --- live_features (parse thuần, offline) ----------------------------------


def _fake_open_meteo_payload() -> dict:
    # Mốc "now" = 18/07 12:00. Quá khứ (15/07 00:00 → 18/07 11:00, 84 giờ)
    # mưa 1mm/h; tương lai (18/07 12:00 → 19/07 23:00, 36 giờ) mưa 2mm/h.
    times, precip, soil = [], [], []
    for day in (15, 16, 17, 18, 19):
        for hour in range(24):
            times.append(f"2026-07-{day:02d}T{hour:02d}:00")
            is_past = day < 18 or (day == 18 and hour < 12)
            precip.append(1.0 if is_past else 2.0)
            soil.append(0.3)
    return {
        "hourly": {"time": times, "precipitation": precip, "soil_moisture_0_to_7cm": soil},
        "daily": {"precipitation_probability_max": [40, 85]},
    }


def test_parse_open_meteo_rain_cat_dung_qua_khu_tuong_lai():
    now = datetime.fromisoformat("2026-07-18T12:30:00")
    rain = parse_open_meteo_rain(_fake_open_meteo_payload(), now=now)
    assert rain.rain_1h_mm == 1.0  # giờ cuối cùng đã qua: 18/07 11:00
    assert rain.rain_24h_mm == 24.0  # 24h × 1mm
    assert rain.rain_72h_mm == 72.0
    assert rain.rain_next_24h_mm == 48.0  # 24h tới × 2mm (18/07 12:00 →)
    assert rain.soil_moisture_0_7cm == 0.3
    assert rain.precip_prob_max_next_24h_pct == 85.0


def test_parse_open_meteo_flood():
    flood = parse_open_meteo_flood({"daily": {"river_discharge": [10.0, None, 25.5, 12.0]}})
    assert flood.river_discharge_m3s == 10.0
    assert flood.river_discharge_max_7d_m3s == 25.5
    empty = parse_open_meteo_flood({"daily": {"river_discharge": []}})
    assert empty.river_discharge_m3s is None


# --- terrain_engine + endpoint ---------------------------------------------


def test_predict_terrain_risk_khong_raise_va_score_hop_le():
    commune = load_communes()["Mường Phăng"]
    result = predict_terrain_risk(
        commune, rain_1h_mm=0.3, rain_24h_mm=12.4, rain_72h_mm=59.5, rain_next_24h_mm=6.7
    )
    for target in ("satlo", "luquet"):
        prediction = result[target]
        assert 0.0 <= prediction.risk_score <= 1.0
        assert 1 <= prediction.warning_level <= 5
        assert prediction.mode in ("model", "csv_baseline")
        assert prediction.warning_level == risk_score_to_level(prediction.risk_score)


def test_endpoint_terrain_communes_tra_du_130_xa():
    response = client.get("/terrain-communes")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 130
    assert {"name", "centroid_lat", "baseline_warning_satlo"} <= set(body[0].keys())


def test_endpoint_assess_terrain_risk_mua_mac_dinh_tu_csv():
    response = client.post("/assess-terrain-risk", json={"commune": "Mường Phăng"})
    assert response.status_code == 200
    body = response.json()
    assert body["commune"] == "Mường Phăng"
    # Không truyền mưa -> dùng snapshot CSV của chính xã đó.
    assert body["rain_used_mm"]["rain_24h_mm"] == 12.4
    for target in ("satlo", "luquet"):
        assert 0.0 <= body[target]["risk_score"] <= 1.0
        assert 1 <= body[target]["warning_level"] <= 5


def test_endpoint_assess_terrain_risk_xa_khong_ton_tai_404():
    response = client.post("/assess-terrain-risk", json={"commune": "Xã Không Tồn Tại"})
    assert response.status_code == 404


def test_model_da_train_thi_mode_la_model():
    # Sau khi chạy train_terrain.py (models/terrain/ tồn tại) endpoint phải
    # dùng model thật; chưa train thì test này vẫn pass với csv_baseline.
    response = client.post("/assess-terrain-risk", json={"commune": "Hẹ Muông"})
    expected_mode = "model" if get_registry().is_ready() else "csv_baseline"
    assert response.json()["satlo"]["mode"] == expected_mode
