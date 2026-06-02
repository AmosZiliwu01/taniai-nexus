-- Migration: hapus tabel yang tidak dipakai
-- Tabel berikut adalah data dummy / fitur lama yang tidak aktif di web:
-- whatsapp_users, soil_analyses, products, product_categories, plant_notes,
-- market_price_cache, calendar_events

DROP TABLE IF EXISTS public.whatsapp_users     CASCADE;
DROP TABLE IF EXISTS public.soil_analyses      CASCADE;
DROP TABLE IF EXISTS public.products           CASCADE;
DROP TABLE IF EXISTS public.product_categories CASCADE;
DROP TABLE IF EXISTS public.plant_notes        CASCADE;
DROP TABLE IF EXISTS public.market_price_cache CASCADE;
DROP TABLE IF EXISTS public.calendar_events    CASCADE;
