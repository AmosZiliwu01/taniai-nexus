CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner_id  UUID;
  v_post_title     TEXT;
  v_commenter_name TEXT;
BEGIN
  SELECT user_id, title
    INTO v_post_owner_id, v_post_title
    FROM public.community_posts
   WHERE id = NEW.post_id;
 
  IF v_post_owner_id IS NULL OR v_post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
 
  SELECT COALESCE(full_name, 'Seseorang')
    INTO v_commenter_name
    FROM public.profiles
   WHERE id = NEW.user_id;
 
  INSERT INTO public.notifications (user_id, title, body, type, is_read, wa_sent)
  VALUES (
    v_post_owner_id,
    '💬 Komentar Baru di Postinganmu',
    v_commenter_name || ' mengomentari postinganmu: "' ||
      LEFT(COALESCE(v_post_title, 'postingan'), 50) || '".',
    'community',
    false,
    false
  );
 
  RETURN NEW;
END;
$$;
 
-- Trigger-nya sudah ada, cukup function-nya di-replace di atas.
-- Tapi drop+recreate untuk pastikan function baru terpasang.
DROP TRIGGER IF EXISTS trg_notify_comment ON public.community_comments;
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON public.community_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_comment();
 
CREATE OR REPLACE FUNCTION public.notify_post_reported()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner_id UUID;
  v_post_title    TEXT;
  v_reporter_name TEXT;
  v_admin         RECORD;
BEGIN
  IF NEW.post_id IS NULL THEN
    RETURN NEW;
  END IF;
 
  SELECT user_id, title
    INTO v_post_owner_id, v_post_title
    FROM public.community_posts
   WHERE id = NEW.post_id;
 
  SELECT COALESCE(full_name, 'Seseorang')
    INTO v_reporter_name
    FROM public.profiles
   WHERE id = NEW.reporter_id;
 
  -- Notif ke pemilik post
  IF v_post_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, is_read, wa_sent)
    VALUES (
      v_post_owner_id,
      '⚠️ Postinganmu Dilaporkan',
      'Postinganmu "' || LEFT(COALESCE(v_post_title, 'postingan'), 50) ||
        '" dilaporkan dengan alasan: ' || COALESCE(NEW.reason, 'tidak disebutkan') ||
        '. Tim moderasi sedang meninjau.',
      'warning',
      false,
      false
    );
  END IF;
 
  -- Notif ke semua admin
  FOR v_admin IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, body, type, is_read, wa_sent)
    VALUES (
      v_admin.user_id,
      '🚨 Laporan Baru Masuk',
      'Laporan dari ' || v_reporter_name || ': "' ||
        LEFT(COALESCE(v_post_title, 'postingan'), 50) ||
        '". Alasan: ' || COALESCE(NEW.reason, '-') || '. Tinjau di panel admin.',
      'report',
      false,
      false
    );
  END LOOP;
 
  RETURN NEW;
END;
$$;
 
DROP TRIGGER IF EXISTS trg_notify_post_reported ON public.content_reports;
CREATE TRIGGER trg_notify_post_reported
  AFTER INSERT ON public.content_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_reported();
 

CREATE OR REPLACE FUNCTION public.notify_report_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner_id UUID;
  v_post_title    TEXT;
  v_notif_title   TEXT;
  v_notif_body    TEXT;
BEGIN
  IF OLD.status = NEW.status OR NEW.post_id IS NULL THEN
    RETURN NEW;
  END IF;
 
  SELECT user_id, title
    INTO v_post_owner_id, v_post_title
    FROM public.community_posts
   WHERE id = NEW.post_id;
 
  IF v_post_owner_id IS NULL THEN
    RETURN NEW;
  END IF;
 
  IF NEW.status = 'approved' THEN
    v_notif_title := '🚩 Postinganmu Ditandai oleh Admin';
    v_notif_body  := 'Postinganmu "' || LEFT(COALESCE(v_post_title, 'postingan'), 50) ||
                     '" ditandai melanggar aturan komunitas.' ||
                     CASE WHEN NEW.admin_note IS NOT NULL
                          THEN ' Catatan admin: ' || NEW.admin_note
                          ELSE ' Harap perbarui konten sesuai pedoman.'
                     END;
  ELSIF NEW.status = 'rejected' THEN
    v_notif_title := '✅ Laporan Terhadap Postinganmu Ditolak';
    v_notif_body  := 'Laporan terhadap postinganmu "' ||
                     LEFT(COALESCE(v_post_title, 'postingan'), 50) ||
                     '" telah ditinjau dan tidak terbukti melanggar aturan. Postinganmu aman.';
  ELSE
    RETURN NEW;
  END IF;
 
  INSERT INTO public.notifications (user_id, title, body, type, is_read, wa_sent)
  VALUES (
    v_post_owner_id,
    v_notif_title,
    v_notif_body,
    'warning',
    false,
    false
  );
 
  RETURN NEW;
END;
$$;
 
DROP TRIGGER IF EXISTS trg_notify_report_decision ON public.content_reports;
CREATE TRIGGER trg_notify_report_decision
  AFTER UPDATE OF status ON public.content_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_report_decision();