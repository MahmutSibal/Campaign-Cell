"""
CampaignCell AI Service — synthetic training data generator.

There is no real historical Turkcell subscriber/campaign data available for a
hackathon project, so this script generates a realistic, internally
consistent synthetic dataset for two supervised learning tasks:

  1. subscribers.csv                       -> segment classification
  2. subscriber_campaign_interactions.csv  -> recommendation / conversion scoring

Subscriber profiles are drawn from distributions chosen to look like a real
Turkish telecom base (skewed spend, a churn-risk long tail, mostly-average
value scores). Labels (segment, accept/reject, rating) are generated from an
interpretable "ground truth" propensity function with injected Gaussian
noise and a Bernoulli draw for the binary outcomes, so the label is
correlated with the features but not a deterministic 1:1 function of them —
a trained model has to learn a generalizable pattern rather than memorize a
formula, which is the entire point of training one instead of hand-coding
rules.

Run: python generate_data.py
Output: subscribers.csv, subscriber_campaign_interactions.csv (this directory)
"""
import numpy as np
import pandas as pd

rng = np.random.default_rng(42)

N_SUBSCRIBERS = 3000
CAMPAIGN_TYPES = ["EK_PAKET", "TARIFE_YUKSELTME", "CIHAZ_FIRSATI", "SADAKAT"]
SEGMENTS = ["YUKSEK_DEGER", "RISKLI_KAYIP", "YENI_ABONE", "PASIF", "BELIRSIZ"]
TARIFFS = ["Genç Tarife", "Öğrenci Tarifesi", "Aile Paketi", "Standart Tarife", "Premium Tarife"]

# ---------------------------------------------------------------------------
# 1) Subscriber profiles
# ---------------------------------------------------------------------------
def generate_subscribers(n):
    monthly_spend = np.clip(rng.gamma(shape=3.0, scale=55, size=n), 15, 600)
    data_usage_gb = np.clip(rng.gamma(shape=2.2, scale=8.5, size=n), 0, 120)
    voice_minutes = np.clip(rng.gamma(shape=2.5, scale=180, size=n), 0, 3000)
    churn_risk = np.clip(rng.beta(1.6, 4.0, size=n), 0, 1)
    value_score = np.clip(0.35 * (monthly_spend / monthly_spend.max()) + rng.beta(2, 2, size=n) * 0.65, 0, 1)
    accepted = rng.poisson(1.4, size=n)
    rejected = rng.poisson(1.8, size=n)
    tariff = rng.choice(TARIFFS, size=n)

    df = pd.DataFrame({
        "subscriberId": [f"SUB-{i:05d}" for i in range(n)],
        "monthlySpend": monthly_spend.round(2),
        "dataUsageGb": data_usage_gb.round(2),
        "voiceMinutes": voice_minutes.round(0).astype(int),
        "churnRisk": churn_risk.round(4),
        "valueScore": value_score.round(4),
        "acceptedCampaigns": accepted,
        "rejectedCampaigns": rejected,
        "tariff": tariff,
    })

    # Ground-truth segment — a softmax-style argmax over per-class logits
    # (linear-in-features + noise) rather than nested nested if/elif
    # thresholds. This gives every class real, feature-driven density
    # instead of BELIRSIZ swallowing everything by default, and keeps the
    # relationship close to (but not identical to) what a linear/softmax
    # classifier can actually learn.
    noise = rng.normal(0, 0.75, size=(n, 5))
    is_new = ((df["acceptedCampaigns"] == 0) & (df["rejectedCampaigns"] == 0)).astype(float)

    logit_riskli_kayip = 5.5 * df["churnRisk"] - 1.8 + noise[:, 0]
    logit_yuksek_deger = 3.2 * (df["monthlySpend"] / 300) + 2.2 * df["valueScore"] - 2.6 + noise[:, 1]
    logit_yeni_abone = 3.0 * is_new - 1.4 + noise[:, 2]
    logit_pasif = 2.6 * (1 - df["monthlySpend"] / 120).clip(lower=0) + 1.8 * (1 - df["dataUsageGb"] / 15).clip(lower=0) - 2.0 + noise[:, 3]
    logit_belirsiz = 0.35 + noise[:, 4]

    logits = np.column_stack([
        logit_riskli_kayip, logit_yuksek_deger, logit_yeni_abone, logit_pasif, logit_belirsiz,
    ])
    labels = np.array(["RISKLI_KAYIP", "YUKSEK_DEGER", "YENI_ABONE", "PASIF", "BELIRSIZ"])
    df["segment"] = labels[np.argmax(logits, axis=1)]
    return df


# ---------------------------------------------------------------------------
# 2) Subscriber x campaign interactions (accept/reject + rating)
# ---------------------------------------------------------------------------
def generate_interactions(subs, n_per_subscriber=3):
    rows = []
    for row in subs.itertuples():
        n_campaigns = rng.integers(1, n_per_subscriber + 1)
        for _ in range(n_campaigns):
            ctype = rng.choice(CAMPAIGN_TYPES)
            campaign_segment = rng.choice(SEGMENTS, p=[0.22, 0.22, 0.2, 0.18, 0.18])
            discount = int(rng.integers(5, 55))

            segment_match = 1.0 if row.segment == campaign_segment else (0.5 if row.segment == "BELIRSIZ" else 0.15)
            churn_signal = row.churnRisk if ctype == "SADAKAT" else (1 - row.churnRisk)
            usage_signal = {
                "EK_PAKET": min(row.dataUsageGb / 40, 1.0),
                "TARIFE_YUKSELTME": min(row.monthlySpend / 300, 1.0),
                "CIHAZ_FIRSATI": 0.75 if row.monthlySpend > 150 else 0.35,
                "SADAKAT": 0.55,
            }[ctype]
            discount_signal = min(discount / 50, 1.0)
            history_signal = 1.0 if row.rejectedCampaigns <= 2 else (0.6 if row.rejectedCampaigns <= 5 else 0.3)

            propensity = (
                0.32 * segment_match
                + 0.18 * churn_signal
                + 0.16 * row.valueScore
                + 0.16 * discount_signal
                + 0.10 * usage_signal
                + 0.08 * history_signal
            )
            propensity = float(np.clip(propensity + rng.normal(0, 0.09), 0.02, 0.98))

            accepted = rng.random() < propensity
            rating = None
            if accepted:
                # Satisfied subscribers rate higher on average; still noisy.
                base = 2.4 + propensity * 2.6
                rating = int(np.clip(round(base + rng.normal(0, 0.8)), 1, 5))

            rows.append({
                "subscriberId": row.subscriberId,
                "monthlySpend": row.monthlySpend,
                "dataUsageGb": row.dataUsageGb,
                "voiceMinutes": row.voiceMinutes,
                "churnRisk": row.churnRisk,
                "valueScore": row.valueScore,
                "acceptedCampaigns": row.acceptedCampaigns,
                "rejectedCampaigns": row.rejectedCampaigns,
                "subscriberSegment": row.segment,
                "campaignType": ctype,
                "campaignSegment": campaign_segment,
                "discount": discount,
                "accepted": int(accepted),
                "rating": rating if rating is not None else "",
            })
    return pd.DataFrame(rows)


if __name__ == "__main__":
    subs = generate_subscribers(N_SUBSCRIBERS)
    subs.to_csv("subscribers.csv", index=False)
    print(f"subscribers.csv: {len(subs)} rows, segment distribution:")
    print(subs["segment"].value_counts())

    interactions = generate_interactions(subs)
    interactions.to_csv("subscriber_campaign_interactions.csv", index=False)
    print(f"\nsubscriber_campaign_interactions.csv: {len(interactions)} rows")
    print(f"accept rate: {interactions['accepted'].mean():.3f}")
