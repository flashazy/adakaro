-- Teacher remarks on gradebook scores (separate from legacy comments column).
ALTER TABLE public.teacher_scores
  ADD COLUMN IF NOT EXISTS remarks TEXT;
