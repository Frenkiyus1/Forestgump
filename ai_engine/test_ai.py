"""Test cho AI Engine — chạy: python -m unittest test_ai  (hoặc python test_ai.py).

Phủ 2 phần:
  - features.build_features: đúng số chiều + lag/roll/slope tính chính xác.
  - predict(): smoke test trả về 2 forecast là số hữu hạn (cả mock lẫn model).
Dùng unittest (thư viện chuẩn) nên không cần cài thêm.
"""

import math
import unittest

import numpy as np

from features import FEATURE_NAMES, build_features

HOUR = 3600


class TestFeatures(unittest.TestCase):
    def _series(self, n=49):
        """Chuỗi giờ chính xác: ec[i] = i để dễ kiểm tra lag/roll."""
        ts = np.arange(n, dtype=float) * HOUR
        ec = np.arange(n, dtype=float)
        temp = np.full(n, 28.0)
        level = np.full(n, 1.4)
        return ts, ec, temp, level

    def test_feature_length_matches_names(self):
        feats = build_features(*self._series())
        self.assertEqual(len(feats), len(FEATURE_NAMES))

    def test_lags_and_stats_exact(self):
        ts, ec, temp, level = self._series()  # now = ec[48] = 48
        feats = dict(zip(FEATURE_NAMES, build_features(ts, ec, temp, level)))
        self.assertAlmostEqual(feats["ec"], 48.0, places=4)
        self.assertAlmostEqual(feats["ec_lag_24h"], 24.0, places=4)  # 48 - 24h
        self.assertAlmostEqual(feats["ec_lag_6h"], 42.0, places=4)
        self.assertAlmostEqual(feats["ec_roll_max_24h"], 48.0, places=4)  # max của 24..48
        self.assertAlmostEqual(feats["ec_roll_mean_24h"], 36.0, places=4)  # mean 24..48
        self.assertAlmostEqual(feats["ec_slope_6h"], 1.0, places=4)  # (48-42)/6

    def test_short_history_does_not_crash(self):
        ts = np.array([0.0])
        one = np.array([2.0])
        feats = build_features(ts, one, np.array([28.0]), np.array([1.4]))
        self.assertEqual(len(feats), len(FEATURE_NAMES))
        self.assertTrue(all(math.isfinite(v) for v in feats))


class TestPredict(unittest.TestCase):
    def test_predict_returns_two_finite_forecasts(self):
        # Import trong hàm để chỉ nạp app/model khi chạy test này.
        from app import PredictRequest, Reading, predict

        history = [
            Reading(ts=f"2026-06-30T{h:02d}:00:00Z", temp=28.0, ec=2.0, level=1.4)
            for h in range(24)
        ]
        res = predict(PredictRequest(history=history))
        self.assertTrue(math.isfinite(res.forecast_24h))
        self.assertTrue(math.isfinite(res.forecast_48h))


if __name__ == "__main__":
    unittest.main(verbosity=2)
