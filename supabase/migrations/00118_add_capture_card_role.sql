-- Capture Card Portal: add role enum value before any objects reference it.
-- Runs before 00118_students_health_profile_fields.sql and 00119_capture_card_portal.sql (lexical order).

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'capture_card_user';
