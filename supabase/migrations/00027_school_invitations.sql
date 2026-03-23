Here’s what was added for multiple admins + invitations.

1. Migration supabase/migrations/00027_school_invitations.sql
schools.plan: text NOT NULL DEFAULT 'free' with check free | basic | pro | enterprise.
school_invitations: school_id, invited_email, invited_by → profiles, token (unique), status (pending / accepted / expired), expires_at (default +7 days), accepted_at.
RLS: Admins of the school can select/insert/update/delete invitations; invitees can select their own pending rows (email match via auth.users).
accept_school_invitation(p_token) (SECURITY DEFINER): validates token, email, adds school_members admin, sets `profiles.role = 'admin', marks invite accepted.
is_email_already_school_admin(p_school_id, p_email) (SECURITY DEFINER): used by the invite API when RLS would hide profiles.
peek_school_invitation(p_token) (SECURITY DEFINER, GRANT … TO anon): powers the accept page before sign-in.
2. lib/plans.ts
PLAN_LIMITS, normalizePlanId, getPlanLimit, planDisplayName.
3. Team UI
/dashboard/team: heading, plan line (Free: 1/1 style), admin table (name, email, role, joined, Remove except creator), Invite new admin modal, pending invites list.
invite-modal.tsx, team-page-client.tsx, remove-admin-button.tsx.
4. APIs
POST /api/schools/invite: validates admin, admins + pending invites vs plan cap, duplicate email/member checks, inserts invite, logs full accept URL to the server console.
POST /api/schools/remove-admin: JSON { "user_id": "…" } (also accepts userId); blocks removing schools.created_by.
POST /api/schools/accept-invitation: body { "token": "…" }; calls accept_school_invitation.
5. Accept flow
/accept-invitation?token=…: uses peek_school_invitation; sign-in / sign-up links preserve next.
login: hidden next + LoginForm in Suspense; signup passes next through; login / signup actions redirect to next when it’s a safe internal path.
6. Dashboard
New Team quick action → /dashboard/team.
7. Types
types/supabase.ts: schools.plan, school_invitations, RPCs accept_school_invitation, is_email_already_school_admin, peek_school_invitation.
8. core_schema_idempotent.sql
plan column + check; comment pointing at 00027 for invitations.
Apply DB changes: run the new migration against Supabase (e.g. supabase db push or your usual flow).

npx tsc --noEmit passes.

How to test

Open /dashboard/team, invite a second email → check server logs for the accept link.
Open link (or sign in with next) → Accept invitation → /dashboard?inviteAccepted=1.
On free plan with 1 admin and no pending, inviting again should return 409 limit.
Remove a non-creator admin; creator has no remove button and API returns 403 if forced.Here’s what was added for multiple admins + invitations.

1. Migration supabase/migrations/00027_school_invitations.sql
schools.plan: text NOT NULL DEFAULT 'free' with check free | basic | pro | enterprise.
school_invitations: school_id, invited_email, invited_by → profiles, token (unique), status (pending / accepted / expired), expires_at (default +7 days), accepted_at.
RLS: Admins of the school can select/insert/update/delete invitations; invitees can select their own pending rows (email match via auth.users).
accept_school_invitation(p_token) (SECURITY DEFINER): validates token, email, adds school_members admin, sets `profiles.role = 'admin', marks invite accepted.
is_email_already_school_admin(p_school_id, p_email) (SECURITY DEFINER): used by the invite API when RLS would hide profiles.
peek_school_invitation(p_token) (SECURITY DEFINER, GRANT … TO anon): powers the accept page before sign-in.
2. lib/plans.ts
PLAN_LIMITS, normalizePlanId, getPlanLimit, planDisplayName.
3. Team UI
/dashboard/team: heading, plan line (Free: 1/1 style), admin table (name, email, role, joined, Remove except creator), Invite new admin modal, pending invites list.
invite-modal.tsx, team-page-client.tsx, remove-admin-button.tsx.
4. APIs
POST /api/schools/invite: validates admin, admins + pending invites vs plan cap, duplicate email/member checks, inserts invite, logs full accept URL to the server console.
POST /api/schools/remove-admin: JSON { "user_id": "…" } (also accepts userId); blocks removing schools.created_by.
POST /api/schools/accept-invitation: body { "token": "…" }; calls accept_school_invitation.
5. Accept flow
/accept-invitation?token=…: uses peek_school_invitation; sign-in / sign-up links preserve next.
login: hidden next + LoginForm in Suspense; signup passes next through; login / signup actions redirect to next when it’s a safe internal path.
6. Dashboard
New Team quick action → /dashboard/team.
7. Types
types/supabase.ts: schools.plan, school_invitations, RPCs accept_school_invitation, is_email_already_school_admin, peek_school_invitation.
8. core_schema_idempotent.sql
plan column + check; comment pointing at 00027 for invitations.
Apply DB changes: run the new migration against Supabase (e.g. supabase db push or your usual flow).

npx tsc --noEmit passes.

How to test

Open /dashboard/team, invite a second email → check server logs for the accept link.
Open link (or sign in with next) → Accept invitation → /dashboard?inviteAccepted=1.
On free plan with 1 admin and no pending, inviting again should return 409 limit.
Remove a non-creator admin; creator has no remove button and API returns 403 if forced.