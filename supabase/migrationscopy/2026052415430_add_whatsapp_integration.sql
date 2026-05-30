CREATE TABLE IF NOT EXISTS public.whatsapp_users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT        NOT NULL UNIQUE,  -- format: 628xxx@s.whatsapp.net
  display_name TEXT,
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk lookup cepat by phone
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_phone
  ON public.whatsapp_users(phone_number);

-- RLS: hanya service_role (API server) yang bisa akses
ALTER TABLE public.whatsapp_users ENABLE ROW LEVEL SECURITY;

-- Authenticated users tidak punya akses langsung (diakses via service_role di API)
-- Admin bisa lihat semua untuk dashboard
CREATE POLICY "wa_users_admin_select"
  ON public.whatsapp_users FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ─── TABLE: whatsapp_chats ───────────────────────────────────
-- Menyimpan setiap interaksi (pesan user + balasan AI) dari WhatsApp.
-- Digunakan untuk: chat history memory AI + analytics.
CREATE TABLE IF NOT EXISTS public.whatsapp_chats (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.whatsapp_users(id) ON DELETE CASCADE,
  message      TEXT        NOT NULL,         -- pesan dari user
  response     TEXT        NOT NULL,         -- balasan AI
  has_image    BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk ambil history terbaru per user (memory AI)
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_user_created
  ON public.whatsapp_chats(user_id, created_at DESC);

ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;

-- Admin bisa lihat semua chat untuk analytics dashboard
CREATE POLICY "wa_chats_admin_select"
  ON public.whatsapp_chats FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ─── GRANT untuk service_role ────────────────────────────────
-- service_role key (dipakai taniai-api) sudah bypass RLS by default.
-- Grant ini untuk keamanan explicit.
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_users TO service_role;
GRANT SELECT, INSERT ON public.whatsapp_chats TO service_role;
