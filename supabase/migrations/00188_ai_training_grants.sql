-- Grant table privileges for AI Training Center (RLS still applies for authenticated)

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_knowledge_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_unanswered_questions TO authenticated;
GRANT SELECT ON TABLE public.ai_knowledge_usage_logs TO authenticated;

GRANT ALL ON TABLE public.ai_knowledge_entries TO service_role;
GRANT ALL ON TABLE public.ai_unanswered_questions TO service_role;
GRANT ALL ON TABLE public.ai_knowledge_usage_logs TO service_role;
