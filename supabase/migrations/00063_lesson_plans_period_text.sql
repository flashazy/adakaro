-- Store human-readable period labels (single or consecutive), e.g. "1st period", "1st & 2nd period".

ALTER TABLE public.lesson_plans
  DROP CONSTRAINT IF EXISTS lesson_plans_period_check;

ALTER TABLE public.lesson_plans
  ALTER COLUMN period TYPE text USING (
    CASE
      WHEN period IS NULL THEN NULL
      ELSE (
        CASE period::integer
          WHEN 1 THEN '1st period'
          WHEN 2 THEN '2nd period'
          WHEN 3 THEN '3rd period'
          WHEN 4 THEN '4th period'
          WHEN 5 THEN '5th period'
          WHEN 6 THEN '6th period'
          WHEN 7 THEN '7th period'
          WHEN 8 THEN '8th period'
          WHEN 9 THEN '9th period'
          WHEN 10 THEN '10th period'
          WHEN 11 THEN '11th period'
          WHEN 12 THEN '12th period'
          ELSE concat(period::text, 'th period')
        END
      )
    END
  );

ALTER TABLE public.lesson_plans
  ALTER COLUMN period SET NOT NULL;

ALTER TABLE public.lesson_plans
  ADD CONSTRAINT lesson_plans_period_not_empty CHECK (length(trim(period)) > 0);
