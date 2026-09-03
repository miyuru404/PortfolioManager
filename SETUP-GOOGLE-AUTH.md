# Google Sign-In Setup (via Supabase Auth)

This app already uses Supabase for email/password auth (`app/auth/page.tsx`).
Google sign-in is added the same way, through Supabase's built-in OAuth
support — no NextAuth, no Prisma, no separate database needed.

## 1. Create Google OAuth credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) → create/select a project.
2. **APIs & Services → OAuth consent screen** — configure it (External, add your app name/support email). Publish it (or add yourself as a test user) so sign-in isn't blocked.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type: **Web application**.
4. Add this **Authorized redirect URI** (get the exact value from Supabase in step 2 below — it looks like):
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
5. Copy the **Client ID** and **Client Secret**.

## 2. Enable the Google provider in Supabase

1. Supabase Dashboard → your project → **Authentication → Providers → Google**.
2. Toggle it on, paste the Client ID and Client Secret from step 1.
3. Supabase shows you the exact callback URL to use in Google Cloud Console — copy it there if you haven't already.
4. **Authentication → URL Configuration**:
   - **Site URL**: your production URL, e.g. `https://your-app.vercel.app`
   - **Redirect URLs**: add
     ```
     http://localhost:3000/auth/callback
     https://your-app.vercel.app/auth/callback
     ```
     (add any Vercel preview-deployment domains too, or a wildcard like `https://*.vercel.app/auth/callback` if you use previews)

## 3. App code (already done in this repo)

- `app/auth/page.tsx` has a "Continue with Google" button calling
  `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin}/auth/callback` } })`.
- `app/auth/callback/route.ts` receives the redirect, exchanges the `code`
  for a session via `supabase.auth.exchangeCodeForSession(code)`, and
  redirects into the app.

No new npm packages, no Prisma schema, and no `DATABASE_URL` are required —
Supabase manages the OAuth token exchange and the user record itself, and
existing email/password users are automatically matched by email.

## 4. Environment variables

Only the existing Supabase vars are needed at the app level:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

The Google Client ID/Secret live in the Supabase dashboard (step 2), not in
`.env.local` or Vercel's environment variables — the Next.js app never talks
to Google directly.

## 5. Test it

1. `npm run dev`, visit `http://localhost:3000/auth`.
2. Click "Continue with Google" → should redirect to Google, then back to
   `/auth/callback`, then to `/home`.
3. Deploy to Vercel and re-test on the production URL once the Site URL /
   Redirect URLs in Supabase include it.

## Troubleshooting

- **"redirect_uri_mismatch"** — the URI Google is redirecting to doesn't
  exactly match one in the Google Cloud Console credentials. It must be the
  Supabase callback URL (`https://<ref>.supabase.co/auth/v1/callback`), not
  your app's URL.
- **Redirected back to `/auth?error=oauth_failed`** — check the Supabase
  Authentication logs (Dashboard → Logs → Auth) for the underlying error.
- **Works on localhost but not on Vercel** — add the Vercel domain to
  Supabase's Site URL / Redirect URLs (step 2).
