"""Test cho ml_engine.py + POST /assess-risk-ml — chạy: python -m unittest test_ml_engine.

Model multi-hazard (models/*.xgb.json) PHẢI đã train (python train_xgb.py)
để mode="model" — nếu chưa, test vẫn pass (fallback rule engine hợp lệ,
không lỗi 500) nhưng không kiểm được nhánh XGBoost thật.
"""

import unittest

from ml_engine import assess_risk_ml, is_model_ready
from risk_engine import ForecastInput, LocationInput

LOCATION = LocationInput(code="tua-chua", name="Xã Tủa Chùa", elevation_m=871.0, terrain="nui_cao")

FORECAST = ForecastInput(
    date="2026-07-17",
    temp_min_c=11.5,
    temp_max_c=13.0,
    precipitation_mm=250.0,
    humidity_pct=96.0,
    dew_point_c=12.0,
    wind_speed_kmh=4.0,
)


class TestAssessRiskMl(unittest.TestCase):
    def test_returns_3_hazards(self):
        risk = assess_risk_ml(LOCATION, FORECAST)
        self.assertEqual(risk.location_code, LOCATION.code)
        self.assertEqual(risk.date, FORECAST.date)
        self.assertEqual({h.hazard for h in risk.hazards}, {"cold_damage", "heavy_rain_flood", "fog"})

    def test_alert_level_and_score_are_valid(self):
        risk = assess_risk_ml(LOCATION, FORECAST)
        for hazard_risk in risk.hazards:
            self.assertIn(hazard_risk.alert_level, ("green", "yellow", "orange", "red"))
            self.assertGreaterEqual(hazard_risk.risk_score, 0.0)
            self.assertLessEqual(hazard_risk.risk_score, 100.0)

    def test_detail_declares_source(self):
        """detail phải tự khai nguồn (XGBoost hoặc fallback rule engine) —
        nguyên tắc traceability, xem ai_engine/README.md mục 2.6."""
        risk = assess_risk_ml(LOCATION, FORECAST)
        marker = "[XGBoost" if is_model_ready() else "[FALLBACK RULE ENGINE"
        for hazard_risk in risk.hazards:
            self.assertIn(marker, hazard_risk.detail)


class TestAssessRiskMlEndpoint(unittest.TestCase):
    def test_endpoint_matches_direct_call(self):
        from app import AssessRiskRequest, assess_risk_ml_endpoint

        req = AssessRiskRequest(location=LOCATION, forecast=[FORECAST])
        res = assess_risk_ml_endpoint(req)

        self.assertEqual(res.location_code, LOCATION.code)
        self.assertIn(res.mode, ("model", "fallback_rule_engine"))
        self.assertEqual(res.mode, "model" if is_model_ready() else "fallback_rule_engine")
        self.assertEqual(len(res.days), 1)
        self.assertEqual(len(res.days[0].risk.hazards), 3)
        self.assertTrue(res.days[0].bulletin)  # bulletin không rỗng

    def test_endpoint_never_500_on_multi_day(self):
        from app import AssessRiskRequest, assess_risk_ml_endpoint

        other_day = FORECAST.model_copy(update={"date": "2026-07-18", "precipitation_mm": 0.0})
        req = AssessRiskRequest(location=LOCATION, forecast=[FORECAST, other_day])
        res = assess_risk_ml_endpoint(req)
        self.assertEqual(len(res.days), 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
