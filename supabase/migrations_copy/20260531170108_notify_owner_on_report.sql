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
  -- Lewati kalau laporan dari admin (status resolved) — ditangani community.tsx
  IF NEW.status = 'resolved' THEN
    RETURN NEW;
  END IF;

  -- Ambil judul post + pemilik post
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

  -- Ambil nama reporter
  SELECT COALESCE(full_name, 'Seseorang')
    INTO v_reporter_name
    FROM public.profiles
   WHERE id = NEW.reporter_id;

  -- ── Notif ke ADMIN ───────────────────────────────────────
  -- Pemilik post TIDAK dapat notif di sini — baru dapat setelah admin approve/reject
  FOR v_admin IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    -- Jangan kirim ke admin yang melapor sendiri
    CONTINUE WHEN v_admin.user_id = NEW.reporter_id;

    IF v_owner_is_admin AND v_admin.user_id = v_post_owner_id THEN
      -- Admin adalah pemilik post yang dilaporkan:
      -- notif 🚨 dengan keterangan postingannya sendiri yang kena laporan
      INSERT INTO public.notifications (user_id, title, body, type, is_read, wa_sent)
      VALUES (
        v_admin.user_id,
        '🚨 Postinganmu Dilaporkan',
        'Postinganmu "' || LEFT(COALESCE(v_post_title, 'postingan'), 50) ||
          '" dilaporkan oleh ' || v_reporter_name ||
          ' dengan alasan: ' || COALESCE(NEW.reason, '-') ||
          '. Tinjau di panel admin.',
        'report',
        false,
        false
      );
    ELSE
      -- Admin biasa (bukan pemilik post): notif laporan lengkap
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