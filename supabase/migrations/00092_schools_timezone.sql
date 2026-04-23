-- Display timezone for school-scoped timestamps (IANA name, e.g. Africa/Dar_es_Salaam).

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS timezone text;

COMMENT ON COLUMN public.schools.timezone IS 'IANA timezone for UI display (e.g. Africa/Dar_es_Salaam); null falls back to app default';
