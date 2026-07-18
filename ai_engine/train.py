"""Huấn luyện model XGBoost dự báo độ mặn 24h & 48h.

Vì chưa có dữ liệu quan trắc thật, script SINH dữ liệu tổng hợp dựa trên vật lý
thuỷ văn (nhật triều 24h + bán nhật 12h + chu kỳ triều cường/kém ~14 ngày +
mùa khô/mưa + trôi ngẫu nhiên + nhiễu). Sau đó trượt cửa sổ để tạo mẫu
(đặc trưng tại t -> EC tại t+24h, t+48h) và train 2 Booster.

Chạy:
    python train.py                # ghi xgboost_model.json + xgboost_model_48h.json
    python train.py --out models/  # ghi vào thư mục models/

Lưu ý: model học theo dữ liệu MÔ PHỎNG nên dùng cho demo/đồ án; muốn chính xác
ngoài đời cần thay generate_station_series bằng dữ liệu đo thật.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone

import numpy as np
import xgboost as xgb

from features import FEATURE_NAMES, build_features

# Console Windows (cp1252) không in được tiếng Việt -> ép UTF-8 cho an toàn.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

HOUR = 3600
DAY = 24


def generate_station_series(
    seed: int, days: int, start_ts: int
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Sinh chuỗi quan trắc theo giờ cho 1 trạm tổng hợp."""
    rng = np.random.default_rng(seed)
    n = days * DAY
    t = np.arange(n)
    phase = rng.uniform(0, 2 * np.pi)
    base = rng.uniform(0.3, 3.0)

    tide = 0.9 * np.sin(2 * np.pi * t / 24 + phase) + 0.3 * np.sin(2 * np.pi * t / 12 + phase)
    spring_neap = 0.6 * np.sin(2 * np.pi * t / (24 * 14) + phase)
    seasonal = 0.8 * np.sin(2 * np.pi * t / (24 * 365) + phase)
    drift = np.cumsum(rng.normal(0, 0.02, n))
    drift -= drift.mean()

    ec = np.clip(base + tide + spring_neap + seasonal + drift + rng.normal(0, 0.1, n), 0, None)
    temp = 27 + 2 * np.sin(2 * np.pi * t / 24 + phase) + 1.5 * seasonal + rng.normal(0, 0.3, n)
    level = np.clip(1.2 + 0.4 * np.sin(2 * np.pi * t / 24 + phase) + rng.normal(0, 0.05, n), 0, None)
    ts = start_ts + t * HOUR
    return ts, ec, temp, level


def build_dataset(
    num_series: int, days: int, step: int
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Trượt cửa sổ trên các chuỗi tổng hợp -> (X, y24h, y48h)."""
    # Bắt đầu từ nửa đêm UTC để pha thuỷ triều khớp giờ-trong-ngày (feature dùng).
    start_ts = int(datetime(2023, 1, 1, tzinfo=timezone.utc).timestamp())
    x_rows: list[np.ndarray] = []
    y24: list[float] = []
    y48: list[float] = []

    for s in range(num_series):
        ts, ec, temp, level = generate_station_series(s, days, start_ts)
        n = len(ts)
        # Cần >=48h lịch sử (cho lag/roll) và +48h tương lai (cho nhãn).
        for i in range(48, n - 48, step):
            w = slice(i - 48, i + 1)
            x_rows.append(build_features(ts[w], ec[w], temp[w], level[w]))
            y24.append(float(ec[i + 24]))
            y48.append(float(ec[i + 48]))

    return np.array(x_rows, dtype=np.float32), np.array(y24), np.array(y48)


def train_one(x: np.ndarray, y: np.ndarray, label: str) -> xgb.Booster:
    """Train 1 Booster với chia train/val và early stopping; in RMSE val."""
    rng = np.random.default_rng(42)
    idx = rng.permutation(len(x))
    cut = int(len(x) * 0.85)
    tr, va = idx[:cut], idx[cut:]

    dtrain = xgb.DMatrix(x[tr], label=y[tr], feature_names=FEATURE_NAMES)
    dval = xgb.DMatrix(x[va], label=y[va], feature_names=FEATURE_NAMES)

    params = {
        "objective": "reg:squarederror",
        "eval_metric": "rmse",
        "max_depth": 6,
        "eta": 0.1,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
    }
    booster = xgb.train(
        params,
        dtrain,
        num_boost_round=600,
        evals=[(dval, "val")],
        early_stopping_rounds=30,
        verbose_eval=False,
    )
    pred = booster.predict(dval)
    rmse = float(np.sqrt(np.mean((pred - y[va]) ** 2)))
    print(f"[train] {label}: val RMSE = {rmse:.3f} g/L (best_iteration={booster.best_iteration})")
    return booster


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=".", help="Thư mục ghi file model")
    parser.add_argument("--series", type=int, default=30, help="Số trạm tổng hợp")
    parser.add_argument("--days", type=int, default=730, help="Số ngày mỗi trạm")
    parser.add_argument("--step", type=int, default=2, help="Bước trượt cửa sổ (giờ)")
    args = parser.parse_args()

    print(f"[train] Sinh dữ liệu: {args.series} trạm x {args.days} ngày, step={args.step}h ...")
    x, y24, y48 = build_dataset(args.series, args.days, args.step)
    print(f"[train] Số mẫu: {len(x)}, số feature: {x.shape[1]}")

    os.makedirs(args.out, exist_ok=True)
    model24 = train_one(x, y24, "24h")
    model48 = train_one(x, y48, "48h")

    p24 = os.path.join(args.out, "xgboost_model.json")
    p48 = os.path.join(args.out, "xgboost_model_48h.json")
    model24.save_model(p24)
    model48.save_model(p48)
    print(f"[train] Đã lưu: {p24} , {p48}")


if __name__ == "__main__":
    main()
