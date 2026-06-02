-- Migration: perbaikan alur notifikasi
-- 1. Hapus trigger lama yang conflict (notify_post_reported + notify_report_decision dari migrasi 20260531130000)
-- 2. Perbaiki notify_admins_new_report agar sesuai aturan baru (dari 20260531170108)
-- 3. Perbaiki notify_new_comment agar tidak double dengan kode frontend
-- 4. Tambah kolom link_id di notifications untuk navigasi
-- 5. Blokir notif like masuk WA (type community_like baru, tidak masuk wa pipeline)
-- 6. Notif WA komentar hanya untuk postingan terbaru user

-- ── Hapus trigger & fungsi lama yang conflict ──────────────────
DROP TRIGGER IF EXISTS trg_notify_post_reported  ON public.content_reports;
DROP TRIGGER IF EXISTS trg_notify_report_decision ON public.content_reports;
DROP FUNCTION IF EXISTS public.notify_post_reported();
DROP FUNCTION IF EXISTS public.notify_report_decision();

-- ── Hapus trigger komentar lama (akan dibuat ulang dengan versi baru) ──
DROP TRIGGER IF EXISTS trg_notify_comment ON public.community_comments;

-- ── Pastikan notify_admins_new_report sudah final (dari 20260531170108) ──
-- Re-apply versi final untuk pastikan function ini benar
CREATE OR REPLACE FUNCTION public.notify_admins_new_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_title     TEXT;
  v_post_owner_id  UUID;
  v_reporter_name  TEXT;
  v_admin          RECORD;
  v_owner_is_admin BOOLEAN := false;
BEGIN
  -- Laporan dari admin (status resolved) sudah ditangani community.tsx — skip
  IF NEW.status = 'resolved' THEN
    RETURN NEW;
  END IF;

  IF NEW.post_id IS NOT NULL THEN
    SELECT title, user_id
      INTO v_post_title, v_post_owner_id
      FROM public.community_posts
     WHERE id = NEW.post_id;
  END IF;

  -- Cek apakah pemilik post adalah admin
  IF v_post_owner_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
       WHERE user_id = v_post_owner_id AND role = 'admin'
    ) INTO v_owner_is_admin;
  END IF;

  SELECT COALESCE(full_name, 'Seseorang')
    INTO v_reporter_name
    FROM public.profiles
   WHERE id = NEW.reporter_id;

  -- Notif ke admin — pemilik post BELUM dapat notif, baru dapat setelah admin approve
  FOR v_admin IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    -- Jangan kirim ke admin yang melaporkan sendiri
    CONTINUE WHEN v_admin.user_id = NEW.reporter_id;

    IF v_owner_is_admin AND v_admin.user_id = v_post_owner_id THEN
      -- Admin yang postingannya dilaporkan
      INSERT INTO public.notifications (user_id, title, body, type, is_read, wa_sent)
      VALUES (
        v_admin.user_id,
        '🚨 Postinganmu Dilaporkan',
        'Postinganmu "' || LEFT(COALESCE(v_post_title, 'postingan'), 50) ||
          '" dilaporkan oleh ' || v_reporter_name ||
          ' dengan alasan: ' || COALESCE(NEW.reason, '-') ||
          '. Tinjau di panel admin.' ||
          ' POST_ID:' || NEW.post_id::TEXT,
        'report',
        false,
        false
      );
    ELSE
      -- Admin lain: notif laporan baru
      INSERT INTO public.notifications (user_id, title, body, type, is_read, wa_sent)
      VALUES (
        v_admin.user_id,
        '🚨 Laporan Baru Masuk',
        'Laporan dari ' || v_reporter_name || ': "' ||
          LEFT(COALESCE(v_post_title, 'postingan'), 50) ||
          '". Alasan: ' || COALESCE(NEW.reason, '-') ||
          '. Tinjau di panel admin.' ||
          CASE WHEN NEW.post_id IS NOT NULL THEN ' POST_ID:' || NEW.post_id::TEXT ELSE '' END,
        'report',
        false,
        false
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_new_report ON public.content_reports;
CREATE TRIGGER trg_notify_admins_new_report
  AFTER INSERT ON public.content_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_new_report();


-- ── Fungsi notify komentar — hanya DB trigger, frontend tidak insert lagi ──
-- wa_sent = false hanya jika postingan ini adalah postingan TERBARU user tersebut
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
  v_latest_post_id UUID;
  v_should_wa      BOOLEAN := false;
BEGIN
  SELECT user_id, title
    INTO v_post_owner_id, v_post_title
    FROM public.community_posts
   WHERE id = NEW.post_id;

  -- Jangan notif kalau komentar ke post milik sendiri
  IF v_post_owner_id IS NULL OR v_post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Seseorang')
    INTO v_commenter_name
    FROM public.profiles
   WHERE id = NEW.user_id;

  -- Cek apakah post ini adalah postingan terbaru milik pemilik — untuk filter WA
  SELECT id INTO v_latest_post_id
    FROM public.community_posts
   WHERE user_id = v_post_owner_id
   ORDER BY created_at DESC
   LIMIT 1;

  v_should_wa := (v_latest_post_id = NEW.post_id);

  INSERT INTO public.notifications (user_id, title, body, type, is_read, wa_sent)
  VALUES (
    v_post_owner_id,
    '💬 ' || v_commenter_name || ' mengomentari postingan Anda',
    'POST_ID:' || NEW.post_id::TEXT || E'\n"' ||
      LEFT(COALESCE(v_post_title, 'postingan'), 50) || '" — ' ||
      LEFT(COALESCE(NEW.content, ''), 80),
    'community',
    false,
    NOT v_should_wa  -- wa_sent=true langsung kalau bukan postingan terbaru (skip WA)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON public.community_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_comment();


-- ── Type baru: community_like — tidak masuk WA pipeline ──────────
-- Notif like hanya web, wa_sent = true dari awal (tidak perlu dikirim ke WA)
CREATE OR REPLACE FUNCTION public.notify_new_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner_id UUID;
  v_post_title    TEXT;
  v_liker_name    TEXT;
BEGIN
  SELECT user_id, title
    INTO v_post_owner_id, v_post_title
    FROM public.community_posts
   WHERE id = NEW.post_id;

  -- Jangan notif like ke postingan sendiri
  IF v_post_owner_id IS NULL OR v_post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Seseorang')
    INTO v_liker_name
    FROM public.profiles
   WHERE id = NEW.user_id;

  -- wa_sent = true langsung — like tidak dikirim ke WA
  INSERT INTO public.notifications (user_id, title, body, type, is_read, wa_sent)
  VALUES (
    v_post_owner_id,
    '❤️ ' || v_liker_name || ' menyukai postingan Anda',
    'POST_ID:' || NEW.post_id::TEXT || E'\n"' || LEFT(COALESCE(v_post_title, 'postingan'), 50) || '"',
    'community_like',
    false,
    true  -- tidak masuk WA
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_like ON public.post_likes;
CREATE TRIGGER trg_notify_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_like();


-- ── Fungsi approve report: kirim notif ke pemilik post setelah admin approve ──
-- Dipanggil dari frontend (approveReport mutation) via RPC atau langsung
-- Tidak pakai trigger UPDATE agar tidak ada race condition dengan approveReport mutation
CREATE OR REPLACE FUNCTION public.notify_report_approved(
  p_report_id   UUID,
  p_post_id     UUID,
  p_reason      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_owner_id UUID;
  v_post_title    TEXT;
BEGIN
  SELECT user_id, title
    INTO v_post_owner_id, v_post_title
    FROM public.community_posts
   WHERE id = p_post_id;

  IF v_post_owner_id IS NULL THEN
    RETURN;
  END IF;

  -- Cek apakah notif untuk postingan ini sudah ada dari laporan ini agar tidak double
  IF EXISTS (
    SELECT 1 FROM public.notifications
     WHERE user_id = v_post_owner_id
       AND body LIKE '%POST_ID:' || p_post_id::TEXT || '%'
       AND type = 'warning'
       AND created_at > NOW() - INTERVAL '1 hour'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, is_read, wa_sent)
  VALUES (
    v_post_owner_id,
    '⚠️ Postingan Anda Ditandai oleh Admin',
    'POST_ID:' || p_post_id::TEXT || E'\nPostingan Anda "' ||
      LEFT(COALESCE(v_post_title, 'postingan'), 50) ||
      '" ditandai melanggar aturan komunitas. Alasan: ' ||
      COALESCE(p_reason, 'tidak disebutkan') ||
      '. Perbarui konten untuk menghapus tanda.',
    'warning',
    false,
    false  -- masuk WA pipeline
  );
END;
$$;
