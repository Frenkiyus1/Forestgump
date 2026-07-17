"""[OPTIONAL/DEMO] Test cho train_flood.py + POST /predict-flood-risk.

Chạy: python -m unittest test_flood
"""

import math
import unittest

from train_flood import FEATURE_NAMES, build_flood_features


class TestBuildFloodFeatures(unittest.TestCase):
    def test_feature_length_matches_names(self):
        feats = build_flood_features(100.0, 50.0, "ven_suoi", 540.0, 90.0)
        self.assertEqual(len(feats), len(FEATURE_NAMES))

    def test_terrain_multiplier_applied(self):
        feats_stream = build_flood_features(100.0, 50.0, "ven_suoi", 540.0, 90.0)
        feats_valley = build_flood_features(100.0, 50.0, "thung_lung", 540.0, 90.0)
        idx = FEATURE_NAMES.index("terrain_multiplier")
        self.assertGreater(feats_stream[idx], feats_valley[idx])

    def test_unknown_terrain_does_not_crash(self):
        feats = build_flood_features(100.0, 50.0, "unknown", 540.0, 90.0)
        self.assertTrue(all(math.isfinite(v) for v in feats))


class TestPredictFloodRiskEndpoint(unittest.TestCase):
    def test_returns_probability_in_range(self):
        from app import PredictFloodRiskRequest, predict_flood_risk

        req = PredictFloodRiskRequest(
            rain_24h_mm=250.0, rain_12h_mm=150.0, terrain="ven_suoi", elevation_m=540.0, humidity_pct=95.0
        )
        res = predict_flood_risk(req)
        self.assertTrue(math.isfinite(res.flood_probability))
        self.assertGreaterEqual(res.flood_probability, 0.0)
        self.assertLessEqual(res.flood_probability, 1.0)
        self.assertIn(res.mode, ("mock", "model"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
