-- event_id UUID → VARCHAR(80): tek bir campaign.optimized olayı için birden çok puan
-- işlemi (opt/fast/conv/kritik son ekleriyle) idempotent kaydedilebilsin.
ALTER TABLE "points_transactions" ALTER COLUMN "event_id" TYPE VARCHAR(80);
