# Adakaro Mobile (Flutter)

Self-contained Flutter app under `mobile/`. It does **not** modify the Next.js web app. It uses the **same Supabase project** (anon key + URL) as the web client, so **Row Level Security** and auth rules match production.

Routing uses Flutter’s built-in **Navigator** (MaterialApp + routes pushed from splash/login). You can introduce `go_router` later if you want declarative URLs; it is not required for the current parent flow.

## Prerequisites

- [Flutter SDK](https://docs.flutter.dev/get-started/install) (stable), `flutter` on your `PATH`
- Supabase **project URL** and **anon** key (same as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` on the web app). Never use the **service role** key in the app.

## One-time project bootstrap

If `android/` or `ios/` is missing (first clone), generate platform folders **without** overwriting your `lib/` code:

```bash
cd mobile
chmod +x tool/bootstrap_flutter.sh   # once
./tool/bootstrap_flutter.sh
```

Or manually:

```bash
cd mobile
flutter create . --project-name adakaro_mobile
flutter pub get
flutter analyze
```

`flutter create .` is safe to run again: it repairs missing platform files and keeps existing Dart sources.

## Configure Supabase (compile-time)

Secrets are passed with **`--dart-define`** (not committed to git).

### Required

| Define | Meaning |
|--------|---------|
| `SUPABASE_URL` | Same as web `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Same as web `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

### Optional (password reset from the device)

| Define | Meaning |
|--------|---------|
| `AUTH_REDIRECT_URL` | Redirect used by `resetPasswordForEmail`. Example: `adakaro://auth-callback` |

1. In **Supabase Dashboard → Authentication → URL configuration**, add the same value to **Redirect URLs** (e.g. `adakaro://auth-callback`).
2. Configure the app to handle that URL scheme on each platform (after `flutter create`):

**Android** — in `android/app/src/main/AndroidManifest.xml`, inside the `<activity android:name=".MainActivity" ...>` element, add an `<intent-filter>`:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="adakaro" android:host="auth-callback" />
</intent-filter>
```

**iOS** — in Xcode or `ios/Runner/Info.plist`, add a URL type with URL Schemes `adakaro` and a suitable identifier.

If `AUTH_REDIRECT_URL` is **omitted**, `resetPasswordForEmail` runs without `redirectTo` and Supabase uses your project **Site URL** (often the website). Users can still complete reset in the browser; the in-app “recovery session” flow works when the link opens the app via the scheme above.

The app initializes Supabase with **`detectSessionInUri: true`** so recovery/OAuth tokens in the launch URL are picked up when supported.

## Run

```bash
cd mobile
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your_anon_key_here
```

With password-reset deep link:

```bash
flutter run \
  --dart-define=SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your_anon_key_here \
  --dart-define=AUTH_REDIRECT_URL=adakaro://auth-callback
```

### VS Code / Android Studio

Add the same `dart-define` entries to your **launch.json** / run configuration.

## Features (current)

- Splash → session check → **Login** (email/password) or home  
- **Forgot password** → `resetPasswordForEmail` (optional `AUTH_REDIRECT_URL`)  
- **Password recovery** → when Supabase emits `passwordRecovery`, **Set new password** screen, then normal role routing  
- Role resolution aligned with web middleware (`is_super_admin`, `profiles.role`, `is_teacher`; `finance` / `accounts` → admin)  
- **Parent** (and school admin with linked children): dashboard, fees, payments, student profile, alerts placeholder — with **loading**, **empty**, and **refresh error** states  
- **Teacher / super admin / admin without linked students**: “continue on web” screen; **Sign out** returns to login  

## Commands checklist

```bash
cd mobile
./tool/bootstrap_flutter.sh    # or: flutter create . && flutter pub get
flutter analyze
flutter run  # with dart-defines as above
```

## Extending

- Add `go_router` if you need named routes or web URL sync.  
- Add push notifications or parent broadcast lists under `lib/features/` using the same anon client and RLS.
