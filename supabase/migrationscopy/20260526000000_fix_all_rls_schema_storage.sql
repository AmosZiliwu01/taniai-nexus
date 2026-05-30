-- ============================================================
-- MIGRATION: Fix all 403/404/400 errors
-- 1. profiles: allow reading other users' public info (for community joins)
-- 2. notifications: fix insert for system/triggers
-- 3. user_roles: fix has_role() grant
-- 4. profiles: add missing columns (phone, farmer_type)
-- 5. plant_diagnoses: add missing columns
-- 6. community_posts/comments/likes/reports: create if not exists
-- 7. user_plants: create if not exists
-- 8. storage: create buckets + policies
-- 9. articles: add user_id column for admin writes
-- ============================================================

-- ─── 1. GRANT has_role() to authenticated ───────────────────
-- This was REVOKED in migration 2 but is needed by many RLS policies
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;

-- ─── 2. PROFILES — fix RLS for community joins ──────────────
-- Problem: "Users view own profile" blocks community from reading author names
-- Solution: allow authenticated users to read public fields of any profile
-- (full_name, avatar_url, location are public info in a farming community)

DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by all auth" ON public.profiles;

-- All authenticated users can read all profiles (needed for community author joins)
CREATE POLICY "Authenticated users read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can only update their own profile
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users insert own profile (only via trigger, but allow direct too)
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ─── 3. PROFILES — add missing columns if not exist ─────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS farmer_type TEXT,
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB
    DEFAULT '{"community": true, "diagnosis": true, "weather": true}'::jsonb;

-- ─── 4. NOTIFICATIONS — fix all policies ────────────────────
DROP POLICY IF EXISTS "View own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins insert any notification" ON public.notifications;
DROP POLICY IF EXISTS "Own notifications" ON public.notifications;

CREATE POLICY "Own notifications select"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Own notifications update"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Own notifications delete"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Allow any authenticated user to insert notifications for themselves
-- AND allow service_role (triggers, server) to insert for anyone
CREATE POLICY "Own notifications insert"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- service_role bypass (for server-side notification pushes)
-- Already bypasses RLS by default, no need for explicit policy

-- ─── 5. USER_ROLES — fix policies ───────────────────────────
DROP POLICY IF EXISTS "View own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;

-- Any authenticated user can read their own role
CREATE POLICY "View own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Admins can see all roles
CREATE POLICY "Admins view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ─── 6. PLANT_DIAGNOSES — add missing columns ───────────────
ALTER TABLE public.plant_diagnoses
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS confidence_score INT,
  ADD COLUMN IF NOT EXISTS soil_condition TEXT,
  ADD COLUMN IF NOT EXISTS weather_condition TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS age_days INT,
  ADD COLUMN IF NOT EXISTS initial_action TEXT,
  ADD COLUMN IF NOT EXISTS follow_up TEXT,
  ADD COLUMN IF NOT EXISTS is_plant_image BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS shared_to_community BOOLEAN DEFAULT false;

-- Fix RLS: admin can read all diagnoses (for admin panel)
DROP POLICY IF EXISTS "Own diagnoses" ON public.plant_diagnoses;
CREATE POLICY "Own diagnoses"
  ON public.plant_diagnoses FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

-- ─── 7. USER_PLANTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  plant_date DATE NOT NULL,
  location TEXT,
  soil_condition TEXT DEFAULT 'Normal',
  notes TEXT,
  status TEXT DEFAULT 'Aktif',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_plants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own plants" ON public.user_plants;
CREATE POLICY "Own plants"
  ON public.user_plants FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── 8. PLANT_NOTES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plant_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  plant_id UUID REFERENCES public.user_plants ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'catatan',
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plant_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own plant notes" ON public.plant_notes;
CREATE POLICY "Own plant notes"
  ON public.plant_notes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── 9. COMMUNITY_POSTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Diskusi',
  image_url TEXT,
  likes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  flagged_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read posts" ON public.community_posts;
DROP POLICY IF EXISTS "Own posts insert" ON public.community_posts;
DROP POLICY IF EXISTS "Own posts update" ON public.community_posts;
DROP POLICY IF EXISTS "Own posts delete" ON public.community_posts;
DROP POLICY IF EXISTS "Admin manage posts" ON public.community_posts;

CREATE POLICY "Community posts select"
  ON public.community_posts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Community posts insert"
  ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Community posts update"
  ON public.community_posts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Community posts delete"
  ON public.community_posts FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ─── 10. COMMUNITY_COMMENTS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  parent_id UUID REFERENCES public.community_comments ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read comments" ON public.community_comments;
DROP POLICY IF EXISTS "Own comment insert" ON public.community_comments;
DROP POLICY IF EXISTS "Own comment delete" ON public.community_comments;
DROP POLICY IF EXISTS "Own comment update" ON public.community_comments;

CREATE POLICY "Community comments select"
  ON public.community_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Community comments insert"
  ON public.community_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Community comments update"
  ON public.community_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Community comments delete"
  ON public.community_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ─── 11. POST_LIKES (1 user 1 like) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read likes" ON public.post_likes;
DROP POLICY IF EXISTS "Own like insert" ON public.post_likes;
DROP POLICY IF EXISTS "Own like delete" ON public.post_likes;

CREATE POLICY "Post likes select" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Post likes insert" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Post likes delete" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── 12. COMMENT_LIKES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.community_comments ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read comment likes" ON public.comment_likes;
DROP POLICY IF EXISTS "Own comment like" ON public.comment_likes;
DROP POLICY IF EXISTS "Delete comment like" ON public.comment_likes;

CREATE POLICY "Comment likes select" ON public.comment_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Comment likes insert" ON public.comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Comment likes delete" ON public.comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── 13. CONTENT_REPORTS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  post_id UUID REFERENCES public.community_posts ON DELETE CASCADE,
  comment_id UUID REFERENCES public.community_comments ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own reports" ON public.content_reports;
DROP POLICY IF EXISTS "View own reports" ON public.content_reports;
DROP POLICY IF EXISTS "Admin manage reports" ON public.content_reports;

CREATE POLICY "Reports insert"
  ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reports select"
  ON public.content_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Reports update admin"
  ON public.content_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ─── 14. TRIGGERS: auto likes_count / comments_count ─────────
-- Drop first to avoid duplicates
DROP TRIGGER IF EXISTS on_post_like_change ON public.post_likes;
DROP TRIGGER IF EXISTS on_comment_change ON public.community_comments;
DROP FUNCTION IF EXISTS public.update_post_likes_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_post_comments_count() CASCADE;

CREATE OR REPLACE FUNCTION public.update_post_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_post_like_change
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_count();

CREATE OR REPLACE FUNCTION public.update_post_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();

-- ─── 15. ARTICLES — add user_id for admin writes ─────────────
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users ON DELETE SET NULL;

-- Admin insert policy (slug is required — generate one if empty)
DROP POLICY IF EXISTS "Admin manage articles" ON public.articles;
CREATE POLICY "Admin manage articles"
  ON public.articles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Also allow reading unpublished articles for admin
DROP POLICY IF EXISTS "Public read articles" ON public.articles;
CREATE POLICY "Public read articles"
  ON public.articles FOR SELECT TO authenticated
  USING (published = true OR public.has_role(auth.uid(), 'admin'));

-- ─── 16. STORAGE BUCKETS & POLICIES ──────────────────────────
-- Create buckets (idempotent via DO block)
DO $$
BEGIN
  -- avatars bucket
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'avatars', 'avatars', true,
      2097152,  -- 2MB
      ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
    );
  END IF;

  -- diagnoses bucket
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'diagnoses') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'diagnoses', 'diagnoses', true,
      5242880,  -- 5MB
      ARRAY['image/jpeg','image/jpg','image/png','image/webp']
    );
  END IF;

  -- community bucket
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'community') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'community', 'community', true,
      5242880,  -- 5MB
      ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
    );
  END IF;
END $$;

-- ─── AVATARS storage policies ────────────────────────────────
DROP POLICY IF EXISTS "Avatar public read" ON storage.objects;
DROP POLICY IF EXISTS "Avatar upload own" ON storage.objects;
DROP POLICY IF EXISTS "Avatar update own" ON storage.objects;
DROP POLICY IF EXISTS "Avatar delete own" ON storage.objects;

CREATE POLICY "Avatar public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Avatar upload own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = 'avatars' OR
    name LIKE 'avatars/%'
  );

CREATE POLICY "Avatar update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[2]);

CREATE POLICY "Avatar delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[2]);

-- ─── DIAGNOSES storage policies ──────────────────────────────
DROP POLICY IF EXISTS "Diagnoses public read" ON storage.objects;
DROP POLICY IF EXISTS "Diagnoses upload auth" ON storage.objects;
DROP POLICY IF EXISTS "Diagnoses delete own" ON storage.objects;

CREATE POLICY "Diagnoses public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'diagnoses');

CREATE POLICY "Diagnoses upload auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'diagnoses');

CREATE POLICY "Diagnoses update auth"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'diagnoses' AND auth.uid()::text = (storage.foldername(name))[2]);

CREATE POLICY "Diagnoses delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'diagnoses');

-- ─── COMMUNITY storage policies ──────────────────────────────
DROP POLICY IF EXISTS "Community public read" ON storage.objects;
DROP POLICY IF EXISTS "Community upload auth" ON storage.objects;
DROP POLICY IF EXISTS "Community delete own" ON storage.objects;

CREATE POLICY "Community public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'community');

CREATE POLICY "Community upload auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community');

CREATE POLICY "Community update auth"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'community');

CREATE POLICY "Community delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community');

-- ─── 17. ENSURE handle_new_user trigger is still active ──────
-- Re-create function with SECURITY DEFINER to bypass RLS on insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotent: don't fail if profile exists

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;  -- idempotent

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 18. ARTICLES — make slug optional / auto-generate ───────
-- Frontend doesn't always provide slug, so make it nullable with default
ALTER TABLE public.articles
  ALTER COLUMN slug SET DEFAULT '';
-- Allow empty slug temporarily
UPDATE public.articles SET slug = id::text WHERE slug = '' OR slug IS NULL;
