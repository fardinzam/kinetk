import { beforeEach, describe, expect, it, vi } from "vitest";

const { invitations, memberships, roles, sendInvitationEmail } = vi.hoisted(
  () => ({
    invitations: [] as InvitationRecord[],
    memberships: new Map<string, Set<string>>(),
    roles: new Map<string, "owner" | "member">(),
    sendInvitationEmail: vi.fn(async () => undefined),
  }),
);

vi.mock("@/server/db/pool", () => ({
  withTransaction: vi.fn(async (fn: (db: unknown) => Promise<unknown>) =>
    fn({ __transaction: true }),
  ),
}));

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

function membershipKey(workspaceId: string, userId: string) {
  return `${workspaceId}:${userId}`;
}

function addMember(
  workspaceId: string,
  userId: string,
  role: "owner" | "member",
) {
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
    async updateInvitationStatus(
      invitationId: string,
      status: InvitationStatus,
    ) {
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
      email: "Guest@Example.com ",
      appUrl: "https://kinetk.app",
    });

    expect(result.acceptUrl).toContain("/accept-invitation?token=");
    expect(invitations[0]?.email).toBe("guest@example.com");
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
