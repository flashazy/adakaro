-- Remap legacy knowledge categories to the enterprise taxonomy.
-- Existing entries are preserved; only the category label is updated where a mapping exists.

UPDATE public.ai_knowledge_entries
SET category = 'Technical Support', updated_at = now()
WHERE category = 'Support';

UPDATE public.ai_knowledge_entries
SET category = 'Curriculum & Syllabus', updated_at = now()
WHERE category = 'Syllabus';

UPDATE public.ai_knowledge_entries
SET category = 'Getting Started', updated_at = now()
WHERE category = 'Onboarding';

UPDATE public.ai_knowledge_entries
SET category = 'Frequently Asked Questions', updated_at = now()
WHERE category IN ('FAQ', 'Faq');

UPDATE public.ai_knowledge_entries
SET category = 'AI Copilot', updated_at = now()
WHERE category = 'Copilot';

UPDATE public.ai_knowledge_approval_queue
SET proposed_category = 'Technical Support', updated_at = now()
WHERE proposed_category = 'Support';

UPDATE public.ai_knowledge_approval_queue
SET proposed_category = 'Curriculum & Syllabus', updated_at = now()
WHERE proposed_category = 'Syllabus';

UPDATE public.ai_knowledge_approval_queue
SET proposed_category = 'Getting Started', updated_at = now()
WHERE proposed_category = 'Onboarding';

UPDATE public.ai_knowledge_approval_queue
SET proposed_category = 'Frequently Asked Questions', updated_at = now()
WHERE proposed_category IN ('FAQ', 'Faq');

UPDATE public.ai_knowledge_approval_queue
SET proposed_category = 'AI Copilot', updated_at = now()
WHERE proposed_category = 'Copilot';
