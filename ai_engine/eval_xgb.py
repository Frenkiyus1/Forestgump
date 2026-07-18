"""Đánh giá độ chính xác (accuracy) của model XGBoost đã train — ĐỘC LẬP với
train_xgb.py, chạy được bất cứ lúc nào sau khi có models/*.xgb.json, không
cần train lại.

QUAN TRỌNG VỀ Ý NGHĨA CON SỐ: vì model được distill từ chính rule engine
(risk_engine.compute_risk) trên dữ liệu TỔNG HỢP (xem train_xgb.py) — "nhãn
đúng" ở đây LÀ rule engine, không phải quan trắc thật. Accuracy cao (gần
100%) chỉ chứng minh XGBoost tái tạo được các ngưỡng if/threshold đã xác
nhận, KHÔNG chứng minh bản thân ngưỡng đó đúng với thời tiết Điện Biên thật
(dự án chưa có dữ liệu quan trắc lịch sử — xem docs/architecture.md mục 5,
mục 7). Khi có dữ liệu quan trắc thật, cần viết lại evaluate() để đọc tập
dữ liệu đó thay vì sinh tổng hợp — KHÔNG chỉ dựa vào con số ở đây để kết
luận model đã sẵn sàng dùng cho cảnh báo thật.

Tập test dùng seed KHÁC train_xgb.py (RANDOM_SEED + 1) để không trùng dữ
liệu đã train, tránh accuracy ảo do data leakage.

Chạy:
    python eval_xgb.py                     # 10,000 mẫu tổng hợp, in báo cáo
    python eval_xgb.py --samples 20000 --save-report models/eval_report.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

# Console Windows (cp1252) không in được tiếng Việt -> ép UTF-8 cho an toàn
# (cùng cách xử lý với train.py/train_flood.py trong project).
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    mean_absolute_error,
)

import ml_engine
from risk_engine import ForecastInput, Hazard, LocationInput, Terrain, compute_risk
from train_xgb import HAZARDS, RANDOM_SEED, sample_scenario


def evaluate(n_samples: int) -> dict:
    if not ml_engine._registry.is_ready:
        raise SystemExit(
            f"Model XGBoost chưa sẵn sàng: {ml_engine._registry.load_error}\n"
            "Chạy `python train_xgb.py` trước rồi thử lại."
        )

    rng = np.random.default_rng(RANDOM_SEED + 1)  # seed khác train_xgb.py -> tập test độc lập
    print(f"Sinh {n_samples} mẫu test (seed khác tập train) + gán nhãn bằng rule engine...")

    # Dùng CHUNG sample_scenario với train_xgb.py (chỉ khác seed) để phân phối
    # lấy mẫu không lệch giữa train và eval — sinh kịch bản thô (không chỉ
    # feature vector) để vừa build_features vừa tính risk_score tham chiếu.
    forecasts_meta: list[tuple[ForecastInput, Terrain]] = [
        sample_scenario(rng) for _ in range(n_samples)
    ]

    # 1 lượt duy nhất qua toàn bộ mẫu: tính nhãn+score rule engine (nguồn tham
    # chiếu) và dự đoán XGBoost cho cả 3 hiểm hoạ cùng lúc, tránh gọi
    # compute_risk() lặp lại nhiều lần cho cùng 1 mẫu.
    true_labels: dict[Hazard, list[str]] = {hazard: [] for hazard in HAZARDS}
    true_scores: dict[Hazard, list[float]] = {hazard: [] for hazard in HAZARDS}
    pred_labels: dict[Hazard, list[str]] = {hazard: [] for hazard in HAZARDS}
    pred_scores: dict[Hazard, list[float]] = {hazard: [] for hazard in HAZARDS}

    for forecast, terrain in forecasts_meta:
        location = LocationInput(code="synthetic", name="Synthetic", elevation_m=500.0, terrain=terrain)
        rule_risk = compute_risk(location, forecast)
        for hazard_risk in rule_risk.hazards:
            true_labels[hazard_risk.hazard].append(hazard_risk.alert_level)
            true_scores[hazard_risk.hazard].append(hazard_risk.risk_score)
        for hazard in HAZARDS:
            pred_label, pred_score, _proba = ml_engine.predict_hazard_ml(forecast, terrain, hazard)
            pred_labels[hazard].append(pred_label)
            pred_scores[hazard].append(pred_score)

    report: dict = {"n_samples": n_samples, "hazards": {}}

    for hazard in HAZARDS:
        y_true, y_pred = true_labels[hazard], pred_labels[hazard]
        acc = accuracy_score(y_true, y_pred)
        labels_sorted = ml_engine._registry.models[hazard].classes
        cm = confusion_matrix(y_true, y_pred, labels=labels_sorted)
        mae = mean_absolute_error(true_scores[hazard], pred_scores[hazard])

        print(f"\n{'=' * 70}\nHIỂM HOẠ: {hazard}\n{'=' * 70}")
        print(f"Accuracy (agreement với rule engine) trên {n_samples} mẫu test MỚI: {acc:.4f}")
        print(f"MAE risk_score (XGBoost vs rule engine, thang 0-100): {mae:.2f}")
        print(f"\nClassification report (lớp: {labels_sorted}):")
        print(classification_report(y_true, y_pred, labels=labels_sorted, digits=4, zero_division=0))
        print(f"Confusion matrix (hàng=thật/rule engine, cột=dự đoán/XGBoost, thứ tự {labels_sorted}):")
        print(cm)

        report["hazards"][hazard] = {
            "accuracy": round(float(acc), 4),
            "mae_risk_score": round(float(mae), 2),
            "labels": labels_sorted,
            "confusion_matrix": cm.tolist(),
        }

    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Đánh giá accuracy model XGBoost (Forestgump AI Engine)")
    parser.add_argument("--samples", type=int, default=10000, help="số mẫu test tổng hợp")
    parser.add_argument("--save-report", type=str, default=None, help="đường dẫn lưu report JSON")
    args = parser.parse_args()

    report = evaluate(args.samples)

    if args.save_report:
        out_path = Path(args.save_report)
        out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\nĐã lưu báo cáo: {out_path}")

    print(
        "\nLƯU Ý: accuracy trên đo mức độ XGBoost tái tạo đúng RULE ENGINE trên dữ liệu "
        "TỔNG HỢP, không phải độ chính xác so với thời tiết Điện Biên thật (chưa có CSDL "
        "quan trắc lịch sử — xem docs/architecture.md)."
    )


if __name__ == "__main__":
    main()
