-- ============================================================
-- TANIAINEXUS — Full Database Setup untuk Supabase Project Baru
-- Jalankan seluruh file ini sekaligus di SQL Editor Supabase
-- ============================================================

-- ─── EXTENSIONS ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- STEP 1: ENUM (harus ada sebelum tabel user_roles)
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'user');


-- ============================================================
-- STEP 2: TABEL user_roles (harus ada sebelum has_role function)
-- ============================================================

CREATE TABLE public.user_roles (
  id       UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID       NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role     app_role   NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 3: FUNCTION has_role (harus ada sebelum semua RLS policies)
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;


-- ============================================================
-- STEP 4: RLS policies untuk user_roles (baru bisa pakai has_role)
-- ============================================================

CREATE POLICY "View own roles"           ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));


-- ============================================================
-- STEP 5: TABEL profiles
-- ============================================================

CREATE TABLE public.profiles (
  id                  UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name           TEXT,
  avatar_url          TEXT,
  location            TEXT,
  bio                 TEXT,
  phone               TEXT,
  farmer_type         TEXT,
  notification_prefs  JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile"   ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);


-- ============================================================
-- STEP 6: TRIGGER auto-create profile + assign role saat signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- STEP 7: NOTIFICATIONS
-- ============================================================

CREATE TABLE public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  body        TEXT,
  type        TEXT        DEFAULT 'info',
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own notifications"   ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins insert any notif"  ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- ============================================================
-- STEP 8: AI CONVERSATIONS & MESSAGES
-- ============================================================

CREATE TABLE public.ai_conversations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title       TEXT        NOT NULL DEFAULT 'Percakapan baru',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_conversations_select" ON public.ai_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ai_conversations_insert" ON public.ai_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_conversations_update" ON public.ai_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ai_conversations_delete" ON public.ai_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);


CREATE TABLE public.ai_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID        NOT NULL REFERENCES public.ai_conversations ON DELETE CASCADE,
  role             TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content          TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_messages_select" ON public.ai_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "ai_messages_insert" ON public.ai_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "ai_messages_delete" ON public.ai_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));


-- ============================================================
-- STEP 9: ARTICLES
-- ============================================================

CREATE TABLE public.article_categories (
  id    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT  NOT NULL UNIQUE,
  slug  TEXT  NOT NULL UNIQUE
);
ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read art cats"  ON public.article_categories FOR SELECT USING (true);
CREATE POLICY "Admin manage art cats" ON public.article_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));


CREATE TABLE public.articles (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  UUID     REFERENCES public.article_categories ON DELETE SET NULL,
  user_id      UUID     REFERENCES auth.users ON DELETE SET NULL,
  title        TEXT     NOT NULL,
  slug         TEXT     NOT NULL UNIQUE,
  excerpt      TEXT,
  content      TEXT     NOT NULL,
  cover_image  TEXT,
  author_name  TEXT     NOT NULL DEFAULT 'TaniAI Team',
  read_minutes INTEGER  DEFAULT 5,
  published    BOOLEAN  NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read articles"  ON public.articles FOR SELECT USING (published = true);
CREATE POLICY "Admin manage articles" ON public.articles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));


-- ============================================================
-- STEP 10: COMMUNITY
-- ============================================================

CREATE TABLE public.community_posts (
  id              UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID     NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title           TEXT     NOT NULL,
  content         TEXT     NOT NULL,
  category        TEXT,
  image_url       TEXT,
  likes_count     INTEGER  NOT NULL DEFAULT 0,
  comments_count  INTEGER  NOT NULL DEFAULT 0,
  is_flagged      BOOLEAN  NOT NULL DEFAULT false,
  flagged_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read posts"      ON public.community_posts FOR SELECT USING (true);
CREATE POLICY "Users insert own posts" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own posts" ON public.community_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own posts" ON public.community_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin manage posts"     ON public.community_posts FOR ALL   TO authenticated USING (public.has_role(auth.uid(), 'admin'));


CREATE TABLE public.community_comments (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID     NOT NULL REFERENCES public.community_posts ON DELETE CASCADE,
  user_id     UUID     NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  parent_id   UUID     REFERENCES public.community_comments ON DELETE CASCADE,
  content     TEXT     NOT NULL,
  is_flagged  BOOLEAN  NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read comments"      ON public.community_comments FOR SELECT USING (true);
CREATE POLICY "Users insert own comments" ON public.community_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own comments" ON public.community_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.community_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin manage comments"     ON public.community_comments FOR ALL   TO authenticated USING (public.has_role(auth.uid(), 'admin'));


CREATE TABLE public.post_likes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID        NOT NULL REFERENCES public.community_posts ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read post likes"  ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Users manage own likes"  ON public.post_likes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


CREATE TABLE public.comment_likes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  UUID        NOT NULL REFERENCES public.community_comments ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read comment likes"  ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "Users manage comment likes" ON public.comment_likes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


CREATE TABLE public.content_reports (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID  NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  post_id     UUID  REFERENCES public.community_posts ON DELETE CASCADE,
  comment_id  UUID  REFERENCES public.community_comments ON DELETE CASCADE,
  reason      TEXT  NOT NULL,
  status      TEXT  NOT NULL DEFAULT 'pending',
  admin_note  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert reports"   ON public.content_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users view own reports" ON public.content_reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "Admin manage reports"   ON public.content_reports FOR ALL   TO authenticated USING (public.has_role(auth.uid(), 'admin'));


-- ============================================================
-- STEP 11: MARKETPLACE
-- ============================================================

CREATE TABLE public.product_categories (
  id    UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT  NOT NULL UNIQUE,
  slug  TEXT  NOT NULL UNIQUE
);
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product cats"  ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Admin manage product cats" ON public.product_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));


CREATE TABLE public.products (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id    UUID          REFERENCES auth.users ON DELETE SET NULL,
  category_id  UUID          REFERENCES public.product_categories ON DELETE SET NULL,
  name         TEXT          NOT NULL,
  description  TEXT,
  price        NUMERIC(12,2) NOT NULL,
  unit         TEXT          NOT NULL DEFAULT 'kg',
  stock        INTEGER       NOT NULL DEFAULT 0,
  image_url    TEXT,
  location     TEXT,
  is_active    BOOLEAN       NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active products" ON public.products FOR SELECT USING (is_active = true OR auth.uid() = seller_id);
CREATE POLICY "Sellers manage own products" ON public.products FOR ALL TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Admin manage products"       ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));


CREATE TABLE public.market_price_cache (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key   TEXT        NOT NULL UNIQUE,
  region      TEXT,
  payload     JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.market_price_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read cache"    ON public.market_price_cache FOR SELECT USING (true);
CREATE POLICY "Service upsert cache" ON public.market_price_cache FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));


-- ============================================================
-- STEP 12: PLANTS & DIAGNOSES
-- ============================================================

CREATE TABLE public.user_plants (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  type           TEXT,
  status         TEXT,
  location       TEXT,
  soil_condition TEXT,
  image_url      TEXT,
  notes          TEXT,
  plant_date     DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own plants" ON public.user_plants FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


CREATE TABLE public.plant_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  plant_id    UUID        REFERENCES public.user_plants ON DELETE CASCADE,
  title       TEXT,
  content     TEXT        NOT NULL,
  note_type   TEXT,
  note_date   DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plant_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own plant notes" ON public.plant_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


CREATE TABLE public.plant_diagnoses (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  image_url               TEXT,
  plant_type              TEXT,
  part_type               TEXT,
  diagnosis               TEXT        NOT NULL,
  detected_plant          TEXT,
  plant_match             BOOLEAN,
  plant_match_confidence  INTEGER,
  is_plant_image          BOOLEAN,
  severity                TEXT,
  severity_score          INTEGER,
  confidence_score        INTEGER,
  cause                   TEXT,
  cause_detail            TEXT,
  symptoms                TEXT,
  solution                TEXT,
  initial_action          TEXT,
  follow_up               TEXT,
  fertilizer              TEXT,
  pesticide               TEXT,
  recovery_days           INTEGER,
  age_days                INTEGER,
  soil_condition          TEXT,
  weather_condition       TEXT,
  weather_note            TEXT,
  location                TEXT,
  description             TEXT,
  mismatch_warning        TEXT,
  confidence_note         TEXT,
  shared_to_community     BOOLEAN     NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plant_diagnoses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own diagnoses" ON public.plant_diagnoses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- STEP 13: SOIL & CALENDAR
-- ============================================================

CREATE TABLE public.soil_analyses (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID          NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  ph                     NUMERIC(3,1),
  humidity               NUMERIC(5,2),
  nitrogen               NUMERIC(5,2),
  recommendation         TEXT,
  recommended_crops      TEXT,
  recommended_fertilizer TEXT,
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT now()
);
ALTER TABLE public.soil_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own soil" ON public.soil_analyses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


CREATE TABLE public.calendar_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  event_type  TEXT        NOT NULL,
  plant_name  TEXT,
  event_date  DATE        NOT NULL,
  event_time  TIME,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own events" ON public.calendar_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- STEP 14: INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user      ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation   ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_user       ON public.community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_category   ON public.community_posts(category);
CREATE INDEX IF NOT EXISTS idx_community_comments_post    ON public.community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_parent  ON public.community_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post            ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment      ON public.comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_plant_diagnoses_user       ON public.plant_diagnoses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_plants_user           ON public.user_plants(user_id);
CREATE INDEX IF NOT EXISTS idx_plant_notes_plant          ON public.plant_notes(plant_id);
CREATE INDEX IF NOT EXISTS idx_products_seller            ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category          ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_slug              ON public.articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_category          ON public.articles(category_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user         ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date  ON public.calendar_events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_market_price_cache_key     ON public.market_price_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_content_reports_status     ON public.content_reports(status);


-- ============================================================
-- DONE ✅
-- 20 tabel + RLS + indexes berhasil dibuat
-- ============================================================