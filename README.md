# PetPortfolio 🐾

Private app for pet owners: pet journal + photo memories + health organizer + sitter helper + yearly memory books.

Expo · React Native · TypeScript · Expo Router · Supabase · RevenueCat · Expo Notifications.

## Setup

```bash
cd petportfolio-app
npm install
cp .env.example .env   # then fill in values below
```

### Environment variables

| Var | Required | What |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | For cloud sync | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | For cloud sync | Supabase anon key (never the service-role key) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | No | RevenueCat iOS API key |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | No | RevenueCat Android API key |
| `EXPO_PUBLIC_REVENUECAT_WEB_KEY` | No | RevenueCat Web Billing API key |
| `EXPO_PUBLIC_CARE_CARD_BASE_URL` | No | Base URL for Care Card links (default `https://petportfolio.app`) |

Without Supabase keys the app runs in **offline demo mode** (data in AsyncStorage). Without RevenueCat keys it runs in **free mode** with a 14-day premium trial — it never crashes.

## Supabase setup

Auth is **Google-only** — there are no passwords anywhere in the app.

1. Create a project at supabase.com.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor (creates tables, RLS, storage policies).
3. The migrations create private `pet-images` and `documents` storage buckets with owner/member access policies.
4. Enable Google sign-in: Supabase Dashboard → Authentication → Providers → Google → enable it with
a Client ID + Client Secret from [Google Cloud Console](https://console.cloud.google.com) (APIs & Services → Credentials → OAuth client ID; add the app's bundle/package as needed).
5. Add `petportfolio://**` under Authentication → URL Configuration → Redirect URLs.
   Google OAuth requires a development or production build; Expo Go cannot test custom-scheme OAuth reliably.
6. Deploy the account-deletion function: `npx supabase functions deploy delete-account`.
7. Copy the project URL + anon key into `.env`.

Permissions (Owner / Viewer / Carer) are enforced by RLS policies, not just the UI.

## Run

```bash
npx expo start          # scan QR with Expo Go
npx expo start --ios
npx expo start --android
npx expo start --web
```

Checks:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npx expo config --type public   # verify Expo config
```

## Development builds

Push notifications, RevenueCat purchases and camera need a dev build (they don't fully work in Expo Go):

```bash
npx expo prebuild
npx expo run:ios
npx expo run:android
```

EAS:

```bash
npm i -g eas-cli
eas build --profile development
```

## Notes

- PDFs use `expo-print` (real HTML → PDF) + `expo-sharing`. Memory books pick ≤60 photos spread across the year (favorites first).
- Care Cards are secure random-token links (`/c/<token>`), revocable + optionally expiring, read-only, exposing only selected fields.
- Health screens show “For personal use only. Not veterinary advice.” — no diagnosis features exist by design.
