"""Huấn luyện 3 model XGBoost (rét đậm/rét hại, mưa lớn/lũ quét, sương mù)
cho AI Engine.

VÌ SAO TRAIN TRÊN DỮ LIỆU TỔNG HỢP: dự án CHƯA có CSDL lịch sử thiên tai
Điện Biên (xem docs/architecture.md mục 5), nên chưa thể học trực tiếp từ
quan trắc thật. Bước MVP này DISTILL rule engine đã xác nhận
(risk_engine.compute_risk + thresholds.py) vào XGBoost: sinh ngẫu nhiên các
kịch bản thời tiết phủ kín không gian đặc trưng, gán nhãn alert_level bằng
rule engine, rồi train model phân loại. Model vì vậy tái tạo hành vi ngưỡng
đã kiểm chứng (agreement ~99%) và SẴN SÀNG học lại trên dữ liệu thật: khi có
quan trắc, thay generate_synthetic_dataset() bằng bước đọc CSV nhãn thật và
chạy lại script này — toàn bộ inference (ml_engine.py) giữ nguyên.

Chạy:  python train_xgb.py [--samples 40000] [--out models]
Kết quả: models/{hazard}.xgb.json + models/metadata.json (bắt buộc phải có
để ml_engine.py giải mã lớp dự đoán).
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import xgboost as xgb
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split

from ml_features import FEATURE_NAMES, build_features
from risk_engine import ForecastInput, Hazard, LocationInput, Terrain, compute_risk

# Console Windows (cp1252) không in được tiếng Việt -> ép UTF-8 cho an toàn
# (cùng cách xử lý với train.py/train_flood.py trong project).
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

HAZARDS: list[Hazard] = ["cold_damage", "heavy_rain_flood", "fog"]
TERRAINS: list[Terrain] = ["thung_lung", "nui_cao", "ven_suoi"]

RANDOM_SEED = 42


def generate_synthetic_dataset(
    n_samples: int, rng: np.random.Generator
) -> tuple[np.ndarray, dict[Hazard, list[str]]]:
    """Sinh kịch bản thời tiết ngẫu nhiên + gán nhãn bằng rule engine.

    Phạm vi lấy mẫu chọn để phủ đủ cả 4 band cảnh báo của từng hiểm hoạ
    (vd. mưa lấy mẫu tới 600mm/24h để có đủ mẫu vượt ngưỡng đỏ 400mm).

    Returns:
        (X [n_samples x len(FEATURE_NAMES)], nhãn alert_level theo hazard).
    """
    features: list[list[float]] = []
    labels: dict[Hazard, list[str]] = {hazard: [] for hazard in HAZARDS}

    for i in range(n_samples):
        temp_min = float(rng.uniform(-5.0, 32.0))
        temp_max = temp_min + float(rng.uniform(0.0, 12.0))
        avg_temp = (temp_min + temp_max) / 2.0

        # 50% mưa nhỏ 0-80mm (phân giải mịn quanh ngưỡng vàng 100mm),
        # 50% trải 0-600mm để phủ ngưỡng cam 200mm / đỏ 400mm.
        if rng.random() < 0.5:
            precipitation = float(rng.uniform(0.0, 80.0))
        else:
            precipitation = float(rng.uniform(0.0, 600.0))

        # rain_12h chỉ có ở ~50% mẫu, giống thực tế pipeline Phase 1 chưa
        # luôn cung cấp — để model học cách xử lý missing.
        rain_12h = (
            float(rng.uniform(0.3, 0.7) * precipitation) if rng.random() < 0.5 else None
        )

        dew_spread = float(rng.uniform(0.0, 10.0))
        forecast = ForecastInput(
            date="2026-01-01",
            temp_min_c=round(temp_min, 2),
            temp_max_c=round(temp_max, 2),
            precipitation_mm=round(precipitation, 2),
            humidity_pct=round(float(rng.uniform(30.0, 100.0)), 2),
            dew_point_c=round(avg_temp - dew_spread, 2),
            wind_speed_kmh=round(float(rng.uniform(0.0, 60.0)), 2),
            rain_12h_mm=round(rain_12h, 2) if rain_12h is not None else None,
        )
        terrain: Terrain = TERRAINS[int(rng.integers(0, len(TERRAINS)))]
        location = LocationInput(
            code="synthetic", name="Synthetic", elevation_m=500.0, terrain=terrain
        )

        # elevation_grid_m=None -> compute_risk không hiệu chỉnh cao độ (delta=0),
        # nên nhãn ứng đúng với nhiệt độ trong feature vector.
        risk = compute_risk(location, forecast)
        for hazard_risk in risk.hazards:
            labels[hazard_risk.hazard].append(hazard_risk.alert_level)

        features.append(build_features(forecast, terrain))

    return np.array(features, dtype=np.float32), labels


def train_hazard_model(
    X: np.ndarray, y_raw: list[str], hazard: Hazard
) -> tuple[xgb.XGBClassifier, list[str], float]:
    """Train 1 model XGBoost multi-class cho 1 hiểm hoạ.

    Returns:
        (model, danh sách lớp theo thứ tự mã hoá, accuracy trên tập test).
    """
    classes = sorted(set(y_raw))  # thứ tự cố định (alphabet) — lưu vào metadata
    class_to_idx = {c: i for i, c in enumerate(classes)}
    y = np.array([class_to_idx[label] for label in y_raw], dtype=np.int32)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_SEED, stratify=y
    )

    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.1,
        objective="multi:softprob",
        num_class=len(classes),
        tree_method="hist",
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    accuracy = float(accuracy_score(y_test, y_pred))
    print(f"\n=== {hazard} — agreement với rule engine (tập test): {accuracy:.4f} ===")
    print(classification_report(y_test, y_pred, target_names=classes, digits=4))
    return model, classes, accuracy


def main() -> None:
    parser = argparse.ArgumentParser(description="Train XGBoost cho AI Engine Forestgump")
    parser.add_argument("--samples", type=int, default=40000, help="số mẫu tổng hợp")
    parser.add_argument("--out", type=str, default="models", help="thư mục lưu model")
    args = parser.parse_args()

    out_dir = Path(__file__).parent / args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(RANDOM_SEED)
    print(f"Sinh {args.samples} kịch bản thời tiết tổng hợp + gán nhãn bằng rule engine...")
    X, labels = generate_synthetic_dataset(args.samples, rng)

    metadata: dict = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "n_samples": args.samples,
        "feature_names": FEATURE_NAMES,
        "label_source": "rule_engine_distillation",  # đổi khi train trên dữ liệu quan trắc thật
        "hazards": {},
    }

    for hazard in HAZARDS:
        model, classes, accuracy = train_hazard_model(X, labels[hazard], hazard)
        model_path = out_dir / f"{hazard}.xgb.json"
        model.get_booster().save_model(str(model_path))
        metadata["hazards"][hazard] = {
            "model_file": model_path.name,
            "classes": classes,
            "test_accuracy": round(accuracy, 4),
        }
        print(f"Đã lưu {model_path}")

    metadata_path = out_dir / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nĐã lưu {metadata_path}")
    print("Xong. Khởi động lại service (uvicorn app:app) để dùng model mới.")


if __name__ == "__main__":
    main()
