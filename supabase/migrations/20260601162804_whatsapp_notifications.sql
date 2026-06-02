-- ============================================
-- MIGRATION: WhatsApp Notifications System
-- ============================================
-- 1. Pastikan kolom wa_sent ada di tabel notifications
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS wa_sent BOOLEAN DEFAULT FALSE;
-- 2. Index untuk polling WA
CREATE INDEX IF NOT EXISTS idx_notifications_wa_pending ON public.notifications (wa_sent, is_read, created_at)
WHERE wa_sent = FALSE
    AND is_read = FALSE;
-- 3. Function untuk notifikasi komentar
CREATE OR REPLACE FUNCTION public.handle_comment_notification_wa() RETURNS TRIGGER AS $$
DECLARE post_owner_id UUID;
post_title TEXT;
commenter_name TEXT;
commenter_id UUID;
post_id_param UUID;
BEGIN post_id_param := NEW.post_id;
-- Get post owner and title
SELECT user_id,
    title INTO post_owner_id,
    post_title
FROM public.community_posts
WHERE id = post_id_param;
-- Get commenter info
SELECT id,
    full_name INTO commenter_id,
    commenter_name
FROM public.profiles
WHERE id = NEW.user_id;
-- Only notify if commenter is not post owner
IF post_owner_id != NEW.user_id THEN
INSERT INTO public.notifications (
        user_id,
        title,
        body,
        type,
        is_read,
        wa_sent,
        created_at
    )
VALUES (
        post_owner_id,
        '💬 Komentar Baru di Postingan Anda',
        jsonb_build_object(
            'commenter_name',
            COALESCE(commenter_name, 'Pengguna'),
            'post_title',
            LEFT(post_title, 50),
            'comment_content',
            LEFT(NEW.content, 150),
            'post_id',
            post_id_param::TEXT,
            'comment_id',
            NEW.id::TEXT
        )::TEXT,
        'community',
        false,
        false,
        NOW()
    );
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 4. Trigger untuk komentar
DROP TRIGGER IF EXISTS on_comment_wa_notification ON public.community_comments;
CREATE TRIGGER on_comment_wa_notification
AFTER
INSERT ON public.community_comments FOR EACH ROW EXECUTE FUNCTION public.handle_comment_notification_wa();
-- 5. Function untuk notifikasi laporan ke admin
CREATE OR REPLACE FUNCTION public.handle_report_notification_to_admins() RETURNS TRIGGER AS $$
DECLARE reporter_name TEXT;
reporter_id UUID;
post_owner_id UUID;
post_owner_name TEXT;
post_content TEXT;
post_title TEXT;
admin_record RECORD;
admin_phones TEXT [] := '{}';
BEGIN -- Get reporter info
SELECT full_name INTO reporter_name
FROM public.profiles
WHERE id = NEW.reporter_id;
-- Get post info
SELECT user_id,
    content,
    title INTO post_owner_id,
    post_content,
    post_title
FROM public.community_posts
WHERE id = NEW.post_id;
-- Get post owner name
SELECT full_name INTO post_owner_name
FROM public.profiles
WHERE id = post_owner_id;
-- Get all admin users (only if reporter is NOT admin)
FOR admin_record IN
SELECT DISTINCT ur.user_id,
    p.full_name
FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'admin'
    AND ur.user_id != NEW.reporter_id -- Don't notify the reporter if they're admin
    LOOP -- Insert notification for each admin
INSERT INTO public.notifications (
        user_id,
        title,
        body,
        type,
        is_read,
        wa_sent,
        created_at
    )
VALUES (
        admin_record.user_id,
        '⚠️ Laporan Postingan Baru',
        jsonb_build_object(
            'reporter_name',
            COALESCE(reporter_name, 'Pengguna'),
            'post_owner_name',
            COALESCE(post_owner_name, 'Pengguna'),
            'reason',
            NEW.reason,
            'post_content',
            LEFT(post_content, 200),
            'post_title',
            LEFT(post_title, 50),
            'post_id',
            NEW.post_id::TEXT,
            'report_id',
            NEW.id::TEXT
        )::TEXT,
        'warning',
        false,
        false,
        NOW()
    );
END LOOP;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 6. Trigger untuk laporan (hanya jika reporter bukan admin)
DROP TRIGGER IF EXISTS on_report_to_admins ON public.content_reports;
CREATE TRIGGER on_report_to_admins
AFTER
INSERT ON public.content_reports FOR EACH ROW EXECUTE FUNCTION public.handle_report_notification_to_admins();
-- 7. Function untuk auto-flag post by admin (optional)
CREATE OR REPLACE FUNCTION public.auto_flag_post_on_report() RETURNS TRIGGER AS $$
DECLARE reporter_is_admin BOOLEAN;
BEGIN -- Check if reporter is admin
SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = NEW.reporter_id
            AND role = 'admin'
    ) INTO reporter_is_admin;
-- If admin reports, auto-flag immediately
IF reporter_is_admin THEN
UPDATE public.community_posts
SET is_flagged = true,
    flagged_reason = NEW.reason
WHERE id = NEW.post_id;
-- Also mark as resolved automatically
UPDATE public.content_reports
SET status = 'resolved'
WHERE id = NEW.id;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_report_auto_flag ON public.content_reports;
CREATE TRIGGER on_report_auto_flag BEFORE
INSERT ON public.content_reports FOR EACH ROW EXECUTE FUNCTION public.auto_flag_post_on_report();