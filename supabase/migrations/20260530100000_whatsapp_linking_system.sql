-- ============================================================
-- MIGRATION: WhatsApp ↔ Web Account Linking System
-- Jalankan di SQL Editor Supabase project baru
-- ============================================================

-- ─── TABLE: whatsapp_links ───────────────────────────────────
-- Mapping permanen antara user Supabase ↔ nomor WhatsApp.
-- Satu user hanya boleh punya SATU nomor WA aktif.
CREATE TABLE IF NOT EXISTS public.whatsapp_links (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  phone_number TEXT        NOT NULL,          -- format JID: 628xxx@s.whatsapp.net
  is_verified  BOOLEAN     NOT NULL DEFAULT false,
  linked_at    TIMESTAMPTZ,                   -- diisi saat is_verified = true
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id),                           -- 1 user = 1 WA
  UNIQUE (phone_number)                       -- 1 WA = 1 user
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_links_phone
  ON public.whatsapp_links(phone_number);

CREATE INDEX IF NOT EXISTS idx_whatsapp_links_user
  ON public.whatsapp_links(user_id);

ALTER TABLE public.whatsapp_links ENABLE ROW LEVEL SECURITY;

-- User bisa lihat status linking miliknya sendiri
CREATE POLICY "Users view own wa link"
  ON public.whatsapp_links FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- User bisa insert data linking miliknya sendiri (untuk generate code dari web)
CREATE POLICY "Users insert own wa link"
  ON public.whatsapp_links FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- User bisa update (unlink / re-link)
CREATE POLICY "Users update own wa link"
  ON public.whatsapp_links FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- User bisa delete (unlink)
CREATE POLICY "Users delete own wa link"
  ON public.whatsapp_links FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Admin bisa lihat semua
CREATE POLICY "Admin view all wa links"
  ON public.whatsapp_links FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- ─── TABLE: pairing_codes ────────────────────────────────────
-- Kode sementara (TAI-XXXXXX) yang di-generate di web,
-- lalu dikirim user ke WA bot untuk verifikasi.
-- Expires dalam 15 menit, auto-cleanup via cron atau trigger.
CREATE TABLE IF NOT EXISTS public.pairing_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  code        TEXT        NOT NULL UNIQUE,     -- contoh: TAI-483921
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
  used        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pairing_codes_code
  ON public.pairing_codes(code);

CREATE INDEX IF NOT EXISTS idx_pairing_codes_user
  ON public.pairing_codes(user_id);

ALTER TABLE public.pairing_codes ENABLE ROW LEVEL SECURITY;

-- User hanya bisa lihat & insert kode miliknya sendiri
CREATE POLICY "Users manage own pairing codes"
  ON public.pairing_codes FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── TABLE: whatsapp_chats ───────────────────────────────────
-- Log semua percakapan WA (untuk memory AI & analytics).
CREATE TABLE IF NOT EXISTS public.whatsapp_chats (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  phone_number TEXT        NOT NULL,
  message      TEXT        NOT NULL,
  response     TEXT        NOT NULL,
  has_image    BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_user_created
  ON public.whatsapp_chats(user_id, created_at DESC);

ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;

-- User bisa lihat history chatnya sendiri
CREATE POLICY "Users view own wa chats"
  ON public.whatsapp_chats FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admin analytics
CREATE POLICY "Admin view all wa chats"
  ON public.whatsapp_chats FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- ─── GRANTS untuk service_role ────────────────────────────────
-- service_role (dipakai taniai-api) sudah bypass RLS by default.
-- Grant ini untuk kejelasan eksplisit.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_links  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pairing_codes   TO service_role;
GRANT SELECT, INSERT                 ON public.whatsapp_chats  TO service_role;
