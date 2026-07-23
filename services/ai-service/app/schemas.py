from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class SubscriberProfileBase(BaseModel):
    current_tariff: Optional[str] = "Standart Tarife"
    monthly_data_usage_gb: float = Field(default=10.0, ge=0)
    monthly_voice_min: float = Field(default=500.0, ge=0)
    monthly_spend_try: float = Field(default=250.0, ge=0)
    tenure_months: int = Field(default=12, ge=0)
    past_accepted_count: int = Field(default=1, ge=0)
    past_rejected_count: int = Field(default=0, ge=0)
    complaint_count: int = Field(default=0, ge=0)
    data_usage_trend_pct: float = Field(default=5.0)

class SubscriberProfileCreate(SubscriberProfileBase):
    subscriber_id: str

class SubscriberProfileResponse(SubscriberProfileBase):
    id: str
    subscriber_id: str

    class Config:
        from_attributes = True

class ExpertStat(BaseModel):
    """Campaign Service'in kendi DB'sinden hesaplayıp AI'a taşıdığı gerçek uzman metrikleri (Case §5.3)."""
    expert_id: str
    active_workload: int = 0
    performance_rating: Optional[float] = None  # ortalama conversion_lift (gerçek performans)


class RecommendRequest(BaseModel):
    subscriber_id: str
    campaign_id: Optional[str] = None
    case_id: Optional[str] = None
    campaign_type: Optional[str] = "EK_PAKET"
    profile_override: Optional[SubscriberProfileBase] = None
    # Campaign Service kendi DB'sinden gelen gerçek uzman iş yükü/performansını geçer (opsiyonel).
    expert_stats: Optional[List[ExpertStat]] = None

class ExpertScoreInfo(BaseModel):
    expert_id: Optional[str] = None
    expert_name: Optional[str] = None
    assignment_score: float
    reasoning: str
    queued: bool = False

class RecommendResponse(BaseModel):
    prediction_id: str
    subscriber_id: str
    campaign_id: Optional[str] = None
    case_id: Optional[str] = None
    recommendation_score: float = Field(description="0.0 ile 1.0 arasında öneri skoru")
    conversion_probability: float = Field(description="0.0 ile 1.0 arasında teklif dönüşüm olasılığı")
    predicted_segment: str = Field(description="YUKSEK_DEGER, RISKLI_KAYIP, YENI_ABONE, PASIF, BELIRSIZ")
    predicted_priority: str = Field(description="DUSUK, ORTA, YUKSEK, KRITIK")
    reasoning: str = Field(description="Açıklanabilir AI gerekçesi")
    # Case §5.1 eşikleri
    show_to_subscriber: bool = Field(description="Skor >= 0.60 ise abone teklifi görür")
    priority_display: bool = Field(description="Skor > 0.80 ise teklif öncelikli gösterilir")
    recommended_expert: Optional[ExpertScoreInfo] = None
    model_version: str

class TrainModelRequest(BaseModel):
    num_samples: int = Field(default=1000, ge=100, le=10000)
    model_type: str = Field(default="RandomForest", description="RandomForest or GradientBoosting")

class TrainModelResponse(BaseModel):
    model_version_id: str
    version_tag: str
    model_type: str
    trained_on: int
    accuracy: float
    f1_score: float
    message: str

class CategoryAccuracyInfo(BaseModel):
    total: int
    correct: int
    accuracy_pct: float

class AccuracyResponse(BaseModel):
    total_predictions: int
    misclassified_count: int
    corrected_predictions_count: int
    accuracy_percentage: float
    active_model_version: Optional[str] = None
    category_breakdown: Optional[Dict[str, CategoryAccuracyInfo]] = None
