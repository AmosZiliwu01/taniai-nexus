DROP TRIGGER IF EXISTS trg_notify_post_reported  ON public.content_reports;
DROP TRIGGER IF EXISTS trg_notify_report_decision ON public.content_reports;
DROP FUNCTION IF EXISTS public.notify_post_reported();
DROP FUNCTION IF EXISTS public.notify_report_decision();

CREATE OR REPLACE FUNCTION public.notify_admins_new_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_title    TEXT;
  v_reporter_name TEXT;
  v_admin         RECORD;
BEGIN
  -- Lewati kalau ini laporan dari admin (langsung resolved) — admin sudah tau sendiri
  IF NEW.status = 'resolved' THEN
    RETURN NEW;
  END IF;
 
  -- Ambil judul post
  IF NEW.post_id IS NOT NULL THEN
    SELECT title INTO v_post_title
      FROM public.community_posts
     WHERE id = NEW.post_id;
  END IF;
 
  -- Ambil nama reporter
  SELECT COALESCE(full_name, 'Seseorang')
    INTO v_reporter_name
    FROM public.profiles
   WHERE id = NEW.reporter_id;
 
  -- Kirim notif ke semua admin, KECUALI kalau admin itu sendiri yang melaporkan
  FOR v_admin IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    IF v_admin.user_id <> NEW.reporter_id THEN
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
    END IF;
  END LOOP;
 
  RETURN NEW;
END;
$$;
 
-- ── 3. Pasang trigger baru ────────────────────────────────────
DROP TRIGGER IF EXISTS trg_notify_admins_new_report ON public.content_reports;
CREATE TRIGGER trg_notify_admins_new_report
  AFTER INSERT ON public.content_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_new_report();
 