import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.ml.dataset_generator import generate_synthetic_telecom_dataset
from app.ml.predictor import PredictorEngine
from app.ml.expert_matcher import find_best_expert_for_case
from main import app

# Test için in-memory SQLite veritabanı
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_ai.db"
test_engine = create_engine(SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

class TestAiService(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=test_engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(bind=test_engine)

    def test_synthetic_dataset_generator(self):
        df = generate_synthetic_telecom_dataset(num_samples=100)
        self.assertEqual(len(df), 100)
        self.assertIn('monthly_data_usage_gb', df.columns)
        self.assertIn('target_segment', df.columns)
        self.assertIn('is_converted', df.columns)

    def test_predictor_engine(self):
        engine = PredictorEngine()
        features = {
            'monthly_data_usage_gb': 35.0,
            'monthly_voice_min': 800.0,
            'monthly_spend_try': 450.0,
            'tenure_months': 24,
            'past_accepted_count': 3,
            'past_rejected_count': 0,
            'complaint_count': 0,
            'data_usage_trend_pct': 15.0,
        }
        result = engine.predict(features)
        self.assertIn('recommendation_score', result)
        self.assertTrue(0.0 <= result['recommendation_score'] <= 1.0)
        self.assertIn('conversion_probability', result)
        self.assertIn(result['predicted_segment'], ["YUKSEK_DEGER", "RISKLI_KAYIP", "YENI_ABONE", "PASIF", "BELIRSIZ"])
        self.assertIn("AI Analizi:", result['reasoning'])

    def test_expert_matcher(self):
        expert = find_best_expert_for_case(target_segment="RISKLI_KAYIP", campaign_type="CIHAZ_FIRSATI")
        self.assertIsNotNone(expert)
        self.assertIn('expert_id', expert)
        self.assertGreater(expert['assignment_score'], 0.5)

    def test_health_endpoint(self):
        response = self.client.get("/api/v1/ai/health")
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertEqual(json_data['service'], 'ai-service')

    def test_recommend_endpoint(self):
        payload = {
            "subscriber_id": "test-sub-12345",
            "campaign_id": "test-camp-001",
            "campaign_type": "EK_PAKET",
            "profile_override": {
                "monthly_data_usage_gb": 40.0,
                "monthly_spend_try": 500.0,
                "tenure_months": 36,
                "past_accepted_count": 4,
                "past_rejected_count": 0,
                "complaint_count": 0,
                "data_usage_trend_pct": 20.0
            }
        }
        response = self.client.post("/api/v1/ai/recommend", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['subscriber_id'], "test-sub-12345")
        self.assertGreater(data['recommendation_score'], 0)

    def test_train_endpoint(self):
        payload = {"num_samples": 200, "model_type": "RandomForest"}
        response = self.client.post("/api/v1/ai/train", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['trained_on'], 200)
        self.assertGreater(data['accuracy'], 0)

    def test_accuracy_endpoint(self):
        response = self.client.get("/api/v1/ai/accuracy")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('accuracy_percentage', data)
        self.assertIn('category_breakdown', data)

    def test_subscriber_profile_endpoints(self):
        get_res = self.client.get("/api/v1/ai/subscribers/sub-999")
        self.assertEqual(get_res.status_code, 200)
        data = get_res.json()
        self.assertEqual(data['subscriber_id'], 'sub-999')

        update_payload = {
            "current_tariff": "Yeni Paket 25GB",
            "monthly_data_usage_gb": 25.0,
            "monthly_voice_min": 700.0,
            "monthly_spend_try": 350.0,
            "tenure_months": 15,
            "past_accepted_count": 2,
            "past_rejected_count": 0,
            "complaint_count": 1,
            "data_usage_trend_pct": 5.0
        }
        put_res = self.client.put("/api/v1/ai/subscribers/sub-999", json=update_payload)
        self.assertEqual(put_res.status_code, 200)
        updated_data = put_res.json()
        self.assertEqual(updated_data['current_tariff'], "Yeni Paket 25GB")

if __name__ == '__main__':
    unittest.main()
