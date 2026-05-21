# Deployment Guide

Kinetk has two processes that must be deployed separately:

| Process    | Description                         | Platform                  |
| ---------- | ----------------------------------- | ------------------------- |
| **Web**    | Next.js app (API routes + frontend) | Vercel                    |
| **Worker** | Background run processor            | Railway / Render / Fly.io |

Both share the same environment variables and connect to the same Supabase project and PostgreSQL database.

---

## Prerequisites

- A cloud [Supabase](https://supabase.com) project (not the local CLI instance)
- A [Vercel](https://vercel.com) account connected to the GitHub repo
- A worker hosting account (Railway, Render, or Fly.io)

---

## 1. Supabase (cloud project)

1. Create a new project at [supabase.com](https://supabase.com).
2. Run the database migration against the cloud project:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

   Or paste the contents of `supabase/migrations/0001_initial_schema.sql` into the Supabase SQL editor and run it.

3. In the Supabase dashboard, go to **Authentication → URL Configuration** and set:
   - **Site URL**: your production app URL (e.g. `https://kinetk.vercel.app`)
   - **Redirect URLs**: `https://kinetk.vercel.app/auth/callback`

4. Collect the following values from **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

5. Collect the pooled connection string from **Project Settings → Database → Connection pooling** (Transaction mode, port 6543):
   - `DATABASE_URL`

---

## 2. Generate the encryption key

The encryption key is used for workspace secrets (HTTP request credentials). Generate once and store it — losing it makes existing secrets unrecoverable.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Save the output as `APP_ENCRYPTION_KEY_BASE64`.

---

## 3. Deploy the Next.js app (Vercel)

1. In the Vercel dashboard, import the GitHub repository.
2. Vercel auto-detects Next.js — no `vercel.json` is needed.
3. Under **Settings → Environment Variables**, add all variables from `.env.example`:

   | Variable                        | Value                                |
   | ------------------------------- | ------------------------------------ |
   | `NEXT_PUBLIC_SUPABASE_URL`      | From Supabase dashboard              |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase dashboard              |
   | `SUPABASE_SERVICE_ROLE_KEY`     | From Supabase dashboard              |
   | `DATABASE_URL`                  | Pooled connection string (port 6543) |
   | `APP_ENCRYPTION_KEY_BASE64`     | Generated above                      |
   | `NEXT_PUBLIC_APP_URL`           | Your Vercel deployment URL           |

4. Deploy. Vercel redeploys automatically on every push to `main`.

---

## 4. Deploy the worker

The worker is a long-running Node.js process that polls for queued runs every 2 seconds. It cannot run on Vercel (serverless, 10 s execution limit).

### Option A — Railway

1. Create a new Railway project and connect the GitHub repo.
2. Add a new service pointing to the same repo.
3. Set the **Start Command**:
   ```
   TSX_TSCONFIG_PATH=tsconfig.worker.json tsx src/worker/index.ts
   ```
4. Add the same environment variables as the web app (all except `NEXT_PUBLIC_*` are required; `NEXT_PUBLIC_*` are optional but harmless to include).
5. Deploy. Railway restarts the process automatically if it crashes.

### Option B — Render

1. Create a new **Background Worker** service on Render.
2. Connect the GitHub repo and set the **Start Command**:
   ```
   TSX_TSCONFIG_PATH=tsconfig.worker.json tsx src/worker/index.ts
   ```
3. Add environment variables as above.
4. Deploy.

### Option C — Fly.io

Add a `fly.toml` to the repo and use `fly deploy`. See [fly.io docs](https://fly.io/docs/) for setup details.

---

## 5. CI secret (GitHub Actions)

The CI pipeline builds the Next.js app and needs a real `APP_ENCRYPTION_KEY_BASE64` value (the Zod schema validates the 32-byte length).

1. Go to the GitHub repo → **Settings → Secrets and variables → Actions**.
2. Add a secret named `CI_ENCRYPTION_KEY_BASE64` with the same value generated in step 2 (or a separate key just for CI — it is never used to encrypt real data).

---

## 6. Verify the deployment

1. Open the app URL and sign up for an account.
2. Create a workflow, add a node, and confirm the sync status badge shows "Synced".
3. Generate a webhook trigger URL from the workflow detail page.
4. Send a test request:
   ```bash
   curl -X POST https://your-app-url/api/hooks/<token> \
     -H "Content-Type: application/json" \
     -d '{"hello": "world"}'
   ```
   Expected response: `{"accepted": true, "runId": "..."}`.
5. Check the run history on the workflow page — the worker should process the run within a few seconds and the status should show `succeeded`.

If runs stay in `queued` indefinitely, the worker is not running or cannot reach the database.

---

## Environment variable reference

All variables are documented with descriptions in `.env.example` at the repo root.
