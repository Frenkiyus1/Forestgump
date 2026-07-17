"""Test cho downscale.py — chạy: python -m unittest test_downscale."""

import math
import unittest

from downscale import downscale_temperature, fog_risk_factor


class TestDownscaleTemperature(unittest.TestCase):
    def test_higher_elevation_means_colder(self):
        # Cùng temp_grid, elevation_target CAO hơn elevation_grid -> nhiệt độ giảm.
        corrected = downscale_temperature(temp_grid=25.0, elevation_grid=482.0, elevation_target=871.0)
        self.assertLess(corrected, 25.0)

    def test_exact_lapse_rate_math(self):
        # 400m chênh cao, lapse rate mặc định 0.65 -> giảm đúng 2.6°C.
        corrected = downscale_temperature(temp_grid=25.0, elevation_grid=0.0, elevation_target=400.0)
        self.assertAlmostEqual(corrected, 25.0 - 2.6, places=6)

    def test_lower_elevation_means_warmer(self):
        corrected = downscale_temperature(temp_grid=20.0, elevation_grid=871.0, elevation_target=482.0)
        self.assertGreater(corrected, 20.0)

    def test_zero_elevation_diff_no_change(self):
        corrected = downscale_temperature(temp_grid=27.5, elevation_grid=500.0, elevation_target=500.0)
        self.assertAlmostEqual(corrected, 27.5, places=6)

    def test_custom_lapse_rate(self):
        corrected = downscale_temperature(
            temp_grid=25.0, elevation_grid=0.0, elevation_target=1000.0, lapse_rate=1.0
        )
        self.assertAlmostEqual(corrected, 15.0, places=6)

    def test_elevation_zero_does_not_crash(self):
        corrected = downscale_temperature(temp_grid=25.0, elevation_grid=0.0, elevation_target=0.0)
        self.assertTrue(math.isfinite(corrected))
        self.assertAlmostEqual(corrected, 25.0, places=6)


class TestFogRiskFactor(unittest.TestCase):
    def test_saturated_high_humidity_high_risk(self):
        # temp gần dew_point + độ ẩm cao -> hệ số cao.
        factor = fog_risk_factor(humidity=98.0, temp=15.0, dew_point=14.5, terrain_type="nui_cao")
        self.assertGreater(factor, 0.8)

    def test_large_spread_low_humidity_low_risk(self):
        factor = fog_risk_factor(humidity=40.0, temp=25.0, dew_point=10.0, terrain_type="nui_cao")
        self.assertLess(factor, 0.1)

    def test_valley_terrain_increases_risk_factor(self):
        common = dict(humidity=90.0, temp=15.0, dew_point=13.5)
        valley = fog_risk_factor(**common, terrain_type="thung_lung")
        mountain = fog_risk_factor(**common, terrain_type="nui_cao")
        self.assertGreater(valley, mountain)

    def test_humidity_100_does_not_crash(self):
        factor = fog_risk_factor(humidity=100.0, temp=20.0, dew_point=20.0, terrain_type="ven_suoi")
        self.assertTrue(math.isfinite(factor))
        self.assertGreaterEqual(factor, 0.0)

    def test_dew_point_above_temp_does_not_crash(self):
        # Trường hợp dữ liệu nhiễu/làm tròn khiến dew_point > temp -> không crash, spread kẹp về 0.
        factor = fog_risk_factor(humidity=90.0, temp=15.0, dew_point=16.0, terrain_type="thung_lung")
        self.assertTrue(math.isfinite(factor))
        self.assertGreaterEqual(factor, 0.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
