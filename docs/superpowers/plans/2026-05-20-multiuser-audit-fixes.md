# Multiuser Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the non-realtime issues found in the multi-user audit: invitation authorization, invitation acceptance semantics, invite signup redirects, condition branching execution, path defaults, and Kinetk branding drift.

**Architecture:** Keep the existing raw-Postgres service/query layering and local-first workflow editor architecture. Add narrow query/service methods where authorization needs more context, then prove behavior with unit tests before changing implementation. Treat realtime cursor Broadcast as out of scope because it has already been optimized.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth/Postgres, Vitest, Testing Library.

---

## File Structure

- Modify `src/server/invitations/queries.ts`: add workspace-scoped invitation status updates and a query helper for token/workspace safety.
- Modify `src/server/invitations/service.ts`: enforce owner-only invite management, bind acceptance to invited email, and call the existing Resend email helper after creating the DB row.
- Create `src/server/invitations/service.test.ts`: unit-test invite creation, revocation scoping, email-bound acceptance, and duplicate handling with in-memory fakes.
- Modify `src/app/api/workspaces/[workspaceId]/invitations/route.ts`: keep route behavior stable, but expect create service to send email and still return the copyable fallback URL.
- Modify `src/components/auth/auth-form.tsx`: preserve `next` in Supabase `emailRedirectTo` for sign-up confirmations.
- Modify `src/components/auth/auth-form.test.tsx`: mock Supabase/browser env and verify email redirect preserves `next`.
- Modify `src/components/editor/editor-state.ts`: change condition default path to the worker-supported `current.value`.
- Modify `src/components/editor/workflow-editor.tsx`: assign condition branch handles when connecting from condition nodes.
- Modify `src/components/editor/editor-state.test.ts`: cover condition defaults and branch-handle edges.
- Modify `src/worker/execution/graph-order.ts`: make branch filtering explicit and keep non-branched edges working.
- Create or extend `src/worker/execution/graph-order.test.ts`: cover true/false condition branches and normal non-branch edges.
- Modify branding in `README.md`, `package.json`, `src/app/(app)/layout.tsx`, and any remaining user-facing `FlowForge` strings that should now say `Kinetk`.

---

### Task 1: Invitation Query Primitives

**Files:**
- Modify: `src/server/invitations/queries.ts`
- Test indirectly in: `src/server/invitations/service.test.ts` in Task 2

- [ ] **Step 1: Extend query interface**

Add workspace-scoped update methods and a minimal invite lookup by ID:

```ts
export type InvitationQueries = {
  insertInvitation(input: {
    workspaceId: string;
    invitedByUserId: string;
    email: string;
    token: string;
  }): Promise<InvitationRecord>;
  findInvitationById(invitationId: string): Promise<InvitationRecord | null>;
  findInvitationByToken(token: string): Promise<InvitationWithWorkspace | null>;
  findInvitationsByWorkspace(workspaceId: string): Promise<InvitationRecord[]>;
  findPendingInvitationByWorkspaceAndEmail(
    workspaceId: string,
    email: string,
  ): Promise<InvitationRecord | null>;
  updateInvitationStatus(
    invitationId: string,
    status: InvitationStatus,
  ): Promise<void>;
  updateInvitationStatusForWorkspace(
    invitationId: string,
    workspaceId: string,
    status: InvitationStatus,
  ): Promise<boolean>;
};
```

- [ ] **Step 2: Implement `findInvitationById`**

Add this method inside `createInvitationQueries`:

```ts
async findInvitationById(invitationId) {
  const result = await db.query<{
    id: string;
    workspace_id: string;
    invited_by_user_id: string;
    email: string;
    token: string;
    status: InvitationStatus;
    expires_at: Date;
    created_at: Date;
  }>(
    `
      SELECT * FROM public.workspace_invitations
      WHERE id = $1
      LIMIT 1
    `,
    [invitationId],
  );
  const row = result.rows[0];
  return row ? rowToRecord(row) : null;
},
```

- [ ] **Step 3: Implement workspace-scoped status update**

Add this method inside `createInvitationQueries`:

```ts
async updateInvitationStatusForWorkspace(invitationId, workspaceId, status) {
  const result = await db.query(
    `
      UPDATE public.workspace_invitations
      SET status = $3
      WHERE id = $1
        AND workspace_id = $2
    `,
    [invitationId, workspaceId, status],
  );
  return result.rowCount === 1;
},
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: this may fail until service call sites are updated in Task 2.

---

### Task 2: Invitation Service Safety and Email Sending

**Files:**
- Modify: `src/server/invitations/service.ts`
- Create: `src/server/invitations/service.test.ts`
- Uses existing: `src/server/email/send-invitation.ts`

- [ ] **Step 1: Write failing tests for service behavior**

Create `src/server/invitations/service.test.ts` with in-memory fakes and module mocks:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/pool", () => ({
  withTransaction: vi.fn(async (fn: (db: unknown) => Promise<unknown>) =>
    fn({ __transaction: true }),
  ),
}));

const sendInvitationEmail = vi.fn(async () => undefined);
vi.mock("@/server/email/send-invitation", () => ({
  sendInvitationEmail,
}));

import {
  acceptInvitation,
  createInvitation,
  InvitationAccessError,
  InvitationNotFoundError,
  revokeInvitation,
} from "./service";

type InvitationStatus = "pending" | "accepted" | "revoked";

type InvitationRecord = {
  id: string;
  workspaceId: string;
  invitedByUserId: string;
  email: string;
  token: string;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
};

const invitations: InvitationRecord[] = [];
const memberships = new Map<string, Set<string>>();
const roles = new Map<string, "owner" | "member">();

function membershipKey(workspaceId: string, userId: string) {
  return `${workspaceId}:${userId}`;
}

function addMember(workspaceId: string, userId: string, role: "owner" | "member") {
  const users = memberships.get(workspaceId) ?? new Set<string>();
  users.add(userId);
  memberships.set(workspaceId, users);
  roles.set(membershipKey(workspaceId, userId), role);
}

vi.mock("@/server/workspaces/queries", () => ({
  createWorkspaceQueries: () => ({
    async userCanAccessWorkspace(userId: string, workspaceId: string) {
      return memberships.get(workspaceId)?.has(userId) ?? false;
    },
    async userRoleForWorkspace(userId: string, workspaceId: string) {
      return roles.get(membershipKey(workspaceId, userId)) ?? null;
    },
    async upsertUserProfile() {},
    async ensureWorkspaceMembership(input: {
      workspaceId: string;
      userId: string;
      role: "owner" | "member";
    }) {
      addMember(input.workspaceId, input.userId, input.role);
    },
  }),
}));

vi.mock("./queries", () => ({
  createInvitationQueries: () => ({
    async insertInvitation(input: {
      workspaceId: string;
      invitedByUserId: string;
      email: string;
      token: string;
    }) {
      const invitation: InvitationRecord = {
        id: `inv_${invitations.length + 1}`,
        workspaceId: input.workspaceId,
        invitedByUserId: input.invitedByUserId,
        email: input.email,
        token: input.token,
        status: "pending",
        expiresAt: new Date("2026-05-27T00:00:00.000Z"),
        createdAt: new Date("2026-05-20T00:00:00.000Z"),
      };
      invitations.push(invitation);
      return invitation;
    },
    async findInvitationByToken(token: string) {
      const invitation = invitations.find((i) => i.token === token);
      return invitation ? { ...invitation, workspaceName: "Acme" } : null;
    },
    async findPendingInvitationByWorkspaceAndEmail(
      workspaceId: string,
      email: string,
    ) {
      return (
        invitations.find(
          (i) =>
            i.workspaceId === workspaceId &&
            i.email === email &&
            i.status === "pending",
        ) ?? null
      );
    },
    async updateInvitationStatusForWorkspace(
      invitationId: string,
      workspaceId: string,
      status: InvitationStatus,
    ) {
      const invitation = invitations.find(
        (i) => i.id === invitationId && i.workspaceId === workspaceId,
      );
      if (!invitation) return false;
      invitation.status = status;
      return true;
    },
    async updateInvitationStatus(invitationId: string, status: InvitationStatus) {
      const invitation = invitations.find((i) => i.id === invitationId);
      if (invitation) invitation.status = status;
    },
  }),
}));

beforeEach(() => {
  invitations.length = 0;
  memberships.clear();
  roles.clear();
  sendInvitationEmail.mockClear();
});

describe("invitation service", () => {
  it("sends invitation email after creating an owner invite", async () => {
    addMember("ws_1", "owner", "owner");

    const result = await createInvitation({
      workspaceId: "ws_1",
      invitedByUserId: "owner",
      inviterEmail: "owner@example.com",
      email: "guest@example.com",
      appUrl: "https://kinetk.app",
    });

    expect(result.acceptUrl).toContain("/accept-invitation?token=");
    expect(sendInvitationEmail).toHaveBeenCalledWith({
      toEmail: "guest@example.com",
      workspaceName: "Acme",
      inviterEmail: "owner@example.com",
      acceptUrl: result.acceptUrl,
    });
  });

  it("rejects invitation creation by non-owners", async () => {
    addMember("ws_1", "member", "member");

    await expect(
      createInvitation({
        workspaceId: "ws_1",
        invitedByUserId: "member",
        inviterEmail: "member@example.com",
        email: "guest@example.com",
        appUrl: "https://kinetk.app",
      }),
    ).rejects.toBeInstanceOf(InvitationAccessError);
  });

  it("does not revoke invitations outside the route workspace", async () => {
    addMember("ws_1", "owner", "owner");
    invitations.push({
      id: "inv_other",
      workspaceId: "ws_2",
      invitedByUserId: "other",
      email: "guest@example.com",
      token: "tok_other",
      status: "pending",
      expiresAt: new Date("2026-05-27T00:00:00.000Z"),
      createdAt: new Date("2026-05-20T00:00:00.000Z"),
    });

    await expect(
      revokeInvitation({
        invitationId: "inv_other",
        requestingUserId: "owner",
        workspaceId: "ws_1",
      }),
    ).rejects.toBeInstanceOf(InvitationNotFoundError);
    expect(invitations[0]!.status).toBe("pending");
  });

  it("requires accepting user email to match invited email", async () => {
    invitations.push({
      id: "inv_1",
      workspaceId: "ws_1",
      invitedByUserId: "owner",
      email: "guest@example.com",
      token: "tok_1",
      status: "pending",
      expiresAt: new Date("2026-05-27T00:00:00.000Z"),
      createdAt: new Date("2026-05-20T00:00:00.000Z"),
    });

    await expect(
      acceptInvitation({
        token: "tok_1",
        acceptingUserId: "attacker",
        acceptingUserEmail: "attacker@example.com",
      }),
    ).rejects.toBeInstanceOf(InvitationAccessError);
    expect(memberships.get("ws_1")?.has("attacker")).not.toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/server/invitations/service.test.ts`

Expected: FAIL because service does not yet enforce owner role, does not send email, does not scope revocation by workspace, and does not bind accepting email.

- [ ] **Step 3: Add workspace role query**

Modify `src/server/workspaces/queries.ts`:

```ts
export type WorkspaceQueries = {
  upsertUserProfile(user: {
    id: string;
    email: string;
    name?: string | null;
  }): Promise<void>;
  findOwnedWorkspace(userId: string): Promise<WorkspaceRecord | null>;
  createWorkspace(input: {
    ownerId: string;
    name: string;
  }): Promise<WorkspaceRecord>;
  ensureWorkspaceMembership(input: {
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
  }): Promise<void>;
  listWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]>;
  userCanAccessWorkspace(userId: string, workspaceId: string): Promise<boolean>;
  userRoleForWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceRole | null>;
  listMembersForWorkspace(workspaceId: string): Promise<WorkspaceMember[]>;
  removeWorkspaceMember(workspaceId: string, userId: string): Promise<void>;
};
```

Add implementation:

```ts
async userRoleForWorkspace(userId, workspaceId) {
  const result = await db.query<{ role: WorkspaceRole }>(
    `
      select role
      from public.workspace_members
      where user_id = $1 and workspace_id = $2
      limit 1
    `,
    [userId, workspaceId],
  );
  return result.rows[0]?.role ?? null;
},
```

- [ ] **Step 4: Update workspace service test fake**

In `src/server/workspaces/service.test.ts`, add this method to `createWorkspaceQueries()`:

```ts
async userRoleForWorkspace(userId, workspaceId) {
  return (
    members.find(
      (member) =>
        member.userId === userId && member.workspaceId === workspaceId,
    )?.role ?? null
  );
},
```

- [ ] **Step 5: Update invitation service implementation**

Modify `src/server/invitations/service.ts`:

```ts
import { sendInvitationEmail } from "@/server/email/send-invitation";
```

Add helpers:

```ts
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function assertWorkspaceOwner(userId: string, workspaceId: string) {
  const wq = createWorkspaceQueries();
  const role = await wq.userRoleForWorkspace(userId, workspaceId);
  if (role !== "owner") {
    throw new InvitationAccessError("Only workspace owners can manage invitations");
  }
}
```

Update `createInvitation`:

```ts
await assertWorkspaceOwner(input.invitedByUserId, input.workspaceId);
const email = normalizeEmail(input.email);

const existing = await q.findPendingInvitationByWorkspaceAndEmail(
  input.workspaceId,
  email,
);
if (existing) {
  throw new DuplicateInvitationError(
    `A pending invitation for ${email} already exists`,
  );
}

const token = nanoid(32);
const invitation = await q.insertInvitation({
  workspaceId: input.workspaceId,
  invitedByUserId: input.invitedByUserId,
  email,
  token,
});

const acceptUrl = `${input.appUrl}/accept-invitation?token=${token}`;
const invitationWithWorkspace = await q.findInvitationByToken(token);
await sendInvitationEmail({
  toEmail: email,
  workspaceName: invitationWithWorkspace?.workspaceName ?? "your workspace",
  inviterEmail: input.inviterEmail,
  acceptUrl,
});
return { invitationId: invitation.id, acceptUrl };
```

Update `acceptInvitation` before transaction:

```ts
if (normalizeEmail(input.acceptingUserEmail) !== normalizeEmail(invitation.email)) {
  throw new InvitationAccessError(
    "Sign in with the invited email address to accept this invitation",
  );
}
```

Update `revokeInvitation`:

```ts
await assertWorkspaceOwner(input.requestingUserId, input.workspaceId);

const q = createInvitationQueries();
const updated = await q.updateInvitationStatusForWorkspace(
  input.invitationId,
  input.workspaceId,
  "revoked",
);
if (!updated) {
  throw new InvitationNotFoundError("Invitation not found");
}
```

- [ ] **Step 6: Update route error handling**

In `src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/route.ts`, treat `InvitationNotFoundError` as 404:

```ts
import {
  revokeInvitation,
  InvitationAccessError,
  InvitationNotFoundError,
} from "@/server/invitations/service";
```

```ts
if (
  err instanceof InvitationAccessError ||
  err instanceof InvitationNotFoundError
) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

- [ ] **Step 7: Run focused tests**

Run: `npm run test -- src/server/invitations/service.test.ts src/server/workspaces/service.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/invitations src/server/workspaces src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/route.ts
git commit -m "fix: harden workspace invitations"
```

---

### Task 3: Preserve Invitation Redirect Through Email Confirmation

**Files:**
- Modify: `src/components/auth/auth-form.tsx`
- Modify: `src/components/auth/auth-form.test.tsx`

- [ ] **Step 1: Write failing auth redirect test**

Extend `src/components/auth/auth-form.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signUp = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    auth: {
      signUp,
      signInWithPassword: vi.fn(),
    },
  }),
}));

vi.mock("@/lib/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    NEXT_PUBLIC_APP_URL: "https://kinetk.app",
  }),
}));
```

Add the test:

```tsx
beforeEach(() => {
  signUp.mockReset();
  window.history.pushState(
    {},
    "",
    "/sign-up?next=/accept-invitation?token=tok_1",
  );
});

it("preserves next redirect in sign-up email confirmation URL", async () => {
  signUp.mockResolvedValue({ data: { session: null }, error: null });
  render(<AuthForm mode="sign-up" />);

  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "guest@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));

  await waitFor(() => expect(signUp).toHaveBeenCalled());
  expect(signUp).toHaveBeenCalledWith({
    email: "guest@example.com",
    password: "password123",
    options: {
      emailRedirectTo:
        "https://kinetk.app/auth/callback?next=%2Faccept-invitation%3Ftoken%3Dtok_1",
    },
  });
});
```

- [ ] **Step 2: Run focused test to verify failure**

Run: `npm run test -- src/components/auth/auth-form.test.tsx`

Expected: FAIL because `emailRedirectTo` currently omits `next`.

- [ ] **Step 3: Implement redirect preservation**

Modify `src/components/auth/auth-form.tsx` before the `signUp` call:

```ts
const next = new URLSearchParams(window.location.search).get("next");
const redirectTo = next && next.startsWith("/") ? next : "/workflows";
const emailRedirectUrl = new URL("/auth/callback", env.NEXT_PUBLIC_APP_URL);
if (next && next.startsWith("/")) {
  emailRedirectUrl.searchParams.set("next", next);
}
```

Then update `signUp`:

```ts
options: {
  emailRedirectTo: emailRedirectUrl.toString(),
},
```

Remove the later duplicate `next`/`redirectTo` declarations and keep using the variables created before the auth call.

- [ ] **Step 4: Run focused test**

Run: `npm run test -- src/components/auth/auth-form.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/auth-form.tsx src/components/auth/auth-form.test.tsx
git commit -m "fix: preserve invite redirect after signup"
```

---

### Task 4: Condition Branch Edge Handles and Path Defaults

**Files:**
- Modify: `src/components/editor/editor-state.ts`
- Modify: `src/components/editor/workflow-editor.tsx`
- Modify: `src/components/editor/editor-state.test.ts`
- Modify: `src/worker/execution/graph-order.ts`
- Create: `src/worker/execution/graph-order.test.ts`

- [ ] **Step 1: Write failing editor-state test for condition defaults**

Add to `src/components/editor/editor-state.test.ts`:

```ts
it("adds condition nodes with worker-compatible path defaults", () => {
  const state = addNode(
    {
      graph: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
      selectedNodeId: null,
    },
    "condition",
  );

  expect(state.graph.nodes[0]).toMatchObject({
    id: "condition_1",
    type: "condition",
    config: { leftPath: "current.value", operator: "exists" },
  });
});
```

- [ ] **Step 2: Write graph-order branch tests**

Create `src/worker/execution/graph-order.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { WorkflowGraph } from "@/domain/workflows/types";

import { getNextNodeIds } from "./graph-order";

const graph: WorkflowGraph = {
  nodes: [
    {
      id: "condition",
      type: "condition",
      position: { x: 0, y: 0 },
      config: { leftPath: "current.value", operator: "exists" },
    },
    {
      id: "true_log",
      type: "log",
      position: { x: 200, y: 0 },
      config: { label: "true" },
    },
    {
      id: "false_log",
      type: "log",
      position: { x: 200, y: 100 },
      config: { label: "false" },
    },
    {
      id: "plain_log",
      type: "log",
      position: { x: 200, y: 200 },
      config: { label: "plain" },
    },
  ],
  edges: [
    {
      id: "edge_true",
      sourceNodeId: "condition",
      sourceHandle: "true",
      targetNodeId: "true_log",
    },
    {
      id: "edge_false",
      sourceNodeId: "condition",
      sourceHandle: "false",
      targetNodeId: "false_log",
    },
    {
      id: "edge_plain",
      sourceNodeId: "plain_log",
      targetNodeId: "true_log",
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

describe("getNextNodeIds", () => {
  it("follows only the matching condition branch", () => {
    expect(getNextNodeIds(graph, "condition", "true")).toEqual(["true_log"]);
    expect(getNextNodeIds(graph, "condition", "false")).toEqual(["false_log"]);
  });

  it("follows all non-branched outgoing edges when no branch is supplied", () => {
    expect(getNextNodeIds(graph, "plain_log")).toEqual(["true_log"]);
  });
});
```

- [ ] **Step 3: Run focused tests to verify failure**

Run: `npm run test -- src/components/editor/editor-state.test.ts src/worker/execution/graph-order.test.ts`

Expected: editor-state test fails because default is `$.value`. Graph-order tests may pass already; they lock expected behavior before editor wiring changes.

- [ ] **Step 4: Fix condition default**

In `src/components/editor/editor-state.ts`, change:

```ts
leftPath: "$.value",
```

to:

```ts
leftPath: "current.value",
```

- [ ] **Step 5: Add condition branch handle selection**

In `src/components/editor/workflow-editor.tsx`, replace the edge creation block in `onConnectTo` with logic that assigns handles for condition sources:

```ts
const sourceNode = nodesById.get(connectingFromNodeId);
const branchHandle =
  sourceNode?.type === "condition"
    ? window.prompt("Branch for this condition edge: true or false", "true")
    : undefined;

if (
  sourceNode?.type === "condition" &&
  branchHandle !== "true" &&
  branchHandle !== "false"
) {
  setConnectingFromNodeId(null);
  return;
}

const next = connectNodes(
  state,
  connectingFromNodeId,
  nodeId,
  branchHandle,
);
```

Update `connectNodes` signature in `src/components/editor/editor-state.ts`:

```ts
export function connectNodes(
  state: EditorState,
  sourceNodeId: string,
  targetNodeId: string,
  sourceHandle?: string,
): EditorState {
```

Update duplicate-edge detection:

```ts
if (
  state.graph.edges.some(
    (edge) =>
      edge.sourceNodeId === sourceNodeId &&
      edge.targetNodeId === targetNodeId &&
      edge.sourceHandle === sourceHandle,
  )
) {
  return state;
}
```

Update edge object:

```ts
{
  id: nextEdgeId(graph, sourceNodeId, targetNodeId),
  sourceNodeId,
  targetNodeId,
  ...(sourceHandle ? { sourceHandle } : {}),
}
```

- [ ] **Step 6: Add editor-state test for source handles**

Add:

```ts
it("connects condition edges with source handles", () => {
  const conditionGraph: WorkflowGraph = {
    nodes: [
      {
        id: "condition",
        type: "condition",
        position: { x: 0, y: 0 },
        config: { leftPath: "current.value", operator: "exists" },
      },
      {
        id: "log",
        type: "log",
        position: { x: 200, y: 0 },
        config: { label: "Log" },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  const connected = connectNodes(
    { graph: conditionGraph, selectedNodeId: null },
    "condition",
    "log",
    "true",
  );

  expect(connected.graph.edges).toEqual([
    {
      id: "edge_condition_log_1",
      sourceNodeId: "condition",
      targetNodeId: "log",
      sourceHandle: "true",
    },
  ]);
});
```

- [ ] **Step 7: Run focused tests**

Run: `npm run test -- src/components/editor/editor-state.test.ts src/worker/execution/graph-order.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/editor src/worker/execution
git commit -m "fix: execute condition branches"
```

---

### Task 5: Kinetk Branding Cleanup

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Modify: `src/app/(app)/layout.tsx`
- Search/modify any remaining user-facing FlowForge references

- [ ] **Step 1: Search for branding drift**

Run: `rg -n "FlowForge|flowforge" README.md package.json src docs .env.example`

Expected: output includes README/package/nav references. Docs may intentionally preserve historical context; update only current product/user-facing strings unless the user wants docs fully renamed.

- [ ] **Step 2: Update current product strings**

Apply these changes:

```diff
-# FlowForge
+# Kinetk
 
-FlowForge is a local-first webhook workflow builder for developers.
+Kinetk is a local-first webhook workflow builder for developers.
```

```diff
-  "name": "flowforge",
+  "name": "kinetk",
...
-  "description": "FlowForge is a local-first webhook workflow builder for developers.",
+  "description": "Kinetk is a local-first webhook workflow builder for developers.",
```

```diff
-      <nav aria-label="FlowForge app navigation">
+      <nav aria-label="Kinetk app navigation">
```

- [ ] **Step 3: Run formatting check**

Run: `npm run format:check`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add README.md package.json src/app/(app)/layout.tsx
git commit -m "chore: update Kinetk branding"
```

---

### Task 6: Full Verification

**Files:**
- No new file changes expected unless verification reveals a failure.

- [ ] **Step 1: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Run format check**

Run: `npm run format:check`

Expected: PASS.

- [ ] **Step 4: Run unit tests**

Run: `npm run test`

Expected: all tests pass.

- [ ] **Step 5: Run production build**

Run: `npm run build`

Expected: build passes. The existing Next warning about `middleware` deprecation may still appear unless a separate migration to `proxy.ts` is requested.

- [ ] **Step 6: Manual smoke tests**

Run the app locally and verify:

```bash
npm run dev
```

Manual checks:
- Owner can create invite; email is attempted if `RESEND_API_KEY` is configured; UI still shows copyable fallback link.
- Member cannot create or revoke invitations.
- Owner cannot revoke an invitation in another workspace via URL tampering.
- Invited user signed in with matching email can accept.
- Signed-in user with a different email cannot accept.
- Sign-up from `/accept-invitation?token=...` returns to the accept page after email confirmation.
- A condition node connected through a `true` branch executes only the true path.
- A condition node connected through a `false` branch executes only the false path.

- [ ] **Step 7: Final status**

Run: `git status --short --branch`

Expected: only intentional committed changes remain; no generated build artifacts are dirty. If `next-env.d.ts` changes after build, restore the generated reference to its pre-build value before finalizing.

---

## Self-Review

- Spec coverage: invitation authorization, email-bound acceptance, email sending, invite redirect preservation, condition branch execution, path defaults, and Kinetk naming are all covered.
- Placeholder scan: no task depends on “TBD” or unspecified implementation.
- Type consistency: new `WorkspaceQueries.userRoleForWorkspace` returns the existing `WorkspaceRole | null`; invitation tests mock the same method; invitation status update returns boolean for route-safe 404 behavior.

Plan complete.
