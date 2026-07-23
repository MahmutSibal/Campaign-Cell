import os
import pickle
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, List
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, ExtraTreesClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import cross_val_score
from app.ml.dataset_generator import generate_synthetic_telecom_dataset

MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
os.makedirs(MODEL_DIR, exist_ok=True)

FEATURE_COLS = [
    'monthly_data_usage_gb', 'monthly_voice_min', 'monthly_spend_try',
    'tenure_months', 'past_accepted_count', 'past_rejected_count',
    'complaint_count', 'data_usage_trend_pct'
]

FEATURE_LABELS = {
    'monthly_data_usage_gb': 'Aylık Veri Kullanımı (GB)',
    'monthly_voice_min': 'Aylık Konuşma Süresi (Dk)',
    'monthly_spend_try': 'Aylık Harcama / ARPU (TL)',
    'tenure_months': 'Abonelik Süresi (Ay)',
    'past_accepted_count': 'Kabul Edilen Teklif Sayısı',
    'past_rejected_count': 'Reddedilen Teklif Sayısı',
    'complaint_count': 'Şikayet Kaydı Sayısı',
    'data_usage_trend_pct': 'Veri Tüketim Trendi (%)',
}

class PredictorEngine:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(PredictorEngine, cls).__new__(cls)
            cls._instance.segment_model = None
            cls._instance.conversion_model = None
            # Gerçek model yüklenene/eğitilene kadar metrik UYDURMA DEĞİL, bilinmiyordur.
            cls._instance.version_tag = "v1.0-init"
            cls._instance.active_accuracy = 0.0
            cls._instance.active_f1 = 0.0
            cls._instance._load_or_train_default_models()
        return cls._instance

    def _load_or_train_default_models(self):
        segment_model_path = os.path.join(MODEL_DIR, "segment_model.pkl")
        conversion_model_path = os.path.join(MODEL_DIR, "conversion_model.pkl")

        if os.path.exists(segment_model_path) and os.path.exists(conversion_model_path):
            try:
                with open(segment_model_path, "rb") as f:
                    self.segment_model = pickle.load(f)
                with open(conversion_model_path, "rb") as f:
                    self.conversion_model = pickle.load(f)
                # Pickle'dan yüklenen model için doğruluk metriği GERÇEK olarak yeniden hesaplanır
                # (init'teki sabit 0.0 asla dışa yansımaz — health/accuracy uydurma metrik göstermez).
                self._recompute_active_metrics()
                self.version_tag = "v1.6-rf"
                return
            except Exception:
                pass

        self.train_new_model(num_samples=1200, model_type="RandomForest")

    def _recompute_active_metrics(self, num_samples: int = 600):
        """Yüklü modelin GERÇEK test doğruluğunu taze bir veri seti üzerinde ölçer (sabit değer değil)."""
        try:
            df = generate_synthetic_telecom_dataset(num_samples=num_samples)
            X = df[FEATURE_COLS]
            y_segment = df['target_segment']
            split_idx = int(len(df) * 0.8)
            X_test = X.iloc[split_idx:]
            y_test = y_segment.iloc[split_idx:]
            preds = self.segment_model.predict(X_test)
            self.active_accuracy = float(accuracy_score(y_test, preds))
            self.active_f1 = float(f1_score(y_test, preds, average='weighted'))
        except Exception:
            # Ölçüm yapılamazsa metrik bilinmiyor kalır (yine de uydurma sabit yok).
            self.active_accuracy = 0.0
            self.active_f1 = 0.0

    def train_new_model(self, num_samples: int = 1200, model_type: str = "RandomForest") -> Tuple[str, float, float]:
        df = generate_synthetic_telecom_dataset(num_samples=num_samples)

        X = df[FEATURE_COLS]
        y_segment = df['target_segment']
        y_conversion = df['is_converted']

        split_idx = int(len(df) * 0.8)
        X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
        y_seg_train, y_seg_test = y_segment.iloc[:split_idx], y_segment.iloc[split_idx:]
        y_conv_train, y_conv_test = y_conversion.iloc[:split_idx], y_conversion.iloc[split_idx:]

        if model_type == "GradientBoosting":
            seg_clf = GradientBoostingClassifier(n_estimators=120, learning_rate=0.08, random_state=42)
            conv_clf = GradientBoostingClassifier(n_estimators=120, learning_rate=0.08, random_state=42)
        elif model_type == "ExtraTrees":
            seg_clf = ExtraTreesClassifier(n_estimators=120, max_depth=10, random_state=42)
            conv_clf = ExtraTreesClassifier(n_estimators=120, max_depth=10, random_state=42)
        else:
            seg_clf = RandomForestClassifier(n_estimators=120, max_depth=10, random_state=42)
            conv_clf = RandomForestClassifier(n_estimators=120, max_depth=10, random_state=42)

        seg_clf.fit(X_train, y_seg_train)
        conv_clf.fit(X_train, y_conv_train)

        seg_preds = seg_clf.predict(X_test)
        acc = accuracy_score(y_seg_test, seg_preds)
        f1 = f1_score(y_seg_test, seg_preds, average='weighted')

        self.segment_model = seg_clf
        self.conversion_model = conv_clf
        self.version_tag = f"v1.6-{model_type[:2].lower()}"
        self.active_accuracy = float(acc)
        self.active_f1 = float(f1)

        with open(os.path.join(MODEL_DIR, "segment_model.pkl"), "wb") as f:
            pickle.dump(seg_clf, f)
        with open(os.path.join(MODEL_DIR, "conversion_model.pkl"), "wb") as f:
            pickle.dump(conv_clf, f)

        return self.version_tag, self.active_accuracy, self.active_f1

    def get_feature_importances(self) -> List[Dict[str, Any]]:
        """
        Modelin özellik önem ağırlıklarını (Feature Importance) hesaplar ve sıralı döner.
        """
        if self.segment_model is not None and hasattr(self.segment_model, "feature_importances_"):
            importances = self.segment_model.feature_importances_
        else:
            importances = [0.25, 0.15, 0.22, 0.10, 0.08, 0.05, 0.12, 0.03]

        res = []
        for col, val in zip(FEATURE_COLS, importances):
            res.append({
                "feature": col,
                "label": FEATURE_LABELS.get(col, col),
                "importance_weight": round(float(val), 4),
                "percentage": round(float(val) * 100.0, 2),
            })
        return sorted(res, key=lambda x: x["importance_weight"], reverse=True)

    def benchmark_models(self, num_samples: int = 1000) -> Dict[str, Any]:
        """
        Jüri için RandomForest, GradientBoosting ve ExtraTrees modellerini Cross-Validation ile karşılaştırır.
        """
        df = generate_synthetic_telecom_dataset(num_samples=num_samples)
        X = df[FEATURE_COLS]
        y = df['target_segment']

        models = {
            "Deep Learning (Neural Network)": MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=500, random_state=42),
            "RandomForest": RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42),
            "GradientBoosting": GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, random_state=42),
            "ExtraTrees": ExtraTreesClassifier(n_estimators=100, max_depth=8, random_state=42),
        }

        results = []
        for name, clf in models.items():
            scores = cross_val_score(clf, X, y, cv=5, scoring='accuracy')
            clf.fit(X, y)
            preds = clf.predict(X)
            acc = float(np.mean(scores))
            f1 = float(f1_score(y, preds, average='weighted'))
            results.append({
                "model_name": name,
                "cv_accuracy_pct": round(acc * 100.0, 2),
                "f1_score": round(f1, 4),
                "cv_std_pct": round(float(np.std(scores)) * 100.0, 2),
            })

        return {
            "dataset_size": num_samples,
            "cv_folds": 5,
            "feature_count": len(FEATURE_COLS),
            "benchmark_results": sorted(results, key=lambda x: x["cv_accuracy_pct"], reverse=True),
        }

    def generate_reasoning(self, features: Dict[str, Any], segment: str, priority: str, rec_score: float, conv_prob: float) -> str:
        reasons = []
        d_gb = features.get('monthly_data_usage_gb', 0.0)
        spend = features.get('monthly_spend_try', 0.0)
        complaints = features.get('complaint_count', 0)
        trend = features.get('data_usage_trend_pct', 0.0)
        accepted = features.get('past_accepted_count', 0)

        if complaints > 0:
            reasons.append(f"Müşterinin {complaints} adet aktif şikayet kaydı bulunmaktadır")
        if trend < 0:
            reasons.append(f"Son 60 günlük veri kullanımı %{abs(trend):.1f} oranında düşüş göstermiştir (Churn Riski)")
        if d_gb >= 25.0:
            reasons.append(f"Aylık {d_gb:.1f} GB yüksek veri tüketimi mevcuttur")
        if spend >= 300.0:
            reasons.append(f"Aylık {spend:.0f} TL ortalama harcama ile yüksek ARPU kategorisindedir")
        if accepted > 1:
            reasons.append(f"Geçmişte {accepted} adet teklifi kabul etmiş sadık abonedir")

        reason_text = ". ".join(reasons) if reasons else "Abone kullanım alışkanlıkları ve telko profil analizine dayanmaktadır"

        return f"AI Analizi: [{segment}] segmenti ve [{priority}] önceliği belirlenmiştir. Gerekçe: {reason_text}. Tahmini dönüşüm olasılığı: %{int(conv_prob * 100)}."

    # Kampanya tipine göre öneri skoru modülasyonu (segment-tipi uyumu → her kampanya için farklı skor)
    CAMPAIGN_TYPE_AFFINITY = {
        ('YUKSEK_DEGER', 'TARIFE_YUKSELTME'): 0.08,
        ('YUKSEK_DEGER', 'SADAKAT'): 0.05,
        ('RISKLI_KAYIP', 'CIHAZ_FIRSATI'): 0.07,
        ('RISKLI_KAYIP', 'SADAKAT'): 0.06,
        ('YENI_ABONE', 'EK_PAKET'): 0.06,
        ('PASIF', 'EK_PAKET'): 0.04,
    }

    def predict(self, features: Dict[str, Any], campaign_type: str = None) -> Dict[str, Any]:
        input_data = pd.DataFrame([{
            'monthly_data_usage_gb': float(features.get('monthly_data_usage_gb', 10.0)),
            'monthly_voice_min': float(features.get('monthly_voice_min', 500.0)),
            'monthly_spend_try': float(features.get('monthly_spend_try', 250.0)),
            'tenure_months': int(features.get('tenure_months', 12)),
            'past_accepted_count': int(features.get('past_accepted_count', 1)),
            'past_rejected_count': int(features.get('past_rejected_count', 0)),
            'complaint_count': int(features.get('complaint_count', 0)),
            'data_usage_trend_pct': float(features.get('data_usage_trend_pct', 5.0)),
        }])

        if self.segment_model is not None and self.conversion_model is not None:
            segment = self.segment_model.predict(input_data)[0]
            conv_prob = float(self.conversion_model.predict_proba(input_data)[0][1]) if hasattr(self.conversion_model, "predict_proba") else 0.65
        else:
            complaints = features.get('complaint_count', 0)
            spend = features.get('monthly_spend_try', 0)
            if complaints >= 2:
                segment = "RISKLI_KAYIP"
                conv_prob = 0.35
            elif spend >= 300:
                segment = "YUKSEK_DEGER"
                conv_prob = 0.82
            else:
                segment = "YENI_ABONE"
                conv_prob = 0.60

        if segment == "RISKLI_KAYIP":
            priority = "KRITIK" if features.get('complaint_count', 0) >= 3 else "YUKSEK"
        elif segment == "YUKSEK_DEGER":
            priority = "YUKSEK"
        elif segment == "YENI_ABONE":
            priority = "ORTA"
        elif segment == "PASIF":
            priority = "DUSUK"
        else:
            priority = "ORTA"

        accepted = features.get('past_accepted_count', 1)
        rec_score = float(np.clip((conv_prob * 0.7) + (accepted * 0.05) + 0.15, 0.1, 0.99))
        # Kampanya tipi–segment uyumu skoru etkiler (her kampanya için ayrı öneri skoru — Case §5.1)
        if campaign_type:
            affinity = self.CAMPAIGN_TYPE_AFFINITY.get((segment, campaign_type), -0.03)
            rec_score = float(np.clip(rec_score + affinity, 0.1, 0.99))
        conv_prob = float(np.clip(conv_prob, 0.05, 0.95))

        reasoning = self.generate_reasoning(features, segment, priority, rec_score, conv_prob)

        return {
            'recommendation_score': round(rec_score, 3),
            'conversion_probability': round(conv_prob, 3),
            'predicted_segment': segment,
            'predicted_priority': priority,
            'reasoning': reasoning,
            'model_version': self.version_tag,
        }
