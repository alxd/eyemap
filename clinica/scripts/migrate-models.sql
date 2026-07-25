-- Run once in Neon SQL Editor if db:push is unavailable from your network.
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS settings jsonb
  DEFAULT '{"enabledModels":["medgemma"]}'::jsonb;

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS selected_models jsonb;
