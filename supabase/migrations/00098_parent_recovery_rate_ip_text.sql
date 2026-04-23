-- Use plain text for client IPs so PostgREST .eq() matches reliably and values
-- like "unknown" or full x-forwarded-for tokens are not cast through inet
-- (which can break filters/inserts and make rate limit queries error or mismatch).
ALTER TABLE public.parent_recovery_rate_events
  ALTER COLUMN ip TYPE text
  USING (ip::text);
