# Kinetk Multi-User Roadmap

## 1. Purpose

This roadmap extends Kinetk from a single-developer MVP into a publicly accessible, genuinely multi-user product. It picks up where the original implementation roadmap left off (after Phase 13) and covers going live, hardening security, enabling workspace collaboration, and adding real-time multiplayer presence.

## 2. Build Order Summary

14. Production deployment
15. Row-level security
16. Auth improvements
17. Workspace collaboration (invitations, member management, workspace switcher)
18. Real-time multiplayer presence (cursors)

Each phase depends on the one before it. Do not ship Phase 17 (inviting other users) before Phase 15 (RLS) is in place.

---

## 3. Phase 14: Production Deployment

Goal: Make the app accessible at a public URL with both the web app and worker running in the cloud.

### Group 14.1 — Cloud Supabase Project

Goal: Replace the local Supabase stack with a cloud project.

Steps:

1. Create a new project at [supabase.com](https://supabase.com).
2. Apply the database migration:
   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```
   Or paste `supabase/migrations/0001_initial_schema.sql` into the Supabase SQL editor and run it.
3. In **Authentication → URL Configuration**, set:
   - **Site URL**: production app URL (e.g. `https://kinetk.vercel.app`)
   - **Redirect URLs**: `https://kinetk.vercel.app/auth/callback`
4. Collect required values from **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Collect the pooled connection string from **Project Settings → Database → Connection pooling** (Transaction mode, port 6543):
   - `DATABASE_URL`

Done when:

- Migrations apply cleanly to the cloud project.
- Auth redirect URL is configured.

### Group 14.2 — Next.js App → Vercel

Goal: Deploy the web and API layer.

Steps:

1. Import the GitHub repository into Vercel.
2. Vercel auto-detects Next.js — no `vercel.json` needed.
3. Under **Settings → Environment Variables**, add all variables from `.env.example`. Set `NEXT_PUBLIC_APP_URL` to the Vercel deployment URL.
4. Trigger a deployment.

Done when:

- The app is accessible at the Vercel URL.
- Sign-up, sign-in, and workflow creation work on the production URL.

### Group 14.3 — Worker → Railway or Render

Goal: Deploy the background run processor as a persistent service.

The worker is a long-running Node.js process and cannot run on Vercel (serverless, 10 s limit).

Create `Procfile` in the repo root:

```
worker: TSX_TSCONFIG_PATH=tsconfig.worker.json tsx src/worker/index.ts
```

**Railway:**

1. Create a new project, connect the GitHub repo.
2. Add a service and set the start command to the worker line from the Procfile.
3. Set the same environment variables as the web app.
4. Deploy.

**Render:**

1. Create a new **Background Worker** service, connect the repo.
2. Set the start command and environment variables.
3. Deploy.

Done when:

- Worker logs `[worker] Started — polling every 2000 ms`.
- A test webhook triggers a run that reaches `succeeded` or `failed` within seconds.

### Group 14.4 — CI Secret and Smoke Test

Goal: Make CI pass against the deployed app.

1. In the GitHub repo, go to **Settings → Secrets and variables → Actions**.
2. Add `CI_ENCRYPTION_KEY_BASE64` with a real 32-byte base64 value (can be the same as production or a separate CI-only key).
3. Push to `main` and confirm the CI pipeline passes.

Done when:

- CI passes lint, typecheck, format, unit tests, and build.
- A manual smoke test confirms the full webhook → run → history flow on the production URL.

Phase gate:

- App is live at a public URL.
- Worker processes queued runs.
- CI is green.

---

## 4. Phase 15: Row-Level Security

Goal: Ensure that the Supabase anon key (which is embedded in the frontend bundle and therefore public) cannot be used to read or write any data via the Supabase REST API or dashboard.

### Architectural context

The app connects to PostgreSQL via a raw `pg` pool using the `DATABASE_URL`. This connection authenticates as the `postgres` superuser, which **bypasses RLS entirely** in PostgreSQL. This means RLS does not affect the app's own queries — the service layer already handles authorization there.

What RLS protects against in this setup:

- Direct PostgREST calls using `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anyone can call `https://project.supabase.co/rest/v1/workflows` and read all rows without RLS)
- Supabase Studio queries via the anon or authenticated role
- Any future code that uses the Supabase JS client for data queries

The `service_role` key (used by the admin Supabase client) bypasses RLS by default — no app changes are needed.

### Group 15.1 — RLS Migration

Goal: Write and apply `supabase/migrations/0002_rls_policies.sql`.

Enable RLS on all tables and add workspace-membership-anchored policies for the `authenticated` role.

Pattern for workspace-scoped tables:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members only" ON <table>
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );
```

Tables requiring this pattern: `workflows`, `workflow_events`, `webhook_triggers`, `workflow_secrets`, `workflow_runs`, `workflow_step_runs`.

Additional tables:

```sql
-- Users: each user sees only their own profile
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON users FOR ALL USING (id = auth.uid());

-- Workspaces: visible to members
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members only" ON workspaces FOR ALL
  USING (id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- workspace_members: visible to other members of the same workspace
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "same workspace" ON workspace_members FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- webhook_rate_limits: written by the unauthenticated webhook handler (pg pool,
-- bypasses RLS); enable RLS but do not add an anon policy — blocks REST access
ALTER TABLE webhook_rate_limits ENABLE ROW LEVEL SECURITY;
```

Done when:

- Migration applies cleanly.
- An unauthenticated REST call to `GET /rest/v1/workflows` returns an empty array, not all rows.
- The app itself continues to work normally (pg pool bypasses RLS).
- Existing unit and E2E tests pass.

Phase gate:

- RLS is enabled on all tables.
- Anon key cannot read any application data via PostgREST.
- App behavior is unchanged.

---

## 5. Phase 16: Auth Improvements

Goal: Make authentication production-ready for public sign-ups.

### Group 16.1 — Password Reset

Goal: Give users a recovery path if they forget their password.

Without this, a user who forgets their password has no way back into their account.

Create:

- `src/app/(auth)/forgot-password/page.tsx` — email input form; on submit calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<app-url>/reset-password' })`. Shows a confirmation message after submission.
- `src/app/(auth)/reset-password/page.tsx` — new password form; listens for the `PASSWORD_RECOVERY` auth event (`supabase.auth.onAuthStateChange`), then calls `supabase.auth.updateUser({ password })` on submit.

Modify:

- `src/components/auth/auth-form.tsx` — add "Forgot password?" link below the sign-in form.

Done when:

- User can receive a password reset email and set a new password.
- Reset link expires after use (Supabase handles this).

### Group 16.2 — Post-Signup UX

Goal: Stop leaving users on a blank page after sign-up.

Currently `signUp` succeeds silently — the user is left on the sign-up page with no message. Supabase requires email confirmation before the account is active, but the user doesn't know to check their inbox.

Modify:

- `src/components/auth/auth-form.tsx` — after a successful `signUp` response (and no immediate session, indicating email confirmation is required), transition the form to a "Check your inbox" state that shows the submitted email address and a note to click the confirmation link.

Done when:

- New user sees "Check your inbox" after sign-up.
- Clicking the confirmation email link delivers the user to `/workflows`.

### Group 16.3 — OAuth Providers (optional)

Goal: Reduce sign-up friction for developers.

This is optional but adds significant value for a developer-focused tool (GitHub sign-in in particular).

Steps:

1. Enable the desired provider(s) in **Supabase → Authentication → Providers**.
2. Add OAuth credentials from the provider's developer console.
3. Modify `src/components/auth/auth-form.tsx` — add a "Continue with GitHub" button that calls `supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: '<app-url>/auth/callback' } })`.

No schema changes are needed. The auth callback route already handles the code exchange.

Done when:

- User can sign in with GitHub (or chosen provider).
- New OAuth user is bootstrapped into a default workspace.

Phase gate:

- Password reset flow works end-to-end.
- New users see a confirmation prompt after sign-up.

---

## 6. Phase 17: Workspace Collaboration

Goal: Let users invite others into their workspace so they can collaborate on workflows.

Currently every user is siloed in a private workspace. Collaboration requires an invitation system, a way for recipients to accept, and UI to manage workspace members.

### Group 17.1 — DB Migration

Goal: Add the invitations table.

Create `supabase/migrations/0003_workspace_invitations.sql`:

```sql
CREATE TABLE public.workspace_invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invited_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  token       text NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);

-- RLS: workspace members can see and manage invitations for their workspace
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members only" ON workspace_invitations FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
```

Done when:

- Migration applies cleanly to the cloud project.

### Group 17.2 — Email Sending

Goal: Send invitation emails.

Supabase does not handle custom invite emails. Use [Resend](https://resend.com) — minimal setup, one package.

Install: `npm install resend`

Add env var: `RESEND_API_KEY=re_...`

Update `.env.example` with `RESEND_API_KEY`.

Create:

- `src/server/email/client.ts` — exports a configured `Resend` instance.
- `src/server/email/send-invitation.ts` — sends the invitation email with the accept link (`<NEXT_PUBLIC_APP_URL>/accept-invitation?token=<token>`).

Done when:

- `sendInvitation` can be called from server code and delivers an email.

### Group 17.3 — Invitation Service and API

Goal: Create, accept, and revoke invitations server-side.

Create:

- `src/server/invitations/service.ts`:
  - `createInvitation({ workspaceId, invitedByUserId, email })` — generates a high-entropy token, inserts the invitation row, calls `sendInvitation`.
  - `acceptInvitation({ token, acceptingUserId })` — validates the token, checks it is pending and not expired, adds the user to `workspace_members` with role `member`, marks the invitation `accepted`.
  - `revokeInvitation({ invitationId, requestingUserId })` — marks the invitation `revoked`; requires the requestor to be a workspace member.
  - `listInvitations({ workspaceId, requestingUserId })` — lists all invitations for the workspace.

- `src/server/invitations/queries.ts` — raw DB queries used by the service.

Create API routes:

- `src/app/api/workspaces/[workspaceId]/invitations/route.ts`:
  - `GET` — list invitations (owner/member only)
  - `POST` — create invitation (body: `{ email }`)
- `src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/route.ts`:
  - `DELETE` — revoke invitation
- `src/app/api/invitations/[token]/route.ts`:
  - `GET` — validate token, return workspace name and inviter (used by the accept page to show context before the user commits)
  - `POST` — accept invitation (requires authenticated user)

Done when:

- An invitation can be created, emailed, and accepted end-to-end.
- Expired or revoked tokens are rejected.
- Accepting adds the user to `workspace_members`.
- Cross-workspace access is denied.

### Group 17.4 — Accept Invitation Page

Goal: Give recipients a landing page to join a workspace.

Create:

- `src/app/accept-invitation/page.tsx` — reads `?token=` from the URL.
  - If the user is not signed in, redirect to `/sign-up?next=/accept-invitation?token=<token>` (store token in query so auth callback returns here).
  - If signed in, call `GET /api/invitations/[token]` to fetch workspace name and inviter, show a confirmation prompt ("Join [workspace name] invited by [name]?"), then `POST` to accept on confirmation.
  - On success, redirect to `/workflows`.

Modify:

- `src/app/(auth)/sign-in/page.tsx` and `src/app/(auth)/sign-up/page.tsx` — honour the `?next=` redirect param so the post-auth callback can return to the accept page.

Done when:

- Recipient clicks email link → prompted to sign up (if new) or sign in → sees workspace name → accepts → lands on `/workflows` inside the invited workspace.

### Group 17.5 — Members Page and Workspace Switcher

Goal: Let users see and manage who is in their workspace, and switch between workspaces.

Create:

- `src/app/(app)/settings/members/page.tsx`:
  - Lists current workspace members with roles.
  - Lists pending invitations with a revoke button.
  - Invite-by-email form (calls `POST /api/workspaces/[workspaceId]/invitations`).
  - Remove member button (owner only) — calls `DELETE /api/workspaces/[workspaceId]/members/[userId]`.
- `src/app/api/workspaces/[workspaceId]/members/[userId]/route.ts`:
  - `DELETE` — remove a member (owner only; cannot remove self if owner).

Modify:

- `src/app/(app)/layout.tsx` — add a workspace switcher dropdown to the nav.
  - Fetches `/api/workspaces` (already exists) to list all workspaces the current user belongs to.
  - Stores the active `workspaceId` in a cookie or URL segment so the app knows which workspace is active.
  - Links to **Settings → Members** from the workspace dropdown.

Done when:

- Workspace owner can invite a new user by email.
- Invited user can accept and access the workspace.
- Both users see the same workflow list after the invite is accepted.
- Workspace switcher lets a member of multiple workspaces change the active one.
- Owner can remove a member.

Phase gate:

- End-to-end invite flow works: invite → email → accept → shared workspace.
- Workspace switcher shows all workspaces for multi-workspace users.
- Non-members cannot access workspace data.

---

## 7. Phase 18: Real-Time Multiplayer Presence

Goal: Show each collaborator's cursor position on the canvas in real time so users know when someone else is editing the same workflow.

### Architectural decision

The existing SSE stream is server → client only and polls every 2 seconds. Cursor positions require sub-100 ms delivery and client → server writes. **Supabase Realtime Broadcast** is the right tool: it uses WebSockets, requires no DB storage (ephemeral), and is already bundled in `@supabase/supabase-js` which is a current dependency.

### Group 18.1 — Browser Supabase Client

Goal: Create a client-side Supabase instance for Realtime.

Currently all Supabase clients are server-only. A browser client is needed for the Realtime channel subscription.

Create:

- `src/client/supabase/browser.ts`:
  ```ts
  import { createBrowserClient } from "@supabase/ssr";
  export const browserSupabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  ```

Done when:

- Browser client can be imported without errors in client components.

### Group 18.2 — Presence Hook

Goal: Track and broadcast cursor positions over a Supabase Realtime channel.

Create `src/client/realtime/use-workflow-presence.ts`:

Behavior:

- Opens a Supabase Realtime channel keyed to the workflow: `supabase.channel('workflow-presence:<workflowId>')`.
- On mount, calls `channel.subscribe()` with `presence` tracking enabled.
- Subscribes to `presence` state changes (`sync`, `join`, `leave`) to maintain a live list of other users' cursor positions.
- On pointer move over the canvas, calls `channel.track({ userId, displayName, x, y })` throttled to ~30 fps (one update per ~33 ms).
- Cursor positions are in **graph coordinates** (before viewport transform), not screen pixels, so they stay locked to the canvas as users pan and zoom.
- On unmount, calls `channel.unsubscribe()`.

Returns:

```ts
{
  presenceUsers: Array<{
    userId: string;
    displayName: string;
    x: number;
    y: number;
    color: string;
  }>;
  viewerCount: number;
}
```

User color is derived deterministically from `userId` (e.g. hash to one of 8–12 preset colors) so each collaborator always appears in the same color.

Done when:

- Hook opens a channel, receives position updates from a second browser tab.

### Group 18.3 — Cursor Overlay in Canvas

Goal: Render other users' cursors on the canvas.

Modify `src/components/editor/canvas.tsx`:

- Add `presenceUsers` prop (type matches the hook return).
- After the existing node and edge layers, render a cursor overlay layer.
- Each cursor is a `<div>` (or SVG element) positioned absolutely within the canvas container, transformed by the same viewport pan and zoom as the nodes:
  ```
  left: presenceUser.x * zoom + viewportX
  top:  presenceUser.y * zoom + viewportY
  ```
- Each cursor shows a colored pointer icon and a label with the user's display name, fading to the user's color.
- Cursors belonging to users who have not sent an update in >3 seconds fade out (the Presence state removes them on disconnect automatically, but a local timeout handles brief pauses).

Modify `src/components/editor/workflow-editor.tsx`:

- Add `presenceUsers` prop.
- Pass it through to `Canvas`.

Done when:

- Moving the cursor in one tab causes a colored label to appear on the canvas in a second tab within <200 ms.
- Cursor position tracks correctly through pan and zoom.
- Cursor disappears when the other tab is closed.

### Group 18.4 — Presence in Editor Wrapper

Goal: Wire the hook into the existing component tree and surface viewer count.

Modify `src/components/workflows/workflow-editor-with-persistence.tsx`:

- Call `useWorkflowPresence(workflowId, { userId, displayName })` after the component is loaded.
- Pass `presenceUsers` down to `WorkflowEditor`.
- Pass the pointer move handler from the hook to `WorkflowEditor` → `Canvas` so the canvas can report the cursor position in graph coordinates.

Modify `src/components/workflows/workflow-header.tsx`:

- Accept an optional `viewerCount` prop.
- If `viewerCount > 1`, show a subtle indicator such as "2 viewing" in the header.

Done when:

- Two users editing the same workflow see each other's cursors without any page reload.
- The workflow header shows how many people are currently viewing.

Phase gate:

- Cursor positions are live across two separate browser sessions.
- No DB rows are written for cursor events (all ephemeral via Realtime Broadcast).
- Existing sync and realtime tests still pass.

---

## 8. Implementation Rules

- Implement phases in order; each phase is a prerequisite for the next.
- Do not invite external users (Phase 17) before RLS is in place (Phase 15).
- The RLS migration is additive — it does not change any existing queries or app behavior.
- Invitation tokens must be high-entropy and single-use.
- Email sending must be fire-and-forget from the API — do not block the invitation creation response on email delivery.
- Cursor positions must never be written to the database.
- The browser Supabase client must only use the anon key, never the service role key.
