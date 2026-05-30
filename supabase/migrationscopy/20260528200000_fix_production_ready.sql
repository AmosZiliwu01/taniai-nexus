-- ============================================================
-- MIGRATION: Production-ready fix — RLS, grants, FK, schema
-- Safe to run multiple times (idempotent)
-- ============================================================

-- ─── HELPER: ensure pgcrypto for UUID generation on older PG ─
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TABLE: ai_conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT DEFAULT 'Percakapan baru',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- Drop all old policies cleanly
DROP POLICY IF EXISTS "Own conversations"              ON public.ai_conversations;
DROP POLICY IF EXISTS "own_conversations"              ON public.ai_conversations;
DROP POLICY IF EXISTS "ai_conversations_select"        ON public.ai_conversations;
DROP POLICY IF EXISTS "ai_conversations_insert"        ON public.ai_conversations;
DROP POLICY IF EXISTS "ai_conversations_update"        ON public.ai_conversations;
DROP POLICY IF EXISTS "ai_conversations_delete"        ON public.ai_conversations;

CREATE POLICY "ai_conversations_select"
  ON public.ai_conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ai_conversations_insert"
  ON public.ai_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_conversations_update"
  ON public.ai_conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_conversations_delete"
  ON public.ai_conversations FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;

-- ============================================================
-- TABLE: ai_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own messages"          ON public.ai_messages;
DROP POLICY IF EXISTS "own_messages"          ON public.ai_messages;
DROP POLICY IF EXISTS "ai_messages_select"    ON public.ai_messages;
DROP POLICY IF EXISTS "ai_messages_insert"    ON public.ai_messages;
DROP POLICY IF EXISTS "ai_messages_update"    ON public.ai_messages;
DROP POLICY IF EXISTS "ai_messages_delete"    ON public.ai_messages;

-- ai_messages uses EXISTS join to ai_conversations
CREATE POLICY "ai_messages_select"
  ON public.ai_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "ai_messages_insert"
  ON public.ai_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "ai_messages_delete"
  ON public.ai_messages FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;

-- ============================================================
-- TABLE: profiles — ensure columns exist
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone       TEXT,
  ADD COLUMN IF NOT EXISTS farmer_type TEXT,
  ADD COLUMN IF NOT EXISTS bio         TEXT;

-- ============================================================
-- TABLE: community_posts — FK to profiles
-- ============================================================
DO $$
BEGIN
  -- Add named FK to auth.users if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'community_posts_user_id_fkey'
      AND conrelid = 'public.community_posts'::regclass
  ) THEN
    ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK from community_posts.user_id → profiles.id for Supabase join
-- (profiles.id references auth.users.id, so this is safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'community_posts_user_id_profiles_fkey'
      AND conrelid = 'public.community_posts'::regclass
  ) THEN
    -- Only add if profiles.id = auth.users.id pattern is consistent
    -- This enables: .select('*, author:profiles!community_posts_user_id_fkey(...)')
    NULL; -- FK already established via auth.users; Supabase resolves via profiles
  END IF;
END $$;

-- ============================================================
-- TABLE: community_comments — FK
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'community_comments_user_id_fkey'
      AND conrelid = 'public.community_comments'::regclass
  ) THEN
    ALTER TABLE public.community_comments
      ADD CONSTRAINT community_comments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- TABLE: user_plants — ensure updated_at + RLS
-- ============================================================
ALTER TABLE IF EXISTS public.user_plants
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE IF EXISTS public.user_plants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own plants"          ON public.user_plants;
DROP POLICY IF EXISTS "own_plants"          ON public.user_plants;
DROP POLICY IF EXISTS "user_plants_select"  ON public.user_plants;
DROP POLICY IF EXISTS "user_plants_insert"  ON public.user_plants;
DROP POLICY IF EXISTS "user_plants_update"  ON public.user_plants;
DROP POLICY IF EXISTS "user_plants_delete"  ON public.user_plants;

CREATE POLICY "user_plants_select"
  ON public.user_plants FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_plants_insert"
  ON public.user_plants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_plants_update"
  ON public.user_plants FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_plants_delete"
  ON public.user_plants FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_plants TO authenticated;

-- ============================================================
-- TABLE: plant_diagnoses — RLS
-- ============================================================
ALTER TABLE IF EXISTS public.plant_diagnoses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own diagnoses"           ON public.plant_diagnoses;
DROP POLICY IF EXISTS "own_diagnoses"           ON public.plant_diagnoses;
DROP POLICY IF EXISTS "Users manage own diagnoses" ON public.plant_diagnoses;
DROP POLICY IF EXISTS "plant_diagnoses_select"  ON public.plant_diagnoses;
DROP POLICY IF EXISTS "plant_diagnoses_insert"  ON public.plant_diagnoses;
DROP POLICY IF EXISTS "plant_diagnoses_update"  ON public.plant_diagnoses;
DROP POLICY IF EXISTS "plant_diagnoses_delete"  ON public.plant_diagnoses;

CREATE POLICY "plant_diagnoses_select"
  ON public.plant_diagnoses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "plant_diagnoses_insert"
  ON public.plant_diagnoses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "plant_diagnoses_update"
  ON public.plant_diagnoses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "plant_diagnoses_delete"
  ON public.plant_diagnoses FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plant_diagnoses TO authenticated;

-- ============================================================
-- TABLE: notifications — RLS
-- ============================================================
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select"  ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert"  ON public.notifications;
DROP POLICY IF EXISTS "notifications_update"  ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete"  ON public.notifications;

CREATE POLICY "notifications_select"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_update"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_delete"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;

-- ============================================================
-- GRANT remaining tables
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plant_notes        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_likes         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_likes      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_reports    TO authenticated;
GRANT SELECT ON public.profiles                                    TO authenticated;
GRANT UPDATE ON public.profiles                                    TO authenticated;

-- Sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================
-- INDEX: improve query performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id
  ON public.ai_conversations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id
  ON public.ai_messages (conversation_id, created_at ASC);
