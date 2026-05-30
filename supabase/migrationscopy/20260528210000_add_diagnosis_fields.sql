-- ============================================================
-- MIGRATION: Add missing diagnosis fields for complete data storage
-- ============================================================

ALTER TABLE public.plant_diagnoses
  ADD COLUMN IF NOT EXISTS cause_detail TEXT,
  ADD COLUMN IF NOT EXISTS symptoms TEXT,
  ADD COLUMN IF NOT EXISTS mismatch_warning TEXT,
  ADD COLUMN IF NOT EXISTS confidence_note TEXT,
  ADD COLUMN IF NOT EXISTS weather_note TEXT,
  ADD COLUMN IF NOT EXISTS detected_plant TEXT,
  ADD COLUMN IF NOT EXISTS plant_match BOOLEAN,
  ADD COLUMN IF NOT EXISTS plant_match_confidence INT;
