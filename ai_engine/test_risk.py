"""Test cho thresholds.py + risk_engine.py — chạy: python -m unittest test_risk."""

import math
import unittest

from risk_engine import ForecastInput, LocationInput, compute_risk
from thresholds import (
    classify_cold_damage,
    classify_fog,
    classify_heavy_rain_flood_risk,
)


class TestThresholds(unittest.TestCase):
    """Đối chiếu 1-1 với backend/src/alert-dienbien.test.ts (phải khớp)."""

    def test_classify_cold_damage(self):
        self.assertEqual(classify_cold_damage(13), "red")
        self.assertEqual(classify_cold_damage(13.1), "yellow")
        self.assertEqual(classify_cold_damage(15), "yellow")
        self.assertEqual(classify_cold_damage(15.1), "green")

    def test_classify_heavy_rain_flood_risk(self):
        self.assertEqual(classify_heavy_rain_flood_risk(400.1), "red")
        self.assertEqual(classify_heavy_rain_flood_risk(200.1), "orange")
        self.assertEqual(classify_heavy_rain_flood_risk(100), "yellow")
        self.assertEqual(classify_heavy_rain_flood_risk(80, 50), "yellow")
        self.assertEqual(classify_heavy_rain_flood_risk(80, 49.9), "green")
        self.assertEqual(classify_heavy_rain_flood_risk(0), "green")

    def test_classify_fog(self):
        self.assertEqual(classify_fog(49.9), "red")
        self.assertEqual(classify_fog(50), "yellow")
        self.assertEqual(classify_fog(999.9), "yellow")
        self.assertEqual(classify_fog(1000), "green")


def _location(terrain: str = "thung_lung", elevation_m: float = 482.0) -> LocationInput:
    return LocationInput(code="dbp", name="Phường Điện Biên Phủ", elevation_m=elevation_m, terrain=terrain)


def _forecast(**overrides) -> ForecastInput:
    base = dict(
        date="2026-07-17",
        temp_min_c=23.0,
        temp_max_c=27.0,
        precipitation_mm=10.0,
        humidity_pct=80.0,
        dew_point_c=20.0,
        wind_speed_kmh=5.0,
    )
    base.update(overrides)
    return ForecastInput(**base)


class TestComputeRisk(unittest.TestCase):
    def test_returns_all_three_hazards(self):
        risk = compute_risk(_location(), _forecast())
        hazards = {h.hazard for h in risk.hazards}
        self.assertEqual(hazards, {"cold_damage", "heavy_rain_flood", "fog"})

    def test_all_scores_in_range_and_finite(self):
        risk = compute_risk(_location(), _forecast())
        for h in risk.hazards:
            self.assertTrue(math.isfinite(h.risk_score))
            self.assertGreaterEqual(h.risk_score, 0.0)
            self.assertLessEqual(h.risk_score, 100.0)

    def test_cold_hazard_matches_threshold_on_corrected_temp(self):
        # 20°C ở lưới, độ cao lưới == độ cao địa điểm -> không hiệu chỉnh -> vẫn 20°C -> green.
        risk = compute_risk(_location(), _forecast(temp_min_c=19.0, temp_max_c=21.0))
        cold = next(h for h in risk.hazards if h.hazard == "cold_damage")
        self.assertEqual(cold.alert_level, "green")

    def test_elevation_correction_can_push_into_cold_damage(self):
        # Cùng nhiệt độ lưới nhưng địa điểm cao hơn nhiều (Tủa Chùa, 871m) so với
        # lưới tham chiếu ở mực nước biển -> hiệu chỉnh giảm nhiệt đáng kể.
        loc = _location(terrain="nui_cao", elevation_m=871.0)
        forecast = _forecast(temp_min_c=18.0, temp_max_c=18.0, elevation_grid_m=0.0)
        risk = compute_risk(loc, forecast)
        cold = next(h for h in risk.hazards if h.hazard == "cold_damage")
        # 871m * 0.65/100m ~= 5.66°C giảm -> 18 - 5.66 ~= 12.3°C -> rét hại.
        self.assertEqual(cold.alert_level, "red")

    def test_heavy_rain_red_for_extreme_rain(self):
        risk = compute_risk(_location(), _forecast(precipitation_mm=500.0))
        rain = next(h for h in risk.hazards if h.hazard == "heavy_rain_flood")
        self.assertEqual(rain.alert_level, "red")

    def test_terrain_multiplier_can_escalate_flood_level(self):
        # Mưa ở biên trên của dải "yellow" (gần 200mm) -> ở địa hình phẳng vẫn
        # yellow, nhưng ở ven suối (hệ số x1.3) đủ đẩy điểm sang dải "orange".
        flat = compute_risk(_location(terrain="thung_lung"), _forecast(precipitation_mm=195.0))
        stream = compute_risk(_location(terrain="ven_suoi"), _forecast(precipitation_mm=195.0))
        flat_rain = next(h for h in flat.hazards if h.hazard == "heavy_rain_flood")
        stream_rain = next(h for h in stream.hazards if h.hazard == "heavy_rain_flood")
        self.assertEqual(flat_rain.alert_level, "yellow")
        self.assertEqual(stream_rain.alert_level, "orange")
        self.assertGreater(stream_rain.risk_score, flat_rain.risk_score)

    def test_valley_terrain_increases_fog_score(self):
        common = dict(humidity_pct=92.0, dew_point_c=19.5, temp_min_c=19.0, temp_max_c=20.5)
        valley = compute_risk(_location(terrain="thung_lung"), _forecast(**common))
        mountain = compute_risk(_location(terrain="nui_cao"), _forecast(**common))
        valley_fog = next(h for h in valley.hazards if h.hazard == "fog")
        mountain_fog = next(h for h in mountain.hazards if h.hazard == "fog")
        self.assertGreater(valley_fog.risk_score, mountain_fog.risk_score)

    def test_fog_uses_forecast_visibility_when_available(self):
        # Không khí khô (hệ số heuristic ~0) nhưng model dự báo tầm nhìn 30m
        # (< 50m WMO) -> phải cảnh báo đỏ theo tín hiệu tầm nhìn.
        dry = dict(humidity_pct=50.0, dew_point_c=12.0, temp_min_c=22.0, temp_max_c=28.0)
        risk = compute_risk(_location(), _forecast(**dry, visibility_min_m=30.0))
        fog = next(h for h in risk.hazards if h.hazard == "fog")
        self.assertEqual(fog.alert_level, "red")

    def test_fog_visibility_bands_follow_wmo(self):
        dry = dict(humidity_pct=50.0, dew_point_c=12.0, temp_min_c=22.0, temp_max_c=28.0)
        for visibility, expected in [(30.0, "red"), (500.0, "yellow"), (5000.0, "green")]:
            risk = compute_risk(_location(), _forecast(**dry, visibility_min_m=visibility))
            fog = next(h for h in risk.hazards if h.hazard == "fog")
            self.assertEqual(fog.alert_level, expected, f"visibility={visibility}")

    def test_fog_heuristic_escalates_max_one_level_over_visibility(self):
        # Tầm nhìn dự báo quang (green) nhưng độ ẩm bão hoà + chênh nhiệt-điểm
        # sương ~0 (hệ số heuristic đỏ) -> chỉ nâng 1 cấp (green -> yellow),
        # KHÔNG nhảy thẳng đỏ — đêm mùa ẩm nhiệt đới gần như luôn bão hoà, cho
        # heuristic quyền phủ quyết tầm nhìn sẽ báo động giả quanh năm.
        saturated = dict(humidity_pct=98.0, dew_point_c=19.8, temp_min_c=19.5, temp_max_c=20.5)
        risk = compute_risk(_location(), _forecast(**saturated, visibility_min_m=20000.0))
        fog = next(h for h in risk.hazards if h.hazard == "fog")
        self.assertEqual(fog.alert_level, "yellow")

    def test_fog_score_stays_inside_level_band(self):
        # Điểm bị kẹp về band của level cuối — không được ở band đỏ khi level yellow.
        saturated = dict(humidity_pct=98.0, dew_point_c=19.8, temp_min_c=19.5, temp_max_c=20.5)
        risk = compute_risk(_location(), _forecast(**saturated, visibility_min_m=20000.0))
        fog = next(h for h in risk.hazards if h.hazard == "fog")
        self.assertGreaterEqual(fog.risk_score, 25.0)
        self.assertLess(fog.risk_score, 60.0)

    def test_fog_hourly_night_inputs_beat_daily_means(self):
        # Trung bình ngày khô (spread 6°C) nhưng ban đêm chạm bão hoà
        # (dew_spread_min ~0.3°C, độ ẩm max 99%) -> hệ số heuristic phải bắt được.
        risk = compute_risk(
            _location(),
            _forecast(
                humidity_pct=70.0,
                dew_point_c=16.0,
                temp_min_c=20.0,
                temp_max_c=24.0,
                dew_spread_min_c=0.3,
                humidity_max_pct=99.0,
            ),
        )
        fog = next(h for h in risk.hazards if h.hazard == "fog")
        self.assertEqual(fog.alert_level, "red")

    def test_rain_12h_from_hourly_triggers_yellow(self):
        # Mưa 24h dưới ngưỡng 100mm nhưng dồn 60mm trong 12h (>= 50mm/12h) -> yellow.
        risk = compute_risk(_location(), _forecast(precipitation_mm=80.0, rain_12h_mm=60.0))
        rain = next(h for h in risk.hazards if h.hazard == "heavy_rain_flood")
        self.assertEqual(rain.alert_level, "yellow")

    def test_no_history_edge_values_do_not_crash(self):
        loc = _location(elevation_m=0.0)
        forecast = _forecast(
            temp_min_c=0.0, temp_max_c=0.0, precipitation_mm=0.0, humidity_pct=100.0, dew_point_c=0.0
        )
        risk = compute_risk(loc, forecast)
        self.assertEqual(len(risk.hazards), 3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
