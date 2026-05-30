-- supabase/migrations/YYYYMMDD_add_market_price_cache.sql
-- Tabel cache untuk harga pasar
-- Edge Function menyimpan hasil fetch BPN di sini agar tidak spam API
DROP POLICY IF EXISTS "Anyone can read market cache" ON public.market_price_cache;

-- TABLE
create table if not exists public.market_price_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  region text not null default 'Nasional',
  payload jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- INDEX
create index if not exists idx_market_price_cache_key
on public.market_price_cache (cache_key, expires_at);

-- RLS
alter table public.market_price_cache enable row level security;

-- SAFE POLICY (NO DUPLICATE ERROR)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'market_price_cache'
      AND policyname = 'Anyone can read market cache'
  ) THEN
    DROP POLICY "Anyone can read market cache" ON public.market_price_cache;
  END IF;

  CREATE POLICY "Anyone can read market cache"
    ON public.market_price_cache
    FOR SELECT
    USING (true);
END$$;

-- COMMENT
comment on table public.market_price_cache is
'Cache harga pasar dari Panel Harga Pangan BPN. TTL 20 menit. Write via Edge Function dengan service_role.';