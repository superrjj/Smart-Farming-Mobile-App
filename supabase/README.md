# Supabase Edge Functions — step-by-step integration

Password-reset email is sent by the **`send-password-reset`** Edge Function using **SendGrid**. Secrets stay on Supabase; the Expo app only calls `supabase.functions.invoke`.

---

## Step 1 — Run the Supabase CLI (Windows-friendly)

The `supabase` command is **not** on your PATH until you install it. You do **not** need a global install if you use **npx** or the npm script in this repo.

**Option A — From this project (recommended on Windows):**

```bash
npm run supabase -- --version
npm run supabase -- login
npm run supabase -- link --project-ref YOUR_PROJECT_REF
```

(Everything after `--` is passed to the CLI.)

**Option B — npx each time:**

```bash
npx supabase@latest login
```

**Option C — Global install** (then `supabase` works everywhere):

```bash
npm install -g supabase
```

Official reference: [Install Supabase CLI](https://supabase.com/docs/guides/cli/getting-started).

On **PowerShell**, chain commands with `;` instead of `&&` if you see parse errors.

After `supabase link`, if the CLI warns that **local DB version** differs from the cloud project, set `[db] major_version` in `supabase/config.toml` to the version the CLI prints (this project uses **17** for `xzouepokakzubwjogmdr`).

### Editor red squiggles in `supabase/functions/**/*.ts`

Edge Functions run on **Deno** (JSR imports, `Deno.serve`, `Deno.env`). Install the **[Deno](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno)** extension. This repo enables Deno only under `./supabase/functions` via `.vscode/settings.json` so the rest of the Expo app still uses the normal TypeScript tooling.

---

## Step 2 — Log in and link this repo to your project

From the **repository root** (where `supabase/` lives):

```bash
supabase login
```

Link using your **project ref** (the subdomain in `https://YOUR_REF.supabase.co`):

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

Example: if the dashboard URL is `https://supabase.com/dashboard/project/abcd1234`, the ref is `abcd1234`.

This writes local link metadata so `supabase functions deploy` targets the right project.

---

## Step 3 — SendGrid account

1. Create a [SendGrid](https://sendgrid.com/) API key with **Mail Send** permission.
2. Complete **Sender Authentication** (single sender or domain) and use that address for `SENDGRID_FROM_EMAIL`.

---

## Step 4 — Set Edge Function secrets (hosted)

Still from the repo root:

```bash
supabase secrets set SENDGRID_API_KEY="SG.paste_your_key_here" SENDGRID_FROM_EMAIL="verified-sender@yourdomain.com"
```

In the **Dashboard**, you can use those names or the `EXPO_PUBLIC_SENDGRID_*` names if you already created them; the function reads **both** (prefer `SENDGRID_*` for clarity—`EXPO_PUBLIC_` does not mean “public” on the server).

**Do not** put real API keys in Expo `EXPO_PUBLIC_*` app env if you can avoid it; use Edge secrets instead.

Supabase automatically provides **`SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`** to deployed functions; you normally do not set them with `secrets set`.

Optional but **recommended for production**: set a long random string so reset codes cannot be forged if someone reads the DB:

```bash
npm run supabase -- secrets set PASSWORD_RESET_SECRET="paste-a-long-random-string"
```

If you omit it, functions fall back to a built-in default pepper (change this secret later to invalidate all outstanding codes).

---

## Step 5 — Database columns for reset codes (Edge mode)

With **`EXPO_PUBLIC_PASSWORD_RESET_USE_EDGE=true`**, the app checks the 6-digit code against **hashed** values in Postgres (10-minute expiry).

Run the SQL in **`supabase/migrations/20260414120000_add_password_reset_token_columns.sql`** in the Supabase **SQL Editor** (or apply via CLI migrations). It adds to **`user_profiles`**:

- `password_reset_code_hash` (text, nullable)
- `password_reset_expires_at` (timestamptz, nullable)

Until these columns exist, `send-password-reset` returns an error when it tries to save the code.

---

## Step 6 — Deploy Edge Functions

Deploy all password-reset functions (shared code lives under `supabase/functions/_shared/`):

```bash
npm run supabase -- functions deploy send-password-reset
npm run supabase -- functions deploy verify-password-reset
npm run supabase -- functions deploy invalidate-password-reset
```

Or deploy every function in the repo in one go:

```bash
npm run supabase -- functions deploy
```

### JWT verification (logged-out users)

`supabase/config.toml` sets **`verify_jwt = false`** for these functions so forgot-password works without a session.

If the dashboard still enforces JWT for a function, deploy with `--no-verify-jwt` for that name, or disable **Verify JWT** per function in the Dashboard.

---

## Step 7 — App code (already wired)

`lib/sendgrid.ts` keeps the **email HTML layout** (`buildPasswordResetEmailHtml`) for the **default** path: SendGrid from the app using `lib/sendgridConfig.ts`. That works **before** you install or deploy Edge Functions.

**After** you complete Steps 4–6, switch the app to Edge mode in `.env` / EAS:

```env
EXPO_PUBLIC_PASSWORD_RESET_USE_EDGE=true
```

Then rebuild. In that mode:

- **`send-password-reset`** — `invoke` with `{ email }` only; the server generates the 6-digit code, stores **hash + expiry (10 min)** on `user_profiles`, and emails the code.
- **`verify-password-reset`** — used on **Verify Code** so the typed code must match and still be valid.
- **`invalidate-password-reset`** — clears the token after a successful password change.

Without Edge mode, the login screen keeps the code in memory for 10 minutes and compares it locally (still no “any number works”).

Ensure `lib/supabase.ts` uses the **same** Supabase project URL and **anon** key as the one you linked in Step 2.

With `EXPO_PUBLIC_PASSWORD_RESET_USE_EDGE=true`, you do **not** need `EXPO_PUBLIC_SENDGRID_API_KEY` in the app (secrets stay on Supabase).

---

## Step 8 — Verify end-to-end

1. In the dashboard: **Edge Functions** → confirm **`send-password-reset`**, **`verify-password-reset`**, and **`invalidate-password-reset`** are listed; check **Logs** after a test.
2. On a device or emulator: **Forgot password** → enter a registered email → **Send code**.
3. If it fails, open **Edge Functions → Logs** and check for missing secrets or SendGrid errors (e.g. unverified sender).

---

## Optional — Local testing

Create `supabase/.env.local` (gitignored if you use a root pattern like `.env*.local`):

```env
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=you@verified-domain.com
```

Serve:

```bash
supabase functions serve send-password-reset --no-verify-jwt --env-file supabase/.env.local
```

Local invoke uses a different base URL unless you point the app at local Supabase; most teams only test **after deploy** (Steps 4–5).

---

## Troubleshooting

| Symptom | What to check |
|--------|----------------|
| “SendGrid is not configured” in logs | Run Step 4 again; redeploy after setting secrets. |
| 403 from function | Email not found in **`user_profiles`** (exact match to how the app stores email). |
| SendGrid 403 | Sender not verified; fix in SendGrid. |
| CORS (web only) | Function already returns CORS headers for `OPTIONS`. |
| JWT / 401 on invoke | Use Step 5 JWT note; forgot-password is **logged out**. |

---

## Security note

With **`verify_jwt = false`**, anyone who discovers the function URL can attempt requests. The function only emails addresses that exist in **`user_profiles`**. For production hardening, add rate limiting (e.g. DB table + timestamps) or CAPTCHA later.
