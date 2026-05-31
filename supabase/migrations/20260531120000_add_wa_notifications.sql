CREATE OR REPLACE FUNCTION notify_diagnosis_complete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, wa_sent, is_read)
  VALUES (
    NEW.user_id,
    '🔬 Hasil Diagnosa Siap',
    'Diagnosa tanaman ' || COALESCE(NEW.plant_type, 'kamu') || ' telah selesai. ' ||
    COALESCE(NEW.diagnosis, '') || ' Buka TaniAI Nexus untuk detail lengkap.',
    'diagnosis',
    false,
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
 
-- Pasang trigger ke tabel plant_diagnoses
DROP TRIGGER IF EXISTS trg_notify_diagnosis ON public.plant_diagnoses;
CREATE TRIGGER trg_notify_diagnosis
  AFTER INSERT ON public.plant_diagnoses
  FOR EACH ROW EXECUTE FUNCTION notify_diagnosis_complete();
 
-- ──────────────────────────────────────────────────────────────
-- CONTOH: Trigger saat ada komentar baru di post komunitas milik user
-- ──────────────────────────────────────────────────────────────
 
CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id UUID;
  post_title    TEXT;
BEGIN
  -- Cari pemilik post
  SELECT user_id, title INTO post_owner_id, post_title
  FROM public.community_posts
  WHERE id = NEW.post_id;
 
  -- Jangan notif jika komentar dari pemilik sendiri
  IF post_owner_id IS NOT NULL AND post_owner_id <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, body, type, wa_sent, is_read)
    VALUES (
      post_owner_id,
      '💬 Komentar Baru di Postingan Kamu',
      'Ada yang mengomentari postingan kamu: "' || COALESCE(post_title, 'post') || '".',
      'community',
      false,
      false
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
 
DROP TRIGGER IF EXISTS trg_notify_comment ON public.community_comments;
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION notify_new_comment();