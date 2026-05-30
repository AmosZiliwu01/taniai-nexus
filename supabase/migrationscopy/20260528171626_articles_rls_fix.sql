-- ============================================================
-- TaniAI Nexus — Articles RLS Fix & Categories Seed
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── 1. Helper function: check if current user is admin ───────
-- (safe to re-run; replaces existing function)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$$;

-- ── 2. Enable RLS on articles (if not already enabled) ───────
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- ── 3. Drop old/broken policies ───────────────────────────────
DROP POLICY IF EXISTS "Articles are viewable by everyone"     ON public.articles;
DROP POLICY IF EXISTS "Articles viewable when published"      ON public.articles;
DROP POLICY IF EXISTS "Admins can insert articles"            ON public.articles;
DROP POLICY IF EXISTS "Admins can update articles"            ON public.articles;
DROP POLICY IF EXISTS "Admins can delete articles"            ON public.articles;
DROP POLICY IF EXISTS "Admin full access"                     ON public.articles;
DROP POLICY IF EXISTS "articles_select_published"             ON public.articles;
DROP POLICY IF EXISTS "articles_admin_all"                    ON public.articles;

-- ── 4. New clean policies ─────────────────────────────────────

-- Public users: read published articles only
CREATE POLICY "articles_select_published"
  ON public.articles
  FOR SELECT
  USING (
    published = true
    OR public.is_admin()
  );

-- Admin: full write access (INSERT / UPDATE / DELETE)
CREATE POLICY "articles_admin_insert"
  ON public.articles
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "articles_admin_update"
  ON public.articles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "articles_admin_delete"
  ON public.articles
  FOR DELETE
  USING (public.is_admin());

-- ── 5. Enable RLS on article_categories ──────────────────────
ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Categories readable by all" ON public.article_categories;
DROP POLICY IF EXISTS "categories_select_all"      ON public.article_categories;
DROP POLICY IF EXISTS "categories_admin_write"     ON public.article_categories;

CREATE POLICY "categories_select_all"
  ON public.article_categories
  FOR SELECT
  USING (true);

CREATE POLICY "categories_admin_write"
  ON public.article_categories
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── 6. Seed default categories (idempotent) ───────────────────
INSERT INTO public.article_categories (id, name, slug)
VALUES
  (gen_random_uuid(), 'Tips Bertani',        'tips-bertani'),
  (gen_random_uuid(), 'Penyakit Tanaman',    'penyakit-tanaman'),
  (gen_random_uuid(), 'Pupuk & Nutrisi',     'pupuk-nutrisi'),
  (gen_random_uuid(), 'Hama & Pengendalian', 'hama-pengendalian'),
  (gen_random_uuid(), 'Teknologi Pertanian', 'teknologi-pertanian'),
  (gen_random_uuid(), 'Pasca Panen',         'pasca-panen'),
  (gen_random_uuid(), 'Berita Pertanian',    'berita-pertanian')
ON CONFLICT (slug) DO NOTHING;

-- Add unique constraint on slug if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'article_categories_slug_key'
      AND conrelid = 'public.article_categories'::regclass
  ) THEN
    ALTER TABLE public.article_categories
      ADD CONSTRAINT article_categories_slug_key UNIQUE (slug);
  END IF;
END$$;

-- ── 7. Add updated_at column if missing ──────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'articles'
      AND column_name  = 'updated_at'
  ) THEN
    ALTER TABLE public.articles
      ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END$$;

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS articles_set_updated_at ON public.articles;
CREATE TRIGGER articles_set_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Done ──────────────────────────────────────────────────────
-- Verify: run these queries to confirm
-- SELECT * FROM public.article_categories;
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename IN ('articles','article_categories');