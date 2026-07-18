"""Test cho bulletin.py — chạy: python -m unittest test_bulletin."""

import unittest

from bulletin import generate_bulletin
from risk_engine import HazardRisk, LocationInput, RiskAssessment

LOCATION = LocationInput(code="muong-nhe", name="Xã Mường Nhé", elevation_m=540.0, terrain="ven_suoi")


def _risk(*hazards: HazardRisk) -> RiskAssessment:
    return RiskAssessment(location_code=LOCATION.code, date="2026-07-17", hazards=list(hazards))


class TestGenerateBulletin(unittest.TestCase):
    def test_all_green_returns_normal_message(self):
        risk = _risk(
            HazardRisk(hazard="hail", alert_level="green", risk_score=0, detail="x"),
            HazardRisk(hazard="landslide", alert_level="green", risk_score=0, detail="x"),
            HazardRisk(hazard="heavy_rain_flood", alert_level="green", risk_score=0, detail="x"),
            HazardRisk(hazard="fog", alert_level="green", risk_score=0, detail="x"),
        )
        text = generate_bulletin(LOCATION, risk)
        self.assertIn("bình thường", text)
        self.assertIn(LOCATION.name, text)

    def test_red_flood_includes_mandated_action_phrase(self):
        risk = _risk(
            HazardRisk(hazard="heavy_rain_flood", alert_level="red", risk_score=95, detail="x"),
        )
        text = generate_bulletin(LOCATION, risk)
        self.assertIn("Không qua suối/ngầm tràn", text)
        self.assertIn(LOCATION.name, text)
        self.assertIn("2026-07-17", text)

    def test_only_non_green_hazards_are_included(self):
        risk = _risk(
            HazardRisk(hazard="hail", alert_level="green", risk_score=0, detail="x"),
            HazardRisk(hazard="fog", alert_level="red", risk_score=90, detail="x"),
        )
        text = generate_bulletin(LOCATION, risk)
        lines = text.split("\n")
        self.assertEqual(len(lines), 1)
        self.assertIn("SƯƠNG MÙ DÀY ĐẶC", text)

    def test_multiple_hazards_each_get_own_line(self):
        risk = _risk(
            HazardRisk(hazard="landslide", alert_level="yellow", risk_score=40, detail="x"),
            HazardRisk(hazard="heavy_rain_flood", alert_level="orange", risk_score=70, detail="x"),
        )
        text = generate_bulletin(LOCATION, risk)
        self.assertEqual(len(text.split("\n")), 2)

    def test_unsupported_lang_falls_back_to_vi(self):
        risk = _risk(HazardRisk(hazard="landslide", alert_level="red", risk_score=90, detail="x"))
        text = generate_bulletin(LOCATION, risk, lang="th")
        self.assertIn("SẠT LỞ ĐẤT", text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
