import os
import numpy as np
import pandas as pd

def generate_synthetic_telecom_dataset(num_samples: int = 1000, seed: int = 42) -> pd.DataFrame:
    """
    Turkcell telko ortamına uygun 1000+ sentetik abone verisi ve dönüşüm etiketleri üretir.
    """
    np.random.seed(seed)

    data_usage = np.random.gamma(shape=2.5, scale=8.0, size=num_samples) # GB
    voice_min = np.random.normal(loc=600, scale=200, size=num_samples).clip(min=50) # Dakika
    spend_try = (data_usage * 15.0) + (voice_min * 0.2) + np.random.normal(loc=50, scale=30, size=num_samples)
    spend_try = spend_try.clip(min=80)
    tenure_months = np.random.randint(1, 120, size=num_samples)

    past_accepted = np.random.poisson(lam=1.5, size=num_samples)
    past_rejected = np.random.poisson(lam=1.0, size=num_samples)
    complaint_count = np.random.poisson(lam=0.4, size=num_samples)
    data_usage_trend = np.random.normal(loc=5.0, scale=25.0, size=num_samples) # % trend

    # Segment Etiketi Kuralları (Ground Truth Simulation)
    segments = []
    priorities = []
    conversions = []

    for i in range(num_samples):
        d_gb = data_usage[i]
        spend = spend_try[i]
        tenure = tenure_months[i]
        trend = data_usage_trend[i]
        complaints = complaint_count[i]
        accepted = past_accepted[i]
        rejected = past_rejected[i]

        # Segment Belirleme
        if complaints >= 2 or trend < -20.0:
            segment = "RISKLI_KAYIP"
            priority = "KRITIK" if complaints >= 3 else "YUKSEK"
            conv_prob = 0.35 + (accepted * 0.05) - (rejected * 0.1)
        elif spend >= 350.0 or d_gb >= 30.0:
            segment = "YUKSEK_DEGER"
            priority = "YUKSEK"
            conv_prob = 0.70 + (accepted * 0.05)
        elif tenure <= 3:
            segment = "YENI_ABONE"
            priority = "ORTA"
            conv_prob = 0.55
        elif d_gb <= 4.0 and spend <= 120.0:
            segment = "PASIF"
            priority = "DUSUK"
            conv_prob = 0.40
        else:
            segment = "BELIRSIZ"
            priority = "ORTA"
            conv_prob = 0.50

        # Noise eklenmiş dönüşüm etiketleme (0 veya 1)
        conv_prob = np.clip(conv_prob, 0.1, 0.95)
        converted = 1 if np.random.rand() < conv_prob else 0

        segments.append(segment)
        priorities.append(priority)
        conversions.append(converted)

    df = pd.DataFrame({
        'monthly_data_usage_gb': data_usage,
        'monthly_voice_min': voice_min,
        'monthly_spend_try': spend_try,
        'tenure_months': tenure_months,
        'past_accepted_count': past_accepted,
        'past_rejected_count': past_rejected,
        'complaint_count': complaint_count,
        'data_usage_trend_pct': data_usage_trend,
        'target_segment': segments,
        'target_priority': priorities,
        'is_converted': conversions,
    })

    return df


def _turkish_profile_description(row) -> str:
    """Her satır için gerçekçi Türkçe abone profili açıklaması üretir (Case §5.1)."""
    parts = []
    parts.append(f"{int(row['tenure_months'])} aylık abone")
    parts.append(f"aylık {row['monthly_data_usage_gb']:.1f} GB veri ve {int(row['monthly_voice_min'])} dk konuşma")
    parts.append(f"ortalama {row['monthly_spend_try']:.0f} TL harcama (ARPU)")
    if row['complaint_count'] >= 2:
        parts.append(f"{int(row['complaint_count'])} şikayet kaydı (memnuniyetsiz)")
    if row['data_usage_trend_pct'] < -20:
        parts.append(f"veri kullanımı %{abs(row['data_usage_trend_pct']):.0f} düşüşte (churn sinyali)")
    if row['past_accepted_count'] >= 2:
        parts.append(f"geçmişte {int(row['past_accepted_count'])} teklif kabul etmiş sadık müşteri")
    return ", ".join(parts) + "."


def export_dataset_csv(path: str, num_samples: int = 1200, seed: int = 42) -> str:
    """
    Eğitim/test veri setini Türkçe profil açıklamalarıyla birlikte CSV olarak diske yazar.
    Repository'de paylaşılan eğitim verisini üretmek için kullanılır (Case §5.1 bonus).
    """
    df = generate_synthetic_telecom_dataset(num_samples=num_samples, seed=seed)
    df.insert(0, 'profile_description_tr', df.apply(_turkish_profile_description, axis=1))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    df.to_csv(path, index=False, encoding='utf-8')
    return path


if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "..", "data", "training_dataset.csv")
    export_dataset_csv(os.path.abspath(out))
    print(f"Dataset yazıldı: {out}")
