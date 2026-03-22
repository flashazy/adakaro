# School creation (`create_founding_school`) troubleshooting

## 1. Apply migrations

Run in order (Supabase CLI or SQL Editor):

- `00016_create_founding_school_rpc.sql` — creates the RPC + `school_members` insert policy  
- `00017_create_founding_school_jwt_fallback.sql` — allows admin via **`profiles.role`** *or* **`user_metadata.role`** in the JWT  
- **`00018_get_my_school_id.sql`** — adds **`get_my_school_id()`** + **`Users can view own memberships`** on **`school_members`** so the dashboard can **read** your row after creation (fixes “SQL shows school but UI still asks to create”).

After changes, in Dashboard: **Settings → API → Reload schema** (if PostgREST caches an old schema).

## 2. Ensure your user is an admin

Replace the email if needed.

```sql
-- Inspect profile + auth user
select u.id, u.email, p.role as profile_role
from auth.users u
left join public.profiles p on p.id = u.id
where u.email = 'abdahomy@gmail.com';

-- Force admin on profile (recommended)
update public.profiles
set role = 'admin', updated_at = now()
where id = (select id from auth.users where email = 'abdahomy@gmail.com' limit 1);
```

If there is **no `profiles` row**, add one (trigger usually creates it on signup):

```sql
insert into public.profiles (id, full_name, email, role)
select id,
       coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
       email,
       'admin'
from auth.users
where email = 'abdahomy@gmail.com'
on conflict (id) do update
set role = 'admin', updated_at = now();
```

## 3. RLS and RPC

`create_founding_school` is **`SECURITY DEFINER`**: it runs with the function owner’s privileges and **inserts into `schools` and `school_members` without going through your table RLS** for those statements. You still need:

- Migration **`00016`** applied so the function exists and **`authenticated`** has **`EXECUTE`**.
- No conflicting deny on the function (default is fine after `GRANT EXECUTE`).

## 4. API returns JSON

`POST /api/schools/create` always returns JSON, including errors (`error`, optional `code`, `details`, `hint`).  
If the UI showed nothing before, it was often a **non-JSON** error page combined with `response.json()` throwing; the modal now uses **`text()` + `JSON.parse`** and **`alert()`** on failure.
