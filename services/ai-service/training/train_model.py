"""
CampaignCell AI Service — model training.

Trains two scikit-learn Logistic Regression models on the synthetic data
produced by generate_data.py:

  1. Segment classifier   (multinomial, 5 classes)
  2. Conversion predictor (binary: subscriber accepts the offer or not)

Both models are linear (StandardScaler + LogisticRegression), chosen
deliberately: ai-service is a Node/TypeScript service with no Python runtime
in its Docker image, so the trained model has to be portable to pure
JS/TS inference. A linear model's parameters (feature means/scales, weight
matrix, intercept) export cleanly to JSON and are reproduced exactly by a
~30-line softmax/sigmoid implementation in services/ai-service/src/lib/mlModel.ts
— no ONNX runtime, no Python sidecar container, no drift between what was
trained and what actually runs in production.

Run: python train_model.py
Output: ../src/ml/model_weights.json + printed accuracy metrics
"""
import json
import os

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

OUT_DIR = os.path.join("..", "src", "ml")
os.makedirs(OUT_DIR, exist_ok=True)

SEGMENT_FEATURES = [
    "monthlySpend", "dataUsageGb", "voiceMinutes",
    "churnRisk", "valueScore", "acceptedCampaigns", "rejectedCampaigns",
    "isNewSubscriber", "isLowUsage",
]

CAMPAIGN_TYPES = ["CIHAZ_FIRSATI", "EK_PAKET", "SADAKAT", "TARIFE_YUKSELTME"]  # alphabetical, fixed order

# ---------------------------------------------------------------------------
# 1) Segment classifier
# ---------------------------------------------------------------------------
def train_segment_model():
    df = pd.read_csv("subscribers.csv")
    df["isNewSubscriber"] = ((df["acceptedCampaigns"] == 0) & (df["rejectedCampaigns"] == 0)).astype(float)
    df["isLowUsage"] = ((df["monthlySpend"] < 60) & (df["dataUsageGb"] < 10)).astype(float)

    X = df[SEGMENT_FEATURES].values
    y = df["segment"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler().fit(X_train)
    X_train_s = scaler.transform(X_train)
    X_test_s = scaler.transform(X_test)

    model = LogisticRegression(max_iter=2000, C=1.0, class_weight="balanced")
    model.fit(X_train_s, y_train)

    y_pred = model.predict(X_test_s)
    acc = accuracy_score(y_test, y_pred)
    print("=== Segment classifier ===")
    print(f"Test accuracy: {acc:.4f}  (n_train={len(X_train)}, n_test={len(X_test)})")
    print(classification_report(y_test, y_pred, zero_division=0))

    return {
        "featureNames": SEGMENT_FEATURES,
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "classes": model.classes_.tolist(),
        "coef": model.coef_.tolist(),
        "intercept": model.intercept_.tolist(),
        "testAccuracy": round(float(acc), 4),
        "nTrain": len(X_train),
        "nTest": len(X_test),
    }


# ---------------------------------------------------------------------------
# 2) Conversion / recommendation model
# ---------------------------------------------------------------------------
def train_conversion_model():
    df = pd.read_csv("subscriber_campaign_interactions.csv")

    df["segmentMatch"] = np.where(
        df["subscriberSegment"] == df["campaignSegment"], 1.0,
        np.where(df["subscriberSegment"] == "BELIRSIZ", 0.5, 0.0),
    )
    for ctype in CAMPAIGN_TYPES:
        df[f"type_{ctype}"] = (df["campaignType"] == ctype).astype(float)

    feature_names = (
        ["monthlySpend", "dataUsageGb", "voiceMinutes", "churnRisk", "valueScore",
         "acceptedCampaigns", "rejectedCampaigns", "discount", "segmentMatch"]
        + [f"type_{c}" for c in CAMPAIGN_TYPES]
    )

    X = df[feature_names].values
    y = df["accepted"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler().fit(X_train)
    X_train_s = scaler.transform(X_train)
    X_test_s = scaler.transform(X_test)

    model = LogisticRegression(max_iter=2000, C=1.0)
    model.fit(X_train_s, y_train)

    y_pred = model.predict(X_test_s)
    acc = accuracy_score(y_test, y_pred)
    print("\n=== Conversion predictor ===")
    print(f"Test accuracy: {acc:.4f}  (n_train={len(X_train)}, n_test={len(X_test)})")
    print(classification_report(y_test, y_pred, zero_division=0))

    return {
        "featureNames": feature_names,
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "coef": model.coef_[0].tolist(),
        "intercept": float(model.intercept_[0]),
        "testAccuracy": round(float(acc), 4),
        "nTrain": len(X_train),
        "nTest": len(X_test),
        "campaignTypes": CAMPAIGN_TYPES,
    }


if __name__ == "__main__":
    segment_model = train_segment_model()
    conversion_model = train_conversion_model()

    weights = {
        "segmentModel": segment_model,
        "conversionModel": conversion_model,
        "trainedAt": pd.Timestamp.utcnow().isoformat(),
    }

    out_path = os.path.join(OUT_DIR, "model_weights.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(weights, f, indent=2)
    print(f"\nWrote {out_path}")
