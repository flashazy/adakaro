# Adakaro — production deployment guide

Deploy the Next.js app on **Vercel** with **Supabase** (PostgreSQL + Auth) and **ClickPesa** (BillPay / webhooks).

---

## 1. Supabase migrations (production)

Your repo has migrations `00001`–`00026` under `supabase/migrations/`. **All of them** should run on the production project in order (not only the subset below).

### Mapping (feature ↔ migration file)

| Your note | Actual file | Purpose |
|-----------|-------------|---------|
| — | `00017_create_founding_school_jwt_fallback.sql` | Founding school RPC + JWT role fallback |
| 00018 | `00018_get_my_school_id.sql` | `get_my_school_id` RPC |
| 00019 | `00019_admin_rls_is_school_admin.sql` | Admin RLS via `is_school_admin` |
| 00020 | `00020_orphan_school_creator_rls.sql` | Orphan school creator + helpers |
| 00021 | `00021_clickpesa_tables.sql` | ClickPesa-related tables (+ `parent_id` as in this migration) |
| 00022 | `00022_clickpesa_checkout_link.sql` | `checkout_link` column |
| 00023 | `00023_school_currency.sql` | `schools.currency` |
| 00024 | `00024_parent_link_requests_admin_visibility.sql` | Parent link requests RLS + lookup |
| 00025 | `00025_admin_parent_link_request_rpcs.sql` | Admin RPCs for link requests |
| 00026 | `00026_parent_link_request_visibility_and_cancel.sql` | Visibility helper + lookup prefer-school + parent cancel |

Earlier migrations (`00001`–`00016`, etc.) are required for schema, RLS, parent links, fees, etc.

### Confirm migrations are applied

**Option A — Supabase CLI (recommended)**

```bash
# Link to production once
supabase link --project-ref <YOUR_PRODUCTION_PROJECT_REF>

# See remote status
supabase db remote commit   # or: supabase migration list --linked
```

Push pending migrations:

```bash
supabase db push
```

**Option B — Dashboard**

1. Supabase → **Database** → **Migrations** (if shown) or run SQL manually.
2. Or SQL Editor:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

Compare with filenames in `supabase/migrations/` (version = leading number).

**Option C — Smoke checks in SQL Editor**

Run quick existence checks, e.g.:

```sql
-- RPCs
select proname from pg_proc
where proname in (
  'get_my_school_id',
  'get_pending_parent_link_requests_for_admin',
  'admin_approve_parent_link_request',
  'lookup_student_by_admission'
);

-- Columns
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'schools' and column_name = 'currency';
```

---

## 2. Environment variables (Vercel)

Set these in **Vercel → Project → Settings → Environment Variables** for **Production** (and Preview if you use staging Supabase).

### Required

| Variable | Production value | Notes |
|----------|------------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project **anon** `public` key | Safe for browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Project **service_role** key | **Server only** — webhooks, admin client |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.com` | Canonical site URL (no trailing slash). Use your **production** Vercel URL or custom domain |
| `CLICKPESA_CLIENT_ID` | From ClickPesa | BillPay / API |
| `CLICKPESA_API_KEY` | From ClickPesa | Used with client id for token + BillPay |

### Strongly recommended

| Variable | Suggested value | Notes |
|----------|-----------------|--------|
| `CLICKPESA_BASE_URL` | `https://api.clickpesa.com/third-parties` | Default in code matches this; set explicitly in prod for clarity |
| `CLICKPESA_ORDER_CURRENCY` | `TZS` or `USD` | ClickPesa checkout/order currency (API supports TZS \| USD). Align with how you bill in ClickPesa |

### Optional (defaults usually fine)

| Variable | When to set |
|----------|-------------|
| `CLICKPESA_CHECKOUT_PATH` | If ClickPesa gives a different checkout path than default |
| `CLICKPESA_TOKEN_PATH` | Override token endpoint path |
| `CLICKPESA_BILLPAY_CREATE_PATH` | Override BillPay control-number path |
| `CLICKPESA_DEFAULT_CUSTOMER_PHONE` | E.164 phone if parents often lack phone on profile (checkout) |
| `CLICKPESA_CHECKSUM_SECRET` | Reserved for future webhook signature verification (not wired in code yet) |
| `CLICKPESA_ACCESS_TOKEN` | **Avoid in production** — short-lived; for local debug only |

### Security rules

- Never commit `.env.local` or paste **service role** into client code.
- `SUPABASE_SERVICE_ROLE_KEY` only on Vercel **server** (Route Handlers, Server Actions using `createAdminClient`).

---

## 3. Supabase Auth (production URL)

After you know the production URL:

1. Supabase → **Authentication** → **URL configuration**
2. **Site URL**: `https://your-production-domain.com`
3. **Redirect URLs**: add the same + `https://your-production-domain.com/**` and any Vercel preview URLs you use

---

## 4. ClickPesa webhook

**Production webhook URL:**

```text
https://<YOUR_PRODUCTION_DOMAIN>/api/clickpesa/webhook
```

1. In the **ClickPesa** merchant/partner dashboard, register this URL for payment / BillPay callbacks (per their docs).
2. Use **HTTPS** only (Vercel provides this).
3. After changing domain, **update** the webhook URL in ClickPesa.

The handler expects JSON (e.g. `event`, `data` / `orderReference`). Adjust payload mapping with ClickPesa if their live format differs from sandbox.

---

## 5. Git: commit and push to `main`

If the folder is not yet a git repository:

```bash
cd /path/to/adakaro
git init
git remote add origin <YOUR_GIT_REMOTE_URL>
```

Typical workflow:

```bash
git status
git add -A
git commit -m "chore: prepare production deployment"
git branch -M main
git push -u origin main
```

If `main` already exists remotely:

```bash
git checkout main
git pull origin main
git add -A
git commit -m "chore: production-ready build"
git push origin main
```

---

## 6. Vercel deployment

1. **Import** the Git repo in Vercel (or connect existing project).
2. **Framework**: Next.js (default).
3. **Root directory**: repo root (unless monorepo).
4. Add **all** environment variables from section 2.
5. Deploy **Production** from `main`.

Optional: enable **Vercel → Environment Variables** for Preview with a **staging** Supabase project so previews do not hit production data.

---

## 7. Post-deploy testing checklist

- [ ] **Admin**: log in → dashboard loads → school settings (currency) → classes / students / fees
- [ ] **Parent**: log in → parent dashboard → linked children / balances
- [ ] **Parent link requests**: parent submits → admin sees on `/dashboard/parent-requests` → approve/reject
- [ ] **ClickPesa**: generate control number (small test amount) → webhook fires → payment row / receipt updated in Supabase (check **Database** + app UI)
- [ ] **Auth**: password reset / magic link if used — confirm redirect URLs on production

---

## 8. Known caveats & risks

| Topic | Note |
|-------|------|
| **ClickPesa checkout link** | May stay disabled until ClickPesa enables it on your account; control number flow can still work |
| **CLICKPESA_ORDER_CURRENCY** | School multi-currency (TZS/KES/UGX/USD) in the app is separate from ClickPesa’s API currency (often TZS/USD); confirm with ClickPesa what they settle in |
| **Webhook URL** | Every new production domain requires an update in ClickPesa |
| **Webhook security** | Verify whether ClickPesa signs payloads; implement verification with `CLICKPESA_CHECKSUM_SECRET` when documented |
| **Service role** | Bypasses RLS — only use server-side for trusted operations (e.g. webhook) |
| **Migrations** | Never skip ordering; use `db push` or managed migrations against **one** source of truth |
| **CORS / cookies** | Supabase SSR cookies work on the production domain; avoid mixing `www` and apex without redirects |

---

## 9. Quick reference — production URLs

| Item | URL pattern |
|------|-------------|
| App | `https://<domain>` |
| ClickPesa webhook | `https://<domain>/api/clickpesa/webhook` |
| ClickPesa API route (if used) | `https://<domain>/api/clickpesa/...` |

---

*Last updated to match migrations through `00026` and env usage in the Adakaro codebase.*
