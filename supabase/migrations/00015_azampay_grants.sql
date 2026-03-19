-- Ensure service_role and authenticated have full access to azampay_pending_payments
-- (fixes "permission denied" when using admin client)
GRANT ALL ON public.azampay_pending_payments TO service_role;
GRANT ALL ON public.azampay_pending_payments TO authenticated;
