import os
import hashlib
import logging
from typing import Dict, Any, List, Optional

import requests

logger = logging.getLogger("AIExpertMatcher")

# Case §5.3: uzman başına maksimum aktif vaka kapasitesi
MAX_CAPACITY = 10

IDENTITY_URL = os.getenv("IDENTITY_SERVICE_URL", "http://identity-service:3001")

# Identity Service erişilemezse kullanılacak yedek roster (gerçek seed uzmanları temsilen).
_FALLBACK_EXPERTS = [
    {"id": "a7f30000-0000-0000-0000-000000000001", "name": "Yedek Uzman 1",
     "expertise_tags": ["CHURN_PREVENTION", "RISKLI_KAYIP", "Churn Önleme"]},
    {"id": "a7f30000-0000-0000-0000-000000000002", "name": "Yedek Uzman 2",
     "expertise_tags": ["YUKSEK_DEGER", "TARIFE_YUKSELTME", "SADAKAT"]},
    {"id": "a7f30000-0000-0000-0000-000000000003", "name": "Yedek Uzman 3",
     "expertise_tags": ["YENI_ABONE", "EK_PAKET", "PASIF"]},
]

# Segment ↔ uzmanlık etiketi eşanlamlıları (Türkçe/İngilizce normalizasyon)
_SEGMENT_SYNONYMS = {
    "RISKLI_KAYIP": {"RISKLI_KAYIP", "CHURN_PREVENTION", "CHURN", "CHURN ÖNLEME", "CHURN ONLEME"},
    "YUKSEK_DEGER": {"YUKSEK_DEGER", "YÜKSEK DEĞER", "SADAKAT", "TARIFE_YUKSELTME", "TARİFE YÜKSELTME"},
    "YENI_ABONE": {"YENI_ABONE", "YENİ ABONE", "EK_PAKET", "EK PAKET"},
    "PASIF": {"PASIF", "PASİF"},
}


def _normalize(tag: str) -> str:
    return (tag or "").strip().upper()


def fetch_experts() -> List[Dict[str, Any]]:
    """Uzman listesini Identity Service'ten (gerçek veriden) çeker; erişilemezse yedek roster'a düşer."""
    try:
        resp = requests.get(f"{IDENTITY_URL}/internal/experts", timeout=4)
        if resp.status_code == 200:
            data = resp.json().get("data", [])
            if data:
                return data
        logger.warning(f"Identity /internal/experts beklenmeyen yanıt: {resp.status_code}")
    except Exception as e:
        logger.warning(f"Identity Service erişilemedi, yedek uzman roster kullanılıyor: {e}")
    return _FALLBACK_EXPERTS


def _stable_performance(expert_id: str) -> float:
    """
    Uzmanın ortalama dönüşüm artışı (performans) proxy'si.
    Not: Gerçek performans Campaign DB'de tutulur (conversion_lift). Servis bağımsızlığı gereği
    burada uzman id'sine bağlı deterministik, 0.70–0.95 arası stabil bir değer kullanılır.
    """
    h = int(hashlib.sha256(expert_id.encode()).hexdigest(), 16) % 26
    return round(0.70 + h / 100.0, 3)


def _expertise_match(expert_tags: List[str], target_segment: str, campaign_type: str) -> int:
    """Case §5.3: eşleşiyorsa 1, değilse 0."""
    normalized = {_normalize(t) for t in (expert_tags or [])}
    synonyms = {_normalize(s) for s in _SEGMENT_SYNONYMS.get(target_segment, {target_segment})}
    if normalized & synonyms:
        return 1
    if _normalize(campaign_type) in normalized:
        return 1
    return 0


def find_best_expert_for_case(
    target_segment: str,
    campaign_type: str = "EK_PAKET",
    workloads: Optional[Dict[str, int]] = None,
    performance_overrides: Optional[Dict[str, float]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Optimizasyon vakası için en uygun uzmanı seçer (Case §5.3).

    skor = (uzmanlik_eslesme × 0.5) + (bosluk_orani × 0.3) + (performans × 0.2)
      - uzmanlik_eslesme : eşleşme 1, değilse 0
      - bosluk_orani     : 1 - (aktif_vaka / MAX_CAPACITY=10)
      - performans       : uzmanın GERÇEK ortalama dönüşüm artışı (Campaign DB'den gelen conversion_lift);
                           veri yoksa deterministik proxy'ye düşer (servis bağımsızlığı).

    Kapasitesi dolu (aktif_vaka >= 10) uzmanlar atlanır. Uygun uzman yoksa vaka kuyruğa alınır (queued=True).

    workloads / performance_overrides: Campaign Service kendi DB'sinden hesaplayıp geçer
    (database-per-service korunur — AI Campaign DB'ye erişmez, veri istekte taşınır).
    """
    workloads = workloads or {}
    performance_overrides = performance_overrides or {}
    experts = fetch_experts()

    best_expert = None
    max_score = -1.0
    all_full = True

    for expert in experts:
        expert_id = expert["id"]
        workload = int(workloads.get(expert_id, expert.get("active_workload", 0)))

        # Kapasite kontrolü — doluysa atla (kuyruğa alınacak)
        if workload >= MAX_CAPACITY:
            continue
        all_full = False

        uzmanlik_eslesme = _expertise_match(expert.get("expertise_tags", []), target_segment, campaign_type)
        bosluk_orani = max(0.0, 1.0 - (workload / MAX_CAPACITY))
        # Öncelik: Campaign DB'den gelen gerçek performans → uzman objesindeki değer → deterministik proxy.
        if expert_id in performance_overrides and performance_overrides[expert_id] is not None:
            performans = float(performance_overrides[expert_id])
        else:
            performans = float(expert.get("performance_rating", _stable_performance(expert_id)))

        score = (uzmanlik_eslesme * 0.5) + (bosluk_orani * 0.3) + (performans * 0.2)
        score = round(score, 3)

        if score > max_score:
            max_score = score
            best_expert = {
                "expert_id": expert_id,
                "expert_name": expert.get("name", "Uzman"),
                "assignment_score": score,
                "reasoning": (
                    f"Uzmanlık eşleşmesi={uzmanlik_eslesme} (×0.5), "
                    f"boşluk oranı={round(bosluk_orani, 2)} (×0.3, {workload}/{MAX_CAPACITY} aktif vaka), "
                    f"performans={performans} (×0.2) → atama skoru {score}."
                ),
                "queued": False,
            }

    if best_expert is None:
        # Tüm uzmanlar kapasite dolu → kuyruğa al (Case §5.3)
        return {
            "expert_id": None,
            "expert_name": None,
            "assignment_score": 0.0,
            "reasoning": "Tüm uzmanlar maksimum kapasitede (10 aktif vaka). Vaka atama kuyruğuna alındı.",
            "queued": True,
        } if all_full and experts else None

    return best_expert
