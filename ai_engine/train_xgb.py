"""Huấn luyện 4 model XGBoost (mưa đá, sạt lở đất, mưa lớn/lũ quét, sương mù)
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

HAZARDS: list[Hazard] = ["hail", "landslide", "heavy_rain_flood", "fog"]
TERRAINS: list[Terrain] = ["thung_lung", "nui_cao", "ven_suoi"]

RANDOM_SEED = 42


def sample_scenario(rng: np.random.Generator) -> tuple[ForecastInput, Terrain]:
    """Sinh 1 kịch bản thời tiết ngẫu nhiên phủ kín không gian đặc trưng.

    DÙNG CHUNG giữa train_xgb.py và eval_xgb.py (eval dùng seed khác) để 2 nơi
    không lệch phân phối lấy mẫu. Phạm vi chọn để phủ đủ cả 4 band cảnh báo
    của từng hiểm hoạ (vd. mưa tới 600mm/24h vượt ngưỡng đỏ 400mm; tầm nhìn
    xuống 10m dưới ngưỡng sương mù dày 50m).
    """
    temp_min = float(rng.uniform(-5.0, 32.0))
    temp_max = temp_min + float(rng.uniform(0.0, 12.0))
    avg_temp = (temp_min + temp_max) / 2.0

    # 50% mưa nhỏ 0-80mm (phân giải mịn quanh ngưỡng vàng 100mm),
    # 50% trải 0-600mm để phủ ngưỡng cam 200mm / đỏ 400mm.
    if rng.random() < 0.5:
        precipitation = float(rng.uniform(0.0, 80.0))
    else:
        precipitation = float(rng.uniform(0.0, 600.0))

    humidity = float(rng.uniform(30.0, 100.0))
    dew_spread = float(rng.uniform(0.0, 10.0))
    wind_speed = float(rng.uniform(0.0, 60.0))

    # Nhóm trường hourly có/không CÙNG NHAU (~85% có) — khớp thực tế pipeline:
    # nguồn Open-Meteo cung cấp đủ, nguồn dự phòng OpenWeatherMap thiếu hết.
    # Nhóm này gồm cả đầu vào mưa đá (CAPE/mực đóng băng/mưa đối lưu) và sạt
    # lở đất (mưa 3 ngày/độ ẩm đất tầng rễ) — thiếu thì rule engine trả green
    # "chưa đánh giá được", model học đúng hành vi đó qua NaN.
    has_hourly = rng.random() < 0.85
    if has_hourly:
        rain_12h = float(rng.uniform(0.3, 0.7) * precipitation)
        rain_1h = float(rng.uniform(0.1, 0.5) * rain_12h)
        # 45% mẫu tập trung 10m-2km (phân giải mịn quanh ngưỡng WMO 50m/1000m),
        # còn lại trải tới 25km (trời quang).
        if rng.random() < 0.45:
            visibility = float(rng.uniform(10.0, 2000.0))
        else:
            visibility = float(rng.uniform(1000.0, 25000.0))
        dew_spread_min = float(dew_spread * rng.uniform(0.0, 1.0))
        humidity_max = float(rng.uniform(humidity, 100.0))
        wind_gusts = float(wind_speed * rng.uniform(1.0, 2.5))
        soil_moisture = float(rng.uniform(0.02, 0.55))
        # Mưa đá: 50% CAPE thấp 0-1000 (mịn quanh ngưỡng yếu 500), còn lại
        # 0-4000 phủ ngưỡng vừa 1500 / mạnh 2500. Mực đóng băng 2500-5500m
        # phủ 2 ngưỡng 3500/4500m; 30% mưa đối lưu 0-2mm mịn quanh gate 1mm.
        if rng.random() < 0.5:
            cape = float(rng.uniform(0.0, 1000.0))
        else:
            cape = float(rng.uniform(0.0, 4000.0))
        freezing_level = float(rng.uniform(2500.0, 5500.0))
        if rng.random() < 0.3:
            showers = float(rng.uniform(0.0, 2.0))
        else:
            showers = float(rng.uniform(0.0, 50.0))
        # Sạt lở: 50% mưa 3 ngày 0-150mm (mịn quanh ngưỡng vàng 100mm), còn
        # lại 0-600mm phủ ngưỡng cam 200 / đỏ 350mm. Độ ẩm đất tầng rễ
        # 0.05-0.55 phủ 2 ngưỡng 0.25/0.35 m³/m³.
        if rng.random() < 0.5:
            rain_3d = float(rng.uniform(0.0, 150.0))
        else:
            rain_3d = float(rng.uniform(0.0, 600.0))
        soil_moisture_root = float(rng.uniform(0.05, 0.55))
    else:
        rain_12h = rain_1h = visibility = None
        dew_spread_min = humidity_max = wind_gusts = soil_moisture = None
        cape = freezing_level = showers = rain_3d = soil_moisture_root = None

    forecast = ForecastInput(
        date="2026-01-01",
        temp_min_c=round(temp_min, 2),
        temp_max_c=round(temp_max, 2),
        precipitation_mm=round(precipitation, 2),
        humidity_pct=round(humidity, 2),
        dew_point_c=round(avg_temp - dew_spread, 2),
        wind_speed_kmh=round(wind_speed, 2),
        rain_12h_mm=round(rain_12h, 2) if rain_12h is not None else None,
        rain_1h_mm=round(rain_1h, 2) if rain_1h is not None else None,
        visibility_min_m=round(visibility, 1) if visibility is not None else None,
        dew_spread_min_c=round(dew_spread_min, 2) if dew_spread_min is not None else None,
        humidity_max_pct=round(humidity_max, 2) if humidity_max is not None else None,
        wind_gusts_kmh=round(wind_gusts, 2) if wind_gusts is not None else None,
        soil_moisture_0_1=round(soil_moisture, 3) if soil_moisture is not None else None,
        cape_max_jkg=round(cape, 1) if cape is not None else None,
        freezing_level_min_m=round(freezing_level, 1) if freezing_level is not None else None,
        showers_sum_mm=round(showers, 2) if showers is not None else None,
        soil_moisture_9_to_27cm=round(soil_moisture_root, 3) if soil_moisture_root is not None else None,
        rain_3d_mm=round(rain_3d, 2) if rain_3d is not None else None,
    )
    terrain: Terrain = TERRAINS[int(rng.integers(0, len(TERRAINS)))]
    return forecast, terrain


def generate_synthetic_dataset(
    n_samples: int, rng: np.random.Generator
) -> tuple[np.ndarray, dict[Hazard, list[str]]]:
    """Sinh kịch bản thời tiết ngẫu nhiên (sample_scenario) + gán nhãn bằng
    rule engine.

    Returns:
        (X [n_samples x len(FEATURE_NAMES)], nhãn alert_level theo hazard).
    """
    features: list[list[float]] = []
    labels: dict[Hazard, list[str]] = {hazard: [] for hazard in HAZARDS}

    for _ in range(n_samples):
        forecast, terrain = sample_scenario(rng)
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
    # Tách thêm tập validation từ tập train cho early stopping — tập test giữ
    # nguyên chỉ dùng đánh giá cuối, tránh rò rỉ vào quá trình chọn số cây.
    X_fit, X_val, y_fit, y_val = train_test_split(
        X_train, y_train, test_size=0.1, random_state=RANDOM_SEED, stratify=y_train
    )

    # Nhiều cây + learning rate thấp hơn bản cũ, bù bằng early stopping trên
    # tập validation -> ranh giới ngưỡng sắc nét hơn mà không overfit.
    model = xgb.XGBClassifier(
        n_estimators=800,
        max_depth=7,
        learning_rate=0.07,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="multi:softprob",
        num_class=len(classes),
        tree_method="hist",
        eval_metric="mlogloss",
        early_stopping_rounds=40,
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    model.fit(X_fit, y_fit, eval_set=[(X_val, y_val)], verbose=False)

    y_pred = model.predict(X_test)
    accuracy = float(accuracy_score(y_test, y_pred))
    print(f"\n=== {hazard} — agreement với rule engine (tập test): {accuracy:.4f} ===")
    print(classification_report(y_test, y_pred, target_names=classes, digits=4))
    return model, classes, accuracy


def main() -> None:
    parser = argparse.ArgumentParser(description="Train XGBoost cho AI Engine Forestgump")
    parser.add_argument("--samples", type=int, default=60000, help="số mẫu tổng hợp")
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
