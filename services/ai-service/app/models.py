import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Numeric, Boolean, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class SubscriberProfile(Base):
    __tablename__ = "subscriber_profiles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    subscriber_id = Column(String(36), nullable=False, index=True)
    current_tariff = Column(String(50), nullable=True)
    monthly_data_usage_gb = Column(Numeric(8, 2), default=0.0)
    monthly_voice_min = Column(Numeric(8, 2), default=0.0)
    monthly_spend_try = Column(Numeric(10, 2), default=0.0)
    tenure_months = Column(Integer, default=0)
    past_accepted_count = Column(Integer, default=0)
    past_rejected_count = Column(Integer, default=0)
    complaint_count = Column(Integer, default=0)
    data_usage_trend_pct = Column(Numeric(6, 2), default=0.0)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class SubscriberTypePreference(Base):
    """
    Case §4.5: Abone 'ilgilenmiyorum' derse benzer (aynı tip) kampanyaların öneri skoru düşer.
    Abone × kampanya tipi bazında kabul/ret sayacı tutulur; recommend sırasında skora ceza/bonus uygulanır.
    """
    __tablename__ = "subscriber_type_preferences"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    subscriber_id = Column(String(36), nullable=False, index=True)
    campaign_type = Column(String(30), nullable=False, index=True)
    accepted_count = Column(Integer, default=0)
    rejected_count = Column(Integer, default=0)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    version_tag = Column(String(30), nullable=False)
    model_type = Column(String(50), nullable=True)
    trained_on = Column(Integer, default=0)
    accuracy = Column(Numeric(5, 4), nullable=True)
    f1_score = Column(Numeric(5, 4), nullable=True)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    predictions = relationship("Prediction", back_populates="model_version")
    training_runs = relationship("TrainingRun", back_populates="model_version")

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    subscriber_id = Column(String(36), nullable=False, index=True)
    campaign_id = Column(String(36), nullable=True)
    case_id = Column(String(36), nullable=True)
    recommendation_score = Column(Numeric(4, 3), nullable=False)
    conversion_probability = Column(Numeric(4, 3), nullable=False)
    predicted_segment = Column(String(20), nullable=False)
    predicted_priority = Column(String(10), nullable=False)
    reasoning = Column(Text, nullable=True)
    model_version_id = Column(String(36), ForeignKey("model_versions.id"), nullable=True)
    is_ai_misclassified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    model_version = relationship("ModelVersion", back_populates="predictions")
    corrections = relationship("PredictionCorrection", back_populates="prediction")

class PredictionCorrection(Base):
    __tablename__ = "prediction_corrections"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    prediction_id = Column(String(36), ForeignKey("predictions.id"), nullable=False)
    corrected_by = Column(String(36), nullable=False)
    original_segment = Column(String(20), nullable=True)
    corrected_segment = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    prediction = relationship("Prediction", back_populates="corrections")

class TrainingRun(Base):
    __tablename__ = "training_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    model_version_id = Column(String(36), ForeignKey("model_versions.id"), nullable=True)
    dataset_size = Column(Integer, default=0)
    train_size = Column(Integer, default=0)
    test_size = Column(Integer, default=0)
    metrics = Column(JSON, nullable=True)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    finished_at = Column(DateTime, nullable=True)

    model_version = relationship("ModelVersion", back_populates="training_runs")
