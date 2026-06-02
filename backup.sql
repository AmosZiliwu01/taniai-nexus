


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'user',
    'blocked'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_approve_report"("p_report_id" "uuid", "p_admin_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_report content_reports%ROWTYPE;
  v_post_title TEXT;
  v_post_owner_id UUID;
  v_notif_body TEXT;
BEGIN
  SELECT * INTO v_report FROM content_reports WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;

  SELECT title, user_id INTO v_post_title, v_post_owner_id
    FROM community_posts WHERE id = v_report.post_id;

  UPDATE content_reports
    SET status = 'resolved',
        resolved_by = p_admin_id,
        resolved_at = NOW()
    WHERE id = p_report_id;

  UPDATE community_posts
    SET is_flagged = TRUE,
        flagged_reason = v_report.reason
    WHERE id = v_report.post_id;

  IF v_post_owner_id IS NOT NULL THEN
    v_notif_body := json_build_object(
      'post_id', v_report.post_id,
      'post_title', v_post_title,
      'reason', v_report.reason,
      'action', 'approved',
      'message', 'Postingan "' || COALESCE(v_post_title, '') || '" telah ditandai oleh admin. Alasan: ' || COALESCE(v_report.reason, '-')
    )::text;

    INSERT INTO notifications (user_id, title, body, type, is_read, wa_sent, is_admin_action_required)
    VALUES (
      v_post_owner_id,
      '⚠️ Postingan Anda Ditandai',
      v_notif_body,
      'warning',
      FALSE,
      FALSE,
      FALSE
    );
  END IF;
END;
$$;


ALTER FUNCTION "public"."admin_approve_report"("p_report_id" "uuid", "p_admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_reject_report"("p_report_id" "uuid", "p_admin_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_reporter_id UUID;
    v_reason TEXT;
    v_post_title TEXT;
BEGIN
    SELECT reporter_id, reason, cp.title INTO v_reporter_id, v_reason, v_post_title
    FROM public.content_reports cr
    JOIN public.community_posts cp ON cp.id = cr.post_id
    WHERE cr.id = p_report_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Laporan tidak ditemukan');
    END IF;
    
    -- Notifikasi ke pelapor
    INSERT INTO public.notifications (
        user_id, title, body, type, is_read, wa_sent, created_at
    ) VALUES (
        v_reporter_id,
        '📋 Laporan Anda Ditolak',
        jsonb_build_object(
            'reason', v_reason,
            'post_title', LEFT(v_post_title, 50),
            'action', 'rejected',
            'message', 'Laporan Anda terhadap postingan telah ditinjau dan tidak ditemukan pelanggaran.'
        )::TEXT,
        'info',
        false,
        false,
        NOW()
    );
    
    -- Update status laporan
    UPDATE public.content_reports
    SET status = 'rejected', resolved_by = p_admin_id, resolved_at = NOW()
    WHERE id = p_report_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Laporan ditolak');
END;
$$;


ALTER FUNCTION "public"."admin_reject_report"("p_report_id" "uuid", "p_admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_flag_post_on_report"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE reporter_is_admin BOOLEAN;
BEGIN -- Check if reporter is admin
SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = NEW.reporter_id
            AND role = 'admin'
    ) INTO reporter_is_admin;
IF reporter_is_admin THEN
UPDATE public.community_posts
SET is_flagged = true,
    flagged_reason = NEW.reason
WHERE id = NEW.post_id;
UPDATE public.content_reports
SET status = 'resolved'
WHERE id = NEW.id;
END IF;
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_flag_post_on_report"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_email_provider"("p_email" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_provider TEXT;
BEGIN
  SELECT provider INTO v_provider
  FROM public.profiles
  WHERE email = LOWER(TRIM(p_email))
  LIMIT 1;
  RETURN v_provider;
END;
$$;


ALTER FUNCTION "public"."get_email_provider"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_comment_notification_wa"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  commenter_name TEXT;
  post_title TEXT;
  post_owner_id UUID;
BEGIN
  -- Ambil nama commenter dari profiles
  SELECT full_name INTO commenter_name
  FROM profiles 
  WHERE id = NEW.user_id;
  
  -- Ambil judul post dan owner id
  SELECT title, user_id INTO post_title, post_owner_id
  FROM community_posts 
  WHERE id = NEW.post_id;
  
  -- Hanya buat notifikasi jika commenter_name ditemukan
  IF commenter_name IS NOT NULL THEN
    INSERT INTO notifications (
      user_id, 
      title, 
      body, 
      type, 
      wa_sent, 
      is_read,
      created_at
    )
    VALUES (
      post_owner_id,
      '💬 ' || commenter_name || ' mengomentari postingan Anda',
      'POST_ID:' || NEW.post_id || E'\n"' || post_title || '" — ' || NEW.content,
      'community',
      false,
      false,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_comment_notification_wa"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_provider  TEXT;
  v_full_name TEXT;
  v_email     TEXT;
BEGIN
  v_provider  := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  v_email := LOWER(TRIM(NEW.email));

  -- HANYA buat profile otomatis untuk user email/password.
  -- User OAuth (facebook, google) profilnya dibuat secara eksplisit
  -- di frontend (register.tsx) setelah user konfirmasi register.
  -- Ini mencegah user OAuth yang belum register bisa masuk app.
  IF v_provider = 'email' THEN
    INSERT INTO public.profiles (id, full_name, email, provider, created_at, updated_at)
    VALUES (NEW.id, v_full_name, v_email, 'email', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_report_notification_to_admins"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_reporter_name TEXT;
    v_post_owner_name TEXT;
    v_post_owner_id UUID;
    v_post_content TEXT;
    v_post_title TEXT;
    v_post_owner_is_admin BOOLEAN;
    v_admin_record RECORD;
BEGIN
    SELECT COALESCE(p.full_name, 'Pengguna') INTO v_reporter_name
    FROM public.profiles p WHERE p.id = NEW.reporter_id;

    SELECT cp.content, cp.title, cp.user_id, COALESCE(p2.full_name, 'Pengguna')
      INTO v_post_content, v_post_title, v_post_owner_id, v_post_owner_name
    FROM public.community_posts cp
    JOIN public.profiles p2 ON p2.id = cp.user_id
    WHERE cp.id = NEW.post_id;

    -- Cek apakah pemilik post adalah admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = v_post_owner_id AND role = 'admin'
    ) INTO v_post_owner_is_admin;

    FOR v_admin_record IN
        SELECT DISTINCT ur.user_id
        FROM public.user_roles ur
        WHERE ur.role = 'admin'
        AND ur.user_id != NEW.reporter_id
    LOOP
        INSERT INTO public.notifications (
            user_id, title, body, type, is_read, wa_sent, is_admin_action_required, created_at
        ) VALUES (
            v_admin_record.user_id,
            '⚠️ Laporan Postingan Baru',
            jsonb_build_object(
                'reporter_name', v_reporter_name,
                'post_owner_name', v_post_owner_name,
                'reason', NEW.reason,
                'post_content', LEFT(v_post_content, 200),
                'post_title', LEFT(v_post_title, 50),
                'post_id', NEW.post_id::TEXT,
                'type', 'report'
            )::TEXT,
            'report',
            false,
            false,
            -- Jika post milik admin → langsung kirim WA (is_admin_action_required=true)
            -- Jika post milik user biasa → tunggu approve dulu (false)
            v_post_owner_is_admin,
            NOW()
        );
    END LOOP;

    -- Jika post milik admin → auto-resolve laporan, tidak perlu antrian
    IF v_post_owner_is_admin THEN
        UPDATE public.content_reports
        SET status = 'resolved', resolved_at = NOW()
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_report_notification_to_admins"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hook_block_oauth_without_register"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_provider  TEXT;
  v_email     TEXT;
  v_has_profile BOOLEAN;
BEGIN
  -- Ambil provider dan email dari event payload
  v_provider := event->'claims'->>'provider';
  v_email    := LOWER(TRIM(event->'claims'->>'email'));

  -- Kalau bukan OAuth, biarkan lewat (email/password register normal)
  IF v_provider IS NULL OR v_provider = 'email' THEN
    RETURN event;
  END IF;

  -- Cek apakah email ini sudah pernah register (ada di profiles)
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE email = v_email
  ) INTO v_has_profile;

  -- Kalau belum pernah register, tolak pembuatan user
  IF NOT v_has_profile THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 422,
        'message',   'Akun Facebook Anda belum terdaftar. Silakan daftar terlebih dahulu di halaman registrasi.'
      )
    );
  END IF;

  -- Sudah pernah register, izinkan login
  RETURN event;
END;
$$;


ALTER FUNCTION "public"."hook_block_oauth_without_register"("event" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_admins_new_report"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."notify_admins_new_report"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."notify_new_comment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_like"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."notify_new_like"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'Percakapan baru'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."ai_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL
);


ALTER TABLE "public"."article_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid",
    "user_id" "uuid",
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "excerpt" "text",
    "content" "text" NOT NULL,
    "cover_image" "text",
    "author_name" "text" DEFAULT 'TaniAI Team'::"text" NOT NULL,
    "read_minutes" integer DEFAULT 5,
    "published" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comment_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "content" "text" NOT NULL,
    "is_flagged" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "category" "text",
    "image_url" "text",
    "likes_count" integer DEFAULT 0 NOT NULL,
    "comments_count" integer DEFAULT 0 NOT NULL,
    "is_flagged" boolean DEFAULT false NOT NULL,
    "flagged_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."community_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "comment_id" "uuid",
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone
);


ALTER TABLE "public"."content_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "type" "text" DEFAULT 'info'::"text",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "wa_sent" boolean DEFAULT false NOT NULL,
    "is_admin_action_required" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pairing_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:15:00'::interval) NOT NULL,
    "used" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pairing_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plant_diagnoses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "image_url" "text",
    "plant_type" "text",
    "part_type" "text",
    "diagnosis" "text" NOT NULL,
    "detected_plant" "text",
    "plant_match" boolean,
    "plant_match_confidence" integer,
    "is_plant_image" boolean,
    "severity" "text",
    "severity_score" integer,
    "confidence_score" integer,
    "cause" "text",
    "cause_detail" "text",
    "symptoms" "text",
    "solution" "text",
    "initial_action" "text",
    "follow_up" "text",
    "fertilizer" "text",
    "pesticide" "text",
    "recovery_days" integer,
    "soil_condition" "text",
    "weather_condition" "text",
    "weather_note" "text",
    "description" "text",
    "mismatch_warning" "text",
    "confidence_note" "text",
    "shared_to_community" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."plant_diagnoses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "location" "text",
    "bio" "text",
    "phone" "text",
    "farmer_type" "text",
    "notification_prefs" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "provider" "text" DEFAULT 'email'::"text" NOT NULL,
    CONSTRAINT "profiles_provider_check" CHECK (("provider" = ANY (ARRAY['email'::"text", 'facebook'::"text", 'google'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_plants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text",
    "status" "text",
    "soil_condition" "text",
    "notes" "text",
    "plant_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_plants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "response" "text" NOT NULL,
    "has_image" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_chats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "phone_number" "text" NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "linked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_links" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_categories"
    ADD CONSTRAINT "article_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."article_categories"
    ADD CONSTRAINT "article_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_categories"
    ADD CONSTRAINT "article_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_user_id_key" UNIQUE ("comment_id", "user_id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_comments"
    ADD CONSTRAINT "community_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pairing_codes"
    ADD CONSTRAINT "pairing_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."pairing_codes"
    ADD CONSTRAINT "pairing_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plant_diagnoses"
    ADD CONSTRAINT "plant_diagnoses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_plants"
    ADD CONSTRAINT "user_plants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."whatsapp_chats"
    ADD CONSTRAINT "whatsapp_chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_links"
    ADD CONSTRAINT "whatsapp_links_phone_number_key" UNIQUE ("phone_number");



ALTER TABLE ONLY "public"."whatsapp_links"
    ADD CONSTRAINT "whatsapp_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_links"
    ADD CONSTRAINT "whatsapp_links_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_ai_conversations_user" ON "public"."ai_conversations" USING "btree" ("user_id");



CREATE INDEX "idx_ai_messages_conv_time" ON "public"."ai_messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_ai_messages_conversation" ON "public"."ai_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_articles_category" ON "public"."articles" USING "btree" ("category_id");



CREATE INDEX "idx_articles_slug" ON "public"."articles" USING "btree" ("slug");



CREATE INDEX "idx_comment_likes_comment" ON "public"."comment_likes" USING "btree" ("comment_id");



CREATE INDEX "idx_community_comments_parent" ON "public"."community_comments" USING "btree" ("parent_id");



CREATE INDEX "idx_community_comments_post" ON "public"."community_comments" USING "btree" ("post_id");



CREATE INDEX "idx_community_posts_category" ON "public"."community_posts" USING "btree" ("category");



CREATE INDEX "idx_community_posts_user" ON "public"."community_posts" USING "btree" ("user_id");



CREATE INDEX "idx_content_reports_status" ON "public"."content_reports" USING "btree" ("status");



CREATE INDEX "idx_notifications_user" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_wa_pending" ON "public"."notifications" USING "btree" ("user_id", "wa_sent", "created_at") WHERE ("wa_sent" = false);



CREATE INDEX "idx_pairing_codes_code" ON "public"."pairing_codes" USING "btree" ("code");



CREATE INDEX "idx_pairing_codes_user" ON "public"."pairing_codes" USING "btree" ("user_id");



CREATE INDEX "idx_plant_diagnoses_user" ON "public"."plant_diagnoses" USING "btree" ("user_id");



CREATE INDEX "idx_post_likes_post" ON "public"."post_likes" USING "btree" ("post_id");



CREATE INDEX "idx_user_plants_user" ON "public"."user_plants" USING "btree" ("user_id");



CREATE INDEX "idx_whatsapp_chats_user_created" ON "public"."whatsapp_chats" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_whatsapp_links_phone" ON "public"."whatsapp_links" USING "btree" ("phone_number");



CREATE INDEX "idx_whatsapp_links_user" ON "public"."whatsapp_links" USING "btree" ("user_id");



CREATE INDEX "profiles_email_idx" ON "public"."profiles" USING "btree" ("email");



CREATE OR REPLACE TRIGGER "on_report_auto_flag" BEFORE INSERT ON "public"."content_reports" FOR EACH ROW EXECUTE FUNCTION "public"."auto_flag_post_on_report"();



CREATE OR REPLACE TRIGGER "on_report_to_admins" AFTER INSERT ON "public"."content_reports" FOR EACH ROW EXECUTE FUNCTION "public"."handle_report_notification_to_admins"();



CREATE OR REPLACE TRIGGER "trg_notify_like" AFTER INSERT ON "public"."post_likes" FOR EACH ROW EXECUTE FUNCTION "public"."notify_new_like"();



ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."article_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."community_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_comments"
    ADD CONSTRAINT "community_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."community_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_comments"
    ADD CONSTRAINT "community_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_comments"
    ADD CONSTRAINT "community_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_posts"
    ADD CONSTRAINT "community_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."community_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pairing_codes"
    ADD CONSTRAINT "pairing_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plant_diagnoses"
    ADD CONSTRAINT "plant_diagnoses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_plants"
    ADD CONSTRAINT "user_plants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_chats"
    ADD CONSTRAINT "whatsapp_chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_links"
    ADD CONSTRAINT "whatsapp_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin manage art cats" ON "public"."article_categories" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin manage articles" ON "public"."articles" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin manage comments" ON "public"."community_comments" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin manage posts" ON "public"."community_posts" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin manage reports" ON "public"."content_reports" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin view all wa chats" ON "public"."whatsapp_chats" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admin view all wa links" ON "public"."whatsapp_links" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins insert any notif" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins view all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Allow user insert own plants" ON "public"."user_plants" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow user read own plants" ON "public"."user_plants" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Delete own notifications" ON "public"."notifications" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Insert own notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Only admins delete roles" ON "public"."user_roles" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Only admins insert roles" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Only admins update roles" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Own diagnoses" ON "public"."plant_diagnoses" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Own plants" ON "public"."user_plants" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Public read art cats" ON "public"."article_categories" FOR SELECT USING (true);



CREATE POLICY "Public read articles" ON "public"."articles" FOR SELECT USING (("published" = true));



CREATE POLICY "Public read comment likes" ON "public"."comment_likes" FOR SELECT USING (true);



CREATE POLICY "Public read comments" ON "public"."community_comments" FOR SELECT USING (true);



CREATE POLICY "Public read post likes" ON "public"."post_likes" FOR SELECT USING (true);



CREATE POLICY "Public read posts" ON "public"."community_posts" FOR SELECT USING (true);



CREATE POLICY "Service role manage notifications" ON "public"."notifications" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Update own notifications" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "User can insert own conversations" ON "public"."ai_conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "User can read own conversations" ON "public"."ai_conversations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own likes" ON "public"."post_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own likes" ON "public"."post_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own likes" ON "public"."post_likes" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own comments" ON "public"."community_comments" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own posts" ON "public"."community_posts" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own wa link" ON "public"."whatsapp_links" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own comments" ON "public"."community_comments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own posts" ON "public"."community_posts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users insert own wa link" ON "public"."whatsapp_links" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert reports" ON "public"."content_reports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "reporter_id"));



CREATE POLICY "Users manage comment likes" ON "public"."comment_likes" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own pairing codes" ON "public"."pairing_codes" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own comments" ON "public"."community_comments" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own posts" ON "public"."community_posts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users update own wa link" ON "public"."whatsapp_links" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users view own reports" ON "public"."content_reports" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "reporter_id"));



CREATE POLICY "Users view own wa chats" ON "public"."whatsapp_chats" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users view own wa link" ON "public"."whatsapp_links" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "View own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "View own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role")));



CREATE POLICY "admin_delete_all_diagnoses" ON "public"."plant_diagnoses" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "admin_read_all_diagnoses" ON "public"."plant_diagnoses" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



ALTER TABLE "public"."ai_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_conversations_delete" ON "public"."ai_conversations" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "ai_conversations_insert" ON "public"."ai_conversations" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "ai_conversations_select" ON "public"."ai_conversations" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "ai_conversations_update" ON "public"."ai_conversations" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ai_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_messages_delete" ON "public"."ai_messages" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ai_conversations" "c"
  WHERE (("c"."id" = "ai_messages"."conversation_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "ai_messages_insert" ON "public"."ai_messages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ai_conversations" "c"
  WHERE (("c"."id" = "ai_messages"."conversation_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "ai_messages_select" ON "public"."ai_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ai_conversations" "c"
  WHERE (("c"."id" = "ai_messages"."conversation_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "allow service role full access" ON "public"."whatsapp_chats" USING (true) WITH CHECK (true);



ALTER TABLE "public"."article_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."articles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pairing_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plant_diagnoses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_public_read" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "profiles_public_read_community" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "public_email_check" ON "public"."profiles" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."user_plants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wa_chats_admin_select" ON "public"."whatsapp_chats" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



ALTER TABLE "public"."whatsapp_chats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_links" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";






















































































































































GRANT ALL ON FUNCTION "public"."get_email_provider"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_email_provider"("p_email" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."hook_block_oauth_without_register"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hook_block_oauth_without_register"("event" "jsonb") TO "supabase_auth_admin";


















GRANT ALL ON TABLE "public"."ai_conversations" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."ai_conversations" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."ai_conversations" TO "authenticated";



GRANT ALL ON TABLE "public"."ai_messages" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."ai_messages" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."ai_messages" TO "authenticated";



GRANT ALL ON TABLE "public"."article_categories" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."article_categories" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."article_categories" TO "authenticated";



GRANT ALL ON TABLE "public"."articles" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."articles" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."articles" TO "authenticated";



GRANT ALL ON TABLE "public"."comment_likes" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."comment_likes" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."comment_likes" TO "authenticated";



GRANT ALL ON TABLE "public"."community_comments" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."community_comments" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."community_comments" TO "authenticated";



GRANT ALL ON TABLE "public"."community_posts" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."community_posts" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."community_posts" TO "authenticated";



GRANT ALL ON TABLE "public"."content_reports" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."content_reports" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."content_reports" TO "authenticated";



GRANT ALL ON TABLE "public"."notifications" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notifications" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notifications" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."pairing_codes" TO "service_role";



GRANT ALL ON TABLE "public"."plant_diagnoses" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."plant_diagnoses" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."plant_diagnoses" TO "authenticated";



GRANT ALL ON TABLE "public"."post_likes" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."post_likes" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."post_likes" TO "authenticated";



GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."user_plants" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_plants" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_plants" TO "authenticated";



GRANT ALL ON TABLE "public"."user_roles" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_roles" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_roles" TO "authenticated";



GRANT ALL ON TABLE "public"."whatsapp_chats" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."whatsapp_chats" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."whatsapp_chats" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."whatsapp_links" TO "service_role";


































