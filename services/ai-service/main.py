import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from datetime import datetime, timezone

from app.database import engine, Base, SessionLocal
from app.api.endpoints import router as ai_router
from app.events.rabbitmq import RabbitMQManager
from app.models import Prediction, PredictionCorrection, SubscriberProfile, SubscriberTypePreference
from app.ml.predictor import PredictorEngine
from app.ml.expert_matcher import find_best_expert_for_case

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("AIServiceMain")


def _profile_hint_for_segment(segment: str) -> dict:
    """Kampanya hedef segmentine göre temsili abone profili (async skorlama için)."""
    hints = {
        "RISKLI_KAYIP": {"monthly_data_usage_gb": 2, "monthly_voice_min": 90, "monthly_spend_try": 80,
                          "tenure_months": 30, "past_accepted_count": 0, "past_rejected_count": 3,
                          "complaint_count": 4, "data_usage_trend_pct": -40},
        "YUKSEK_DEGER": {"monthly_data_usage_gb": 45, "monthly_voice_min": 1500, "monthly_spend_try": 600,
                          "tenure_months": 48, "past_accepted_count": 5, "past_rejected_count": 0,
                          "complaint_count": 0, "data_usage_trend_pct": 20},
        "YENI_ABONE": {"monthly_data_usage_gb": 12, "monthly_voice_min": 400, "monthly_spend_try": 200,
                        "tenure_months": 2, "past_accepted_count": 0, "past_rejected_count": 0,
                        "complaint_count": 0, "data_usage_trend_pct": 5},
        "PASIF": {"monthly_data_usage_gb": 3, "monthly_voice_min": 150, "monthly_spend_try": 90,
                   "tenure_months": 20, "past_accepted_count": 1, "past_rejected_count": 2,
                   "complaint_count": 1, "data_usage_trend_pct": -12},
    }
    return hints.get(segment, {})

def _bump_type_preference(db, subscriber_id: str, campaign_type: str, accepted: bool):
    """Case §4.5: abone × kampanya tipi kabul/ret sayacını artırır (benzer kampanya skoru için)."""
    if not subscriber_id or not campaign_type:
        return
    pref = db.query(SubscriberTypePreference).filter(
        SubscriberTypePreference.subscriber_id == subscriber_id,
        SubscriberTypePreference.campaign_type == campaign_type,
    ).first()
    if not pref:
        pref = SubscriberTypePreference(
            subscriber_id=subscriber_id, campaign_type=campaign_type,
            accepted_count=0, rejected_count=0,
        )
        db.add(pref)
    if accepted:
        pref.accepted_count = (pref.accepted_count or 0) + 1
    else:
        pref.rejected_count = (pref.rejected_count or 0) + 1


def handle_rabbitmq_event(routing_key: str, data: dict):
    """
    RabbitMQ'dan gelen event'leri işleme mantığı.
    """
    logger.info(f"AI Service event alındı: {routing_key}")
    payload = data.get("payload", {})
    db = SessionLocal()

    try:
        if routing_key == "campaign.created":
            # EVENTS.md: kampanya oluşturulunca AI otomatik skorlama yapar (async yol / recovery senaryosu).
            case_id = payload.get("case_id")
            campaign_id = payload.get("campaign_id")
            target_segment = payload.get("target_segment")
            campaign_type = payload.get("type")
            if case_id:
                engine = PredictorEngine()
                features = _profile_hint_for_segment(target_segment or "")
                result = engine.predict(features, campaign_type=campaign_type)
                # Segment yalnızca BELIRSIZ ise AI tarafından atanır; belirli segmentte kullanıcı seçimi korunur.
                pub_segment = result['predicted_segment'] if (not target_segment or target_segment == "BELIRSIZ") else None
                best = find_best_expert_for_case(result['predicted_segment'], campaign_type or "EK_PAKET")
                rabbitmq = RabbitMQManager()
                rabbitmq.publish_event("ai.prediction.created", {
                    "campaign_id": campaign_id,
                    "case_id": case_id,
                    "recommendation_score": result['recommendation_score'],
                    "conversion_probability": result['conversion_probability'],
                    "predicted_segment": pub_segment,
                    "predicted_priority": result['predicted_priority'],
                    "reasoning": result['reasoning'],
                    "recommended_expert_id": best.get("expert_id") if best else None,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                logger.info(f"campaign.created işlendi → ai.prediction.created yayınlandı (case: {case_id}).")

        elif routing_key == "segment.changed":
            case_id = payload.get("case_id")
            original_segment = payload.get("original_segment")
            corrected_segment = payload.get("corrected_segment")
            corrected_by = payload.get("corrected_by", "SYSTEM")

            # İlgili vakanın en son prediction kaydını güncelle
            if case_id:
                pred = db.query(Prediction).filter(Prediction.case_id == case_id).order_by(Prediction.created_at.desc()).first()
                if pred:
                    pred.is_ai_misclassified = True
                    correction = PredictionCorrection(
                        prediction_id=pred.id,
                        corrected_by=corrected_by,
                        original_segment=original_segment,
                        corrected_segment=corrected_segment
                    )
                    db.add(correction)
                    db.commit()
                    logger.info(f"Prediction {pred.id} misclassified olarak işaretlendi ve düzeltme kaydı oluşturuldu.")

        elif routing_key == "subscriber.offer.accepted":
            sub_id = payload.get("subscriber_id")
            camp_type = payload.get("campaign_type")
            if sub_id:
                prof = db.query(SubscriberProfile).filter(SubscriberProfile.subscriber_id == sub_id).first()
                if prof:
                    prof.past_accepted_count = (prof.past_accepted_count or 0) + 1
                _bump_type_preference(db, sub_id, camp_type, accepted=True)
                db.commit()

        elif routing_key == "subscriber.offer.rejected":
            sub_id = payload.get("subscriber_id")
            camp_type = payload.get("campaign_type")
            if sub_id:
                prof = db.query(SubscriberProfile).filter(SubscriberProfile.subscriber_id == sub_id).first()
                if prof:
                    prof.past_rejected_count = (prof.past_rejected_count or 0) + 1
                # Case §4.5: aynı tip kampanya reddedildi → tercih sayacı artar, benzer skorlar düşer.
                _bump_type_preference(db, sub_id, camp_type, accepted=False)
                db.commit()

    except Exception as e:
        logger.error(f"Event {routing_key} işlenirken veritabanı hatası: {e}")
        db.rollback()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI Service başlatılıyor...")
    
    # 1. Veritabanı tablolarını oluştur
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("AI Service veritabanı tabloları hazır.")
    except Exception as e:
        logger.warning(f"Veritabanı tabloları oluşturulurken uyarı (Postgres kapalı olabilir): {e}")

    # 2. RabbitMQ Bağlantısını kur ve dinleyiciyi başlat
    rabbitmq = RabbitMQManager()
    rabbitmq.start_consumer(handle_rabbitmq_event)

    # 3. Startup Event fırlat (ai.service.recovered)
    rabbitmq.publish_recovered_event()

    yield

    logger.info("AI Service sonlandırılıyor...")

app = FastAPI(
    title="CampaignCell - AI Service",
    description="AI Recommendation Scoring, Segment Classification, Conversion Prediction & Expert Matching Microservice",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router)

@app.get("/")
def root():
    return {
        "service": "AI Service",
        "version": "1.0.0",
        "status": "RUNNING",
        "documentation": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
