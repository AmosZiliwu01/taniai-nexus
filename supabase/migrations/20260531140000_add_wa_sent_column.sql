ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS wa_sent BOOLEAN NOT NULL DEFAULT false;
 
CREATE INDEX IF NOT EXISTS idx_notifications_wa_pending
  ON public.notifications (user_id, wa_sent, created_at)
  WHERE wa_sent = false;
 
DROP POLICY IF EXISTS "Service role manage notifications" ON public.notifications;
CREATE POLICY "Service role manage notifications"
  ON public.notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
 