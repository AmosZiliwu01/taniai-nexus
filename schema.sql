-- ============================================================
-- TaniAI Nexus — Complete Database Schema
-- Dibuat oleh: Amos Aleksiato Ziliwu
-- Universitas Kristen Immanuel Yogyakarta
--
-- ⚠️  BACA DULU SEBELUM MENJALANKAN:
--
-- File ini berisi SEMUA yang dibutuhkan untuk setup database:
--   Step 1  → Custom Enum Type
--   Step 2  → Semua Tabel (17 tabel)
--   Step 3  → Enable Row Level Security
--   Step 4  → Helper Function has_role()
--   Step 5  → Semua RLS Policies
--   Step 6  → Semua Functions & Trigger Functions
--   Step 7  → Semua Triggers
--   Step 7b → Trigger auth.users (TERPISAH jika error)
--   Step 8  → Storage Buckets & Policies
--   Step 9  → Set Admin (uncomment & ganti email)
--
-- CARA PAKAI:
--   1. Buat project baru di https://supabase.com
--   2. Buka SQL Editor → New Query
--   3. Copy-paste seluruh file ini → klik Run
--   4. Jika ada error pada Step 7b, jalankan bagian itu
--      di query TERPISAH (lihat komentar di bawah)
--   5. Untuk panduan lengkap, baca file SETUP_GUIDE.md
--
-- SETELAH SELESAI:
--   - Ambil SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY
--     dari Settings → API
--   - Daftarkan hook OAuth di Authentication → Hooks
--     (tidak digunakan — OAuth tidak aktif di project ini)
--   - Jalankan Step 9 setelah register akun pertama
-- ============================================================


-- ============================================================
-- STEP 1: CUSTOM ENUM TYPE
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'blocked');


-- ============================================================
-- STEP 2: TABLES
-- Urutan dibuat dari yang tidak punya dependensi dulu
-- ============================================================

-- profiles (bergantung pada auth.users yang sudah ada di Supabase)
CREATE TABLE public.profiles (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           TEXT,
  avatar_url          TEXT,
  location            TEXT,
  bio                 TEXT,
  phone               TEXT,
  farmer_type         TEXT,
  email               TEXT,
  provider            TEXT        NOT NULL DEFAULT 'email',
  notification_prefs  JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_roles
CREATE TABLE public.user_roles (
  id       UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role     app_role  NOT NULL,
  UNIQUE (user_id, role)
);

-- article_categories
CREATE TABLE public.article_categories (
  id    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT  NOT NULL UNIQUE,
  slug  TEXT  NOT NULL UNIQUE
);

-- articles
CREATE TABLE public.articles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  UUID        REFERENCES public.article_categories(id) ON DELETE SET NULL,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  title        TEXT        NOT NULL,
  slug         TEXT        NOT NULL UNIQUE,
  excerpt      TEXT,
  content      TEXT        NOT NULL,
  cover_image  TEXT,
  author_name  TEXT        NOT NULL DEFAULT 'TaniAI Team',
  read_minutes INTEGER     DEFAULT 5,
  published    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- community_posts
CREATE TABLE public.community_posts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  content        TEXT        NOT NULL,
  category       TEXT,
  image_url      TEXT,
  likes_count    INTEGER     NOT NULL DEFAULT 0,
  comments_count INTEGER     NOT NULL DEFAULT 0,
  is_flagged     BOOLEAN     NOT NULL DEFAULT false,
  flagged_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- community_comments
CREATE TABLE public.community_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id  UUID        REFERENCES public.community_comments(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  is_flagged BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- post_likes
CREATE TABLE public.post_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

-- comment_likes
CREATE TABLE public.comment_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID        NOT NULL REFERENCES public.community_comments(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

-- content_reports
CREATE TABLE public.content_reports (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id     UUID        REFERENCES public.community_posts(id) ON DELETE CASCADE,
  comment_id  UUID        REFERENCES public.community_comments(id) ON DELETE CASCADE,
  reason      TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending',
  admin_note  TEXT,
  resolved_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- notifications
CREATE TABLE public.notifications (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                   TEXT        NOT NULL,
  body                    TEXT,
  type                    TEXT        DEFAULT 'info',
  is_read                 BOOLEAN     NOT NULL DEFAULT false,
  wa_sent                 BOOLEAN     NOT NULL DEFAULT false,
  is_admin_action_required BOOLEAN    NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- pairing_codes
CREATE TABLE public.pairing_codes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code       TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used       BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- whatsapp_links
CREATE TABLE public.whatsapp_links (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT        NOT NULL,
  is_verified  BOOLEAN     NOT NULL DEFAULT false,
  linked_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (phone_number)
);

-- whatsapp_chats
CREATE TABLE public.whatsapp_chats (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message    TEXT        NOT NULL,
  response   TEXT        NOT NULL,
  has_image  BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_plants
CREATE TABLE public.user_plants (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  type           TEXT,
  status         TEXT,
  soil_condition TEXT,
  notes          TEXT,
  plant_date     DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- plant_diagnoses
CREATE TABLE public.plant_diagnoses (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url             TEXT,
  plant_type            TEXT,
  part_type             TEXT,
  diagnosis             TEXT        NOT NULL,
  detected_plant        TEXT,
  plant_match           BOOLEAN,
  plant_match_confidence INTEGER,
  is_plant_image        BOOLEAN,
  severity              TEXT,
  severity_score        INTEGER,
  confidence_score      INTEGER,
  cause                 TEXT,
  cause_detail          TEXT,
  symptoms              TEXT,
  solution              TEXT,
  initial_action        TEXT,
  follow_up             TEXT,
  fertilizer            TEXT,
  pesticide             TEXT,
  recovery_days         INTEGER,
  soil_condition        TEXT,
  weather_condition     TEXT,
  weather_note          TEXT,
  description           TEXT,
  mismatch_warning      TEXT,
  confidence_note       TEXT,
  shared_to_community   BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ai_conversations
CREATE TABLE public.ai_conversations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT 'Percakapan baru',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ai_messages
CREATE TABLE public.ai_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL,
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairing_codes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_chats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_diagnoses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages        ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 4: HELPER FUNCTION (dipakai oleh RLS policies)
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


-- ============================================================
-- STEP 5: RLS POLICIES
-- ============================================================

-- profiles
CREATE POLICY "Users view own profile"       ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles"     ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_public_read"         ON public.profiles FOR SELECT USING (true);
CREATE POLICY "public_email_check"           ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile"     ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile"     ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- user_roles
CREATE POLICY "View own roles"          ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins insert roles" ON public.user_roles FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins update roles" ON public.user_roles FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins delete roles" ON public.user_roles FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- article_categories
CREATE POLICY "Public read art cats"  ON public.article_categories FOR SELECT USING (true);
CREATE POLICY "Admin manage art cats" ON public.article_categories FOR ALL USING (has_role(auth.uid(), 'admin'));

-- articles
CREATE POLICY "Public read articles"  ON public.articles FOR SELECT USING (published = true);
CREATE POLICY "Admin manage articles" ON public.articles FOR ALL USING (has_role(auth.uid(), 'admin'));

-- community_posts
CREATE POLICY "Public read posts"       ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "Users insert own posts"  ON public.community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own posts"  ON public.community_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own posts"  ON public.community_posts FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admin manage posts"      ON public.community_posts FOR ALL USING (has_role(auth.uid(), 'admin'));

-- community_comments
CREATE POLICY "Public read comments"      ON public.community_comments FOR SELECT USING (true);
CREATE POLICY "Users insert own comments" ON public.community_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own comments" ON public.community_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.community_comments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admin manage comments"     ON public.community_comments FOR ALL USING (has_role(auth.uid(), 'admin'));

-- post_likes
CREATE POLICY "Public read post likes"    ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert own likes" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own likes" ON public.post_likes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

-- comment_likes
CREATE POLICY "Public read comment likes"  ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "Users manage comment likes" ON public.comment_likes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- content_reports
CREATE POLICY "Users insert reports"    ON public.content_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users view own reports"  ON public.content_reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Admin manage reports"    ON public.content_reports FOR ALL USING (has_role(auth.uid(), 'admin'));

-- notifications
CREATE POLICY "View own notifications"           ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own notifications"         ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own notifications"         ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete own notifications"         ON public.notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins insert any notif"          ON public.notifications FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manage notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- pairing_codes
CREATE POLICY "Users manage own pairing codes" ON public.pairing_codes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- whatsapp_links
CREATE POLICY "Users view own wa link"   ON public.whatsapp_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own wa link" ON public.whatsapp_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own wa link" ON public.whatsapp_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own wa link" ON public.whatsapp_links FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admin view all wa links"  ON public.whatsapp_links FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- whatsapp_chats
CREATE POLICY "Users view own wa chats"      ON public.whatsapp_chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin view all wa chats"      ON public.whatsapp_chats FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "wa_chats_admin_select"        ON public.whatsapp_chats FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "allow service role full access" ON public.whatsapp_chats FOR ALL USING (true) WITH CHECK (true);

-- user_plants
CREATE POLICY "Own plants"                  ON public.user_plants FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow user read own plants"  ON public.user_plants FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow user insert own plants" ON public.user_plants FOR INSERT WITH CHECK (auth.uid() = user_id);

-- plant_diagnoses
CREATE POLICY "Own diagnoses"             ON public.plant_diagnoses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin_read_all_diagnoses"  ON public.plant_diagnoses FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));
CREATE POLICY "admin_delete_all_diagnoses" ON public.plant_diagnoses FOR DELETE USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- ai_conversations
CREATE POLICY "ai_conversations_select" ON public.ai_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_conversations_insert" ON public.ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_conversations_update" ON public.ai_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ai_conversations_delete" ON public.ai_conversations FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "User can read own conversations"   ON public.ai_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User can insert own conversations" ON public.ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ai_messages
CREATE POLICY "ai_messages_select" ON public.ai_messages FOR SELECT USING (EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "ai_messages_insert" ON public.ai_messages FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "ai_messages_delete" ON public.ai_messages FOR DELETE USING (EXISTS (SELECT 1 FROM ai_conversations c WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()));


-- ============================================================
-- STEP 6: FUNCTIONS
-- ============================================================

-- Fungsi: get_email_provider
CREATE OR REPLACE FUNCTION public.get_email_provider(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_provider TEXT;
BEGIN
  SELECT provider INTO v_provider
  FROM public.profiles
  WHERE email = LOWER(TRIM(p_email))
  LIMIT 1;
  RETURN v_provider;
END;
$$;

-- Fungsi: admin_approve_report
CREATE OR REPLACE FUNCTION public.admin_approve_report(p_report_id UUID, p_admin_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_report        content_reports%ROWTYPE;
  v_post_title    TEXT;
  v_post_owner_id UUID;
  v_notif_body    TEXT;
BEGIN
  SELECT * INTO v_report FROM content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;

  SELECT title, user_id INTO v_post_title, v_post_owner_id
    FROM community_posts WHERE id = v_report.post_id;

  UPDATE content_reports
    SET status = 'resolved', resolved_by = p_admin_id, resolved_at = NOW()
    WHERE id = p_report_id;

  UPDATE community_posts
    SET is_flagged = TRUE, flagged_reason = v_report.reason
    WHERE id = v_report.post_id;

  IF v_post_owner_id IS NOT NULL THEN
    v_notif_body := json_build_object(
      'post_id',    v_report.post_id,
      'post_title', v_post_title,
      'reason',     v_report.reason,
      'action',     'approved',
      'message',    'Postingan "' || COALESCE(v_post_title, '') || '" telah ditandai oleh admin. Alasan: ' || COALESCE(v_report.reason, '-')
    )::text;

    INSERT INTO notifications (user_id, title, body, type, is_read, wa_sent, is_admin_action_required)
    VALUES (v_post_owner_id, '⚠️ Postingan Anda Ditandai', v_notif_body, 'warning', FALSE, FALSE, FALSE);
  END IF;
END;
$$;

-- Fungsi: admin_reject_report
CREATE OR REPLACE FUNCTION public.admin_reject_report(p_report_id UUID, p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_reporter_id UUID;
  v_reason      TEXT;
  v_post_title  TEXT;
BEGIN
  SELECT cr.reporter_id, cr.reason, cp.title
    INTO v_reporter_id, v_reason, v_post_title
    FROM public.content_reports cr
    JOIN public.community_posts cp ON cp.id = cr.post_id
    WHERE cr.id = p_report_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Laporan tidak ditemukan');
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, is_read, wa_sent, created_at)
  VALUES (
    v_reporter_id,
    '📋 Laporan Anda Ditolak',
    jsonb_build_object(
      'reason',     v_reason,
      'post_title', LEFT(v_post_title, 50),
      'action',     'rejected',
      'message',    'Laporan Anda terhadap postingan telah ditinjau dan tidak ditemukan pelanggaran.'
    )::TEXT,
    'info', false, false, NOW()
  );

  UPDATE public.content_reports
    SET status = 'rejected', resolved_by = p_admin_id, resolved_at = NOW()
    WHERE id = p_report_id;

  RETURN jsonb_build_object('success', true, 'message', 'Laporan ditolak');
END;
$$;

-- Fungsi: notify_new_like (trigger function)
CREATE OR REPLACE FUNCTION public.notify_new_like()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_post_owner_id UUID;
  v_post_title    TEXT;
  v_liker_name    TEXT;
BEGIN
  SELECT user_id, title INTO v_post_owner_id, v_post_title
    FROM public.community_posts WHERE id = NEW.post_id;

  IF v_post_owner_id IS NULL OR v_post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Seseorang') INTO v_liker_name
    FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, title, body, type, is_read, wa_sent)
  VALUES (
    v_post_owner_id,
    '❤️ ' || v_liker_name || ' menyukai postingan Anda',
    'POST_ID:' || NEW.post_id::TEXT || E'\n"' || LEFT(COALESCE(v_post_title, 'postingan'), 50) || '"',
    'community_like', false, true
  );

  RETURN NEW;
END;
$$;

-- Fungsi: notify_new_comment (trigger function)
CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_post_owner_id  UUID;
  v_post_title     TEXT;
  v_commenter_name TEXT;
  v_latest_post_id UUID;
  v_should_wa      BOOLEAN := false;
BEGIN
  SELECT user_id, title INTO v_post_owner_id, v_post_title
    FROM public.community_posts WHERE id = NEW.post_id;

  IF v_post_owner_id IS NULL OR v_post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Seseorang') INTO v_commenter_name
    FROM public.profiles WHERE id = NEW.user_id;

  SELECT id INTO v_latest_post_id
    FROM public.community_posts
    WHERE user_id = v_post_owner_id
    ORDER BY created_at DESC LIMIT 1;

  v_should_wa := (v_latest_post_id = NEW.post_id);

  INSERT INTO public.notifications (user_id, title, body, type, is_read, wa_sent)
  VALUES (
    v_post_owner_id,
    '💬 ' || v_commenter_name || ' mengomentari postingan Anda',
    'POST_ID:' || NEW.post_id::TEXT || E'\n"' ||
      LEFT(COALESCE(v_post_title, 'postingan'), 50) || '" — ' ||
      LEFT(COALESCE(NEW.content, ''), 80),
    'community', false,
    NOT v_should_wa
  );

  RETURN NEW;
END;
$$;

-- Fungsi: auto_flag_post_on_report (trigger function)
CREATE OR REPLACE FUNCTION public.auto_flag_post_on_report()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE reporter_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.reporter_id AND role = 'admin'
  ) INTO reporter_is_admin;

  IF reporter_is_admin THEN
    UPDATE public.community_posts
      SET is_flagged = true, flagged_reason = NEW.reason
      WHERE id = NEW.post_id;

    UPDATE public.content_reports
      SET status = 'resolved' WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Fungsi: handle_report_notification_to_admins (trigger function)
CREATE OR REPLACE FUNCTION public.handle_report_notification_to_admins()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_reporter_name      TEXT;
  v_post_owner_name    TEXT;
  v_post_owner_id      UUID;
  v_post_content       TEXT;
  v_post_title         TEXT;
  v_post_owner_is_admin BOOLEAN;
  v_admin_record       RECORD;
BEGIN
  SELECT COALESCE(p.full_name, 'Pengguna') INTO v_reporter_name
    FROM public.profiles p WHERE p.id = NEW.reporter_id;

  SELECT cp.content, cp.title, cp.user_id, COALESCE(p2.full_name, 'Pengguna')
    INTO v_post_content, v_post_title, v_post_owner_id, v_post_owner_name
    FROM public.community_posts cp
    JOIN public.profiles p2 ON p2.id = cp.user_id
    WHERE cp.id = NEW.post_id;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_post_owner_id AND role = 'admin'
  ) INTO v_post_owner_is_admin;

  FOR v_admin_record IN
    SELECT DISTINCT ur.user_id FROM public.user_roles ur
    WHERE ur.role = 'admin' AND ur.user_id != NEW.reporter_id
  LOOP
    INSERT INTO public.notifications (user_id, title, body, type, is_read, wa_sent, is_admin_action_required, created_at)
    VALUES (
      v_admin_record.user_id,
      '⚠️ Laporan Postingan Baru',
      jsonb_build_object(
        'reporter_name',   v_reporter_name,
        'post_owner_name', v_post_owner_name,
        'reason',          NEW.reason,
        'post_content',    LEFT(v_post_content, 200),
        'post_title',      LEFT(v_post_title, 50),
        'post_id',         NEW.post_id::TEXT,
        'type',            'report'
      )::TEXT,
      'report', false, false, v_post_owner_is_admin, NOW()
    );
  END LOOP;

  IF v_post_owner_is_admin THEN
    UPDATE public.content_reports
      SET status = 'resolved', resolved_at = NOW()
      WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Fungsi: handle_new_user (trigger function untuk auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_provider  TEXT;
  v_full_name TEXT;
  v_email     TEXT;
BEGIN
  v_provider  := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  v_email := LOWER(TRIM(NEW.email));

  IF v_provider = 'email' THEN
    INSERT INTO public.profiles (id, full_name, email, provider, created_at, updated_at)
    VALUES (NEW.id, v_full_name, v_email, 'email', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- (hook_block_oauth_without_register dihapus — tidak digunakan)


-- ============================================================
-- STEP 7: TRIGGERS
-- ============================================================

-- Trigger: like baru → notifikasi
CREATE TRIGGER trg_notify_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_like();

-- Trigger: komentar baru → notifikasi
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_comment();

-- Trigger: laporan baru → auto flag jika admin
CREATE TRIGGER on_report_auto_flag
  AFTER INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.auto_flag_post_on_report();

-- Trigger: laporan baru → notifikasi ke admin
CREATE TRIGGER on_report_to_admins
  AFTER INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_report_notification_to_admins();

-- ============================================================
-- STEP 7b: TRIGGER AUTH.USERS
--
-- Trigger ini otomatis membuat profil + role 'user' setiap kali
-- ada user baru yang register via email/password.
--
-- ⚠️  KEMUNGKINAN ERROR: "permission denied for table users"
-- Ini normal terjadi karena schema 'auth' milik Supabase internal.
--
-- SOLUSI jika error:
--   1. Klik "New Query" di SQL Editor (buka query baru yang kosong)
--   2. Copy-paste HANYA 3 baris CREATE TRIGGER di bawah ini
--   3. Klik Run
-- ============================================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- STEP 8: STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('whatsapp',  'whatsapp',  true, NULL,      NULL),
  ('avatars',   'avatars',   true, 2097152,   ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']),
  ('community', 'community', true, 5242880,   ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']),
  ('articles',  'articles',  true, 52428800,  NULL),
  ('diagnoses', 'diagnoses', true, 5242880,   ARRAY['image/jpeg','image/jpg','image/png','image/webp']),
  ('qr-codes',  'qr-codes',  true, NULL,      NULL),
  ('assets',    'assets',    true, NULL,      NULL)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: izinkan public read & authenticated upload
CREATE POLICY "Public read avatars"    ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth upload avatars"    ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Public read community"  ON storage.objects FOR SELECT USING (bucket_id = 'community');
CREATE POLICY "Auth upload community"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'community' AND auth.role() = 'authenticated');
CREATE POLICY "Public read diagnoses"  ON storage.objects FOR SELECT USING (bucket_id = 'diagnoses');
CREATE POLICY "Auth upload diagnoses"  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'diagnoses' AND auth.role() = 'authenticated');
CREATE POLICY "Public read articles"   ON storage.objects FOR SELECT USING (bucket_id = 'articles');
CREATE POLICY "Auth upload articles"   ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'articles' AND auth.role() = 'authenticated');
CREATE POLICY "Public read assets"     ON storage.objects FOR SELECT USING (bucket_id = 'assets');
CREATE POLICY "Public read qr-codes"   ON storage.objects FOR SELECT USING (bucket_id = 'qr-codes');
CREATE POLICY "Public read whatsapp"   ON storage.objects FOR SELECT USING (bucket_id = 'whatsapp');


-- ============================================================
-- STEP 9: SET ADMIN (opsional)
-- Ganti 'email-admin@example.com' dengan email admin kamu,
-- atau jalankan manual setelah register.
-- ============================================================

-- UPDATE public.user_roles
-- SET role = 'admin'
-- WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'email-admin@example.com');


-- ============================================================
-- ✅ SELESAI! Semua object database sudah terbuat.
--
-- CHECKLIST setelah run:
--   [ ] Tidak ada error merah (warning kuning masih OK)
--   [ ] Hook OAuth: tidak diperlukan (tidak digunakan)
--   [ ] Jalankan Step 7b di query terpisah jika tadi error
--   [ ] Ambil API keys dari Settings → API → isi ke .env
--   [ ] Register akun, lalu jalankan Step 9 untuk set admin
--
-- Untuk panduan lengkap, baca file: SETUP_GUIDE.md
-- ============================================================
