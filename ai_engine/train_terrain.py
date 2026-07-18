"""Huấn luyện 2 model XGBoost hồi quy risk score SẠT LỞ + LŨ QUÉT theo xã
từ dữ liệu thật docs/dienbien_risk_theo_xa.csv (130 xã Điện Biên: đặc trưng
địa hình DEM + mưa quan trắc/dự báo + risk score & cấp cảnh báo 1-5).

Khác 2 nhánh ML cũ (train_flood.py, train_xgb.py — dữ liệu TỔNG HỢP), nhánh
này train trên bảng đặc trưng địa hình THẬT tính từ DEM cho từng xã; tuy
nhiên nhãn risk_satlo/risk_luquet trong CSV vẫn là chỉ số mô hình hoá (chưa
phải thống kê thiệt hại lịch sử), nên model phục vụ THAM KHẢO qua endpoint
/assess-terrain-risk — compute_risk() (rule engine) vẫn là nguồn quyết định
chính của /assess-risk.

Với 130 mẫu, script dùng 5-fold cross-validation để báo cáo R²/MAE trung
thực, sau đó train model cuối trên toàn bộ dữ liệu.

Chạy:
    python train_terrain.py                    # ghi models/terrain/
    python train_terrain.py --fetch-elevation  # + gọi Open-Meteo Elevation API
                                               # lấy độ cao 130 xã (cache
                                               # data/commune_elevation.json)
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import xgboost as xgb

from terrain_features import (
    ELEVATION_CACHE_PATH,
    TERRAIN_FEATURE_NAMES,
    CommuneRecord,
    build_terrain_features,
    load_communes,
    load_elevation_cache,
    risk_score_to_level,
)

# Console Windows (cp1252) không in được tiếng Việt -> ép UTF-8 cho an toàn.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

MODELS_DIR = Path(__file__).parent / "models" / "terrain"
TARGETS: dict[str, str] = {"satlo": "sạt lở đất", "luquet": "lũ quét"}

_XGB_PARAMS = {
    "objective": "reg:squarederror",
    "eval_metric": "mae",
    # Dataset nhỏ (130 xã) -> cây nông + học chậm + regularization để tránh
    # overfit; đã kiểm bằng 5-fold CV bên dưới.
    "max_depth": 3,
    "eta": 0.05,
    "subsample": 0.9,
    "colsample_bytree": 0.9,
    "min_child_weight": 4,
    "lambda": 2.0,
}
_NUM_ROUNDS = 400


def build_matrix(
    communes: list[CommuneRecord], elevation_by_name: dict[str, float]
) -> np.ndarray:
    """Ma trận đặc trưng (n_xã × n_feature) theo đúng thứ tự TERRAIN_FEATURE_NAMES."""
    rows = [
        build_terrain_features(
            c,
            rain_1h_mm=c.rain_1h_mm,
            rain_24h_mm=c.rain_24h_mm,
            rain_72h_mm=c.rain_72h_mm,
            rain_next_24h_mm=c.rain_next_24h_mm,
            elevation_m=elevation_by_name.get(c.name),
        )
        for c in communes
    ]
    return np.array(rows, dtype=np.float32)


def cross_validate(x: np.ndarray, y: np.ndarray, seed: int = 42, k: int = 5) -> dict:
    """5-fold CV — trả R²/MAE trung bình để báo cáo trung thực trên 130 mẫu."""
    rng = np.random.default_rng(seed)
    idx = rng.permutation(len(x))
    folds = np.array_split(idx, k)
    r2_scores: list[float] = []
    mae_scores: list[float] = []
    level_accuracy: list[float] = []

    for i in range(k):
        va = folds[i]
        tr = np.concatenate([folds[j] for j in range(k) if j != i])
        dtrain = xgb.DMatrix(x[tr], label=y[tr], feature_names=TERRAIN_FEATURE_NAMES)
        dval = xgb.DMatrix(x[va], label=y[va], feature_names=TERRAIN_FEATURE_NAMES)
        booster = xgb.train(
            _XGB_PARAMS, dtrain, num_boost_round=_NUM_ROUNDS,
            evals=[(dval, "val")], early_stopping_rounds=30, verbose_eval=False,
        )
        pred = booster.predict(dval)
        residual = y[va] - pred
        ss_res = float(np.sum(residual**2))
        ss_tot = float(np.sum((y[va] - float(np.mean(y[va]))) ** 2))
        r2_scores.append(1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0)
        mae_scores.append(float(np.mean(np.abs(residual))))
        level_accuracy.append(
            float(np.mean([
                risk_score_to_level(float(p)) == risk_score_to_level(float(t))
                for p, t in zip(pred, y[va])
            ]))
        )

    return {
        "cv_folds": k,
        "r2_mean": round(float(np.mean(r2_scores)), 3),
        "mae_mean": round(float(np.mean(mae_scores)), 4),
        "level_accuracy_mean": round(float(np.mean(level_accuracy)), 3),
    }


def train_final(x: np.ndarray, y: np.ndarray) -> xgb.Booster:
    """Train model cuối trên TOÀN BỘ 130 xã (CV ở trên đã ước lượng sai số)."""
    dtrain = xgb.DMatrix(x, label=y, feature_names=TERRAIN_FEATURE_NAMES)
    return xgb.train(_XGB_PARAMS, dtrain, num_boost_round=_NUM_ROUNDS, verbose_eval=False)


def maybe_fetch_elevation(communes: list[CommuneRecord], fetch: bool) -> dict[str, float]:
    """Trả {tên xã -> độ cao (m)}: ưu tiên cache; --fetch-elevation thì gọi
    Open-Meteo Elevation API (2 call cho 130 xã) và ghi lại cache."""
    cache = load_elevation_cache()
    if cache and not fetch:
        print(f"[train_terrain] Dùng cache độ cao có sẵn ({len(cache)} xã): {ELEVATION_CACHE_PATH}")
        return cache
    if not fetch:
        print("[train_terrain] Chưa có cache độ cao — elevation_m = NaN "
              "(chạy với --fetch-elevation để lấy từ Open-Meteo Elevation API).")
        return {}

    from live_features import fetch_elevations  # import muộn: chỉ cần httpx khi fetch

    print("[train_terrain] Gọi Open-Meteo Elevation API cho "
          f"{len(communes)} xã (batch 100 điểm/call)...")
    elevations = fetch_elevations([(c.centroid_lat, c.centroid_lon) for c in communes])
    cache = {c.name: round(e, 1) for c, e in zip(communes, elevations)}
    ELEVATION_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(ELEVATION_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=1)
    print(f"[train_terrain] Đã cache độ cao: {ELEVATION_CACHE_PATH}")
    return cache


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fetch-elevation", action="store_true",
                        help="Gọi Open-Meteo Elevation API lấy độ cao 130 xã rồi cache lại")
    args = parser.parse_args()

    communes = list(load_communes().values())
    print(f"[train_terrain] Nạp {len(communes)} xã từ dienbien_risk_theo_xa.csv")
    elevation_by_name = maybe_fetch_elevation(communes, args.fetch_elevation)

    x = build_matrix(communes, elevation_by_name)
    labels = {
        "satlo": np.array([c.baseline_risk_satlo for c in communes], dtype=np.float32),
        "luquet": np.array([c.baseline_risk_luquet for c in communes], dtype=np.float32),
    }

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    metadata: dict = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "n_communes": len(communes),
        "feature_names": TERRAIN_FEATURE_NAMES,
        "has_elevation": bool(elevation_by_name),
        "source_csv": "docs/dienbien_risk_theo_xa.csv",
        "targets": {},
    }

    for target, label_vn in TARGETS.items():
        y = labels[target]
        metrics = cross_validate(x, y)
        print(f"[train_terrain] {label_vn}: CV R²={metrics['r2_mean']} "
              f"MAE={metrics['mae_mean']} đúng-cấp={metrics['level_accuracy_mean']:.0%}")
        booster = train_final(x, y)
        path = MODELS_DIR / f"{target}.xgb.json"
        booster.save_model(str(path))
        gain = booster.get_score(importance_type="gain")
        top = sorted(gain.items(), key=lambda kv: kv[1], reverse=True)[:4]
        print(f"[train_terrain]   top feature (gain): "
              + ", ".join(f"{name}={score:.2f}" for name, score in top))
        metadata["targets"][target] = {"model_file": path.name, **metrics}
        print(f"[train_terrain]   đã lưu {path}")

    with open(MODELS_DIR / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=1)
    print(f"[train_terrain] Đã lưu metadata: {MODELS_DIR / 'metadata.json'}")


if __name__ == "__main__":
    main()
