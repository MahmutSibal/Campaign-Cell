-- AddColumn: optimizasyon segmenti (rozet koşulları için: CHURN_AVCISI, UZMAN)
ALTER TABLE "points_transactions" ADD COLUMN "segment" VARCHAR(30);
