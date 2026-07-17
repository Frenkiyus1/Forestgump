"""[OPTIONAL / DEMO] Huấn luyện model XGBoost dự báo XÁC SUẤT lũ quét.

⚠️ DEMO/ĐỒ ÁN: chưa có dữ liệu thiên tai lịch sử thật cho Điện Biên (xem
docs/dienbien-phase1.md — chưa tìm được CSDL công khai của Ban Chỉ huy PCTT).
Script này SINH dữ liệu tổng hợp bằng 1 rule đơn giản (cường độ mưa + hệ số
địa hình từ thresholds.TERRAIN_FLOOD_MULTIPLIER + nhiễu ngẫu nhiên), không
phải dữ liệu quan trắc thật. KHÔNG dùng model này để ra quyết định thực tế
cho tới khi thay build_dataset() bằng dữ liệu lịch sử thật.

compute_risk() trong risk_engine.py (rule-based, dùng ngưỡng đã xác nhận) vẫn
là nguồn đánh giá rủi ro CHÍNH — model này chỉ bổ sung tham khảo qua endpoint
POST /predict-flood-risk (app.py).

Chạy:
    python train_flood.py                # ghi flood_model.json
    python train_flood.py --out models/  # ghi vào thư mục models/
"""

from __future__ import annotations

import argparse
import os
import sys

import numpy as np
import xgboost as xgb

from thresholds import TERRAIN_FLOOD_MULTIPLIER

# Console Windows (cp1252) không in được tiếng Việt -> ép UTF-8 cho an toàn.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

# Thứ tự feature CỐ ĐỊNH — phải giữ nguyên giữa train và serve (app.py).
FEATURE_NAMES: list[str] = [
    "rain_24h_mm",
    "rain_12h_mm",
    "terrain_multiplier",
    "elevation_m",
    "humidity_pct",
]

TERRAIN_CHOICES: list[str] = list(TERRAIN_FLOOD_MULTIPLIER.keys())


def build_flood_features(
    rain_24h_mm: float, rain_12h_mm: float, terrain: str, elevation_m: float, humidity_pct: float
) -> np.ndarray:
    """Vector đặc trưng cho model lũ quét — DÙNG CHUNG giữa train_flood.py và app.py."""
    terrain_multiplier = TERRAIN_FLOOD_MULTIPLIER.get(terrain, 1.0)
    return np.array(
        [rain_24h_mm, rain_12h_mm, terrain_multiplier, elevation_m, humidity_pct], dtype=np.float32
    )


def _true_flood_probability(rain_24h: float, rain_12h: float, terrain_multiplier: float) -> float:
    """Hàm xác suất "thật" DÙNG ĐỂ SINH NHÃN DỮ LIỆU TỔNG HỢP.

    KHÔNG phải công thức khí tượng đã thẩm định — chỉ là 1 rule hợp lý (mưa
    càng lớn + địa hình càng dốc/ven suối thì xác suất càng cao, dạng sigmoid)
    để tạo dữ liệu huấn luyện demo có hình dạng thực tế.
    """
    intensity = max(rain_24h, rain_12h * 1.5) * terrain_multiplier
    # Sigmoid quanh mốc 150mm (giữa dải cấp 1-2 theo ngưỡng Điều 44 đã xác nhận).
    return float(1.0 / (1.0 + np.exp(-(intensity - 150.0) / 40.0)))


def build_dataset(n_samples: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    """Sinh dữ liệu tổng hợp (X, y) — KHÔNG phải dữ liệu quan trắc thật."""
    rng = np.random.default_rng(seed)
    rain_24h = rng.uniform(0, 500, n_samples)
    rain_12h = np.clip(rain_24h * rng.uniform(0.3, 0.7, n_samples), 0, None)
    terrains = rng.choice(TERRAIN_CHOICES, n_samples)
    elevation = rng.uniform(400, 1500, n_samples)
    humidity = rng.uniform(50, 100, n_samples)

    x_rows: list[np.ndarray] = []
    y: list[float] = []
    for i in range(n_samples):
        terrain_multiplier = TERRAIN_FLOOD_MULTIPLIER[terrains[i]]
        x_rows.append(
            build_flood_features(
                float(rain_24h[i]), float(rain_12h[i]), str(terrains[i]), float(elevation[i]), float(humidity[i])
            )
        )
        prob = _true_flood_probability(float(rain_24h[i]), float(rain_12h[i]), terrain_multiplier)
        y.append(1.0 if rng.uniform() < prob else 0.0)

    return np.array(x_rows, dtype=np.float32), np.array(y, dtype=np.float32)


def train_flood_model(x: np.ndarray, y: np.ndarray) -> xgb.Booster:
    """Train 1 Booster phân loại nhị phân (binary:logistic) với chia train/val."""
    rng = np.random.default_rng(42)
    idx = rng.permutation(len(x))
    cut = int(len(x) * 0.85)
    tr, va = idx[:cut], idx[cut:]

    dtrain = xgb.DMatrix(x[tr], label=y[tr], feature_names=FEATURE_NAMES)
    dval = xgb.DMatrix(x[va], label=y[va], feature_names=FEATURE_NAMES)

    params = {
        "objective": "binary:logistic",
        "eval_metric": "logloss",
        "max_depth": 4,
        "eta": 0.1,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
    }
    booster = xgb.train(
        params,
        dtrain,
        num_boost_round=300,
        evals=[(dval, "val")],
        early_stopping_rounds=20,
        verbose_eval=False,
    )
    pred = booster.predict(dval)
    acc = float(np.mean((pred > 0.5) == y[va]))
    print(f"[train_flood] val accuracy = {acc:.3f} (best_iteration={booster.best_iteration})")
    return booster


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=".", help="Thư mục ghi file model")
    parser.add_argument("--samples", type=int, default=20000, help="Số mẫu tổng hợp")
    args = parser.parse_args()

    print(f"[train_flood] Sinh {args.samples} mẫu tổng hợp (DEMO, không phải dữ liệu thật)...")
    x, y = build_dataset(args.samples, seed=42)
    print(f"[train_flood] Tỉ lệ nhãn 'có lũ quét' trong dữ liệu tổng hợp: {y.mean():.1%}")

    os.makedirs(args.out, exist_ok=True)
    model = train_flood_model(x, y)
    path = os.path.join(args.out, "flood_model.json")
    model.save_model(path)
    print(f"[train_flood] Đã lưu: {path}")


if __name__ == "__main__":
    main()
