-- ============================================================
-- MIGRATION: Fix 403 pada user_plants, plant_diagnoses, ai_conversations
-- Root cause: RLS policies belum ada atau user_id mismatch di query
-- ============================================================

-- ─── PASTIKAN user_plants PUNYA RLS POLICY BENAR ─────────────
-- Drop semua policy lama, buat ulang yang pasti benar
ALTER TABLE IF EXISTS public.user_plants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own plants" ON public.user_plants;
DROP POLICY IF EXISTS "own_plants" ON public.user_plants;

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

-- ─── PLANT_DIAGNOSES ─────────────────────────────────────────
ALTER TABLE IF EXISTS public.plant_diagnoses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own diagnoses" ON public.plant_diagnoses;
DROP POLICY IF EXISTS "own_diagnoses" ON public.plant_diagnoses;
DROP POLICY IF EXISTS "Users manage own diagnoses" ON public.plant_diagnoses;

CREATE POLICY "plant_diagnoses_select"
  ON public.plant_diagnoses FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

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

-- ─── AI_CONVERSATIONS ────────────────────────────────────────
ALTER TABLE IF EXISTS public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "own_conversations" ON public.ai_conversations;

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

-- ─── AI_MESSAGES ─────────────────────────────────────────────
ALTER TABLE IF EXISTS public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own messages" ON public.ai_messages;
DROP POLICY IF EXISTS "own_messages" ON public.ai_messages;

-- ai_messages tidak punya user_id langsung, pakai join ke conversation
CREATE POLICY "ai_messages_select"
  ON public.ai_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations
      WHERE id = ai_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "ai_messages_insert"
  ON public.ai_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_conversations
      WHERE id = ai_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "ai_messages_delete"
  ON public.ai_messages FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_conversations
      WHERE id = ai_messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- ─── PROFILES — pastikan kolom phone & farmer_type ada ───────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS farmer_type TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- ─── COMMUNITY_POSTS — drop foreign key hint di query ────────
-- Frontend pakai: profiles!community_posts_user_id_fkey
-- Supabase butuh nama FK yang tepat. Kita tambahkan constraint bernama jika belum ada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'community_posts_user_id_fkey'
  ) THEN
    ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- community_comments FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'community_comments_user_id_fkey'
  ) THEN
    ALTER TABLE public.community_comments
      ADD CONSTRAINT community_comments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- content_reports FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'content_reports_reporter_id_fkey'
  ) THEN
    ALTER TABLE public.content_reports
      ADD CONSTRAINT content_reports_reporter_id_fkey
      FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- plant_diagnoses FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'plant_diagnoses_user_id_fkey'
  ) THEN
    ALTER TABLE public.plant_diagnoses
      ADD CONSTRAINT plant_diagnoses_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── NOTIFICATIONS — ensure policies ─────────────────────────
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;

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

-- ─── USER_PLANTS — pastikan updated_at column ada ────────────
ALTER TABLE IF EXISTS public.user_plants
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ─── GRANT semua table ke authenticated role ──────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_plants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plant_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;

-- ─── GRANT SEQUENCES ──────────────────────────────────────────
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;