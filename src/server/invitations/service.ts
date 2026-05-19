import "server-only";

import { nanoid } from "nanoid";

import { withTransaction } from "@/server/db/pool";
import { createWorkspaceQueries } from "@/server/workspaces/queries";

import { createInvitationQueries } from "./queries";
import type { InvitationRecord, InvitationWithWorkspace } from "./queries";

export { type InvitationRecord, type InvitationWithWorkspace };

export class InvitationError extends Error {}
export class InvitationNotFoundError extends InvitationError {}
export class InvitationExpiredError extends InvitationError {}
export class InvitationAlreadyAcceptedError extends InvitationError {}
export class DuplicateInvitationError extends InvitationError {}
export class InvitationAccessError extends InvitationError {}

export async function createInvitation(input: {
  workspaceId: string;
  invitedByUserId: string;
  inviterEmail: string;
  email: string;
  appUrl: string;
}): Promise<{ invitationId: string; acceptUrl: string }> {
  const q = createInvitationQueries();
  const wq = createWorkspaceQueries();

  const canAccess = await wq.userCanAccessWorkspace(
    input.invitedByUserId,
    input.workspaceId,
  );
  if (!canAccess) {
    throw new InvitationAccessError("You do not have access to this workspace");
  }

  const existing = await q.findPendingInvitationByWorkspaceAndEmail(
    input.workspaceId,
    input.email,
  );
  if (existing) {
    throw new DuplicateInvitationError(
      `A pending invitation for ${input.email} already exists`,
    );
  }

  const token = nanoid(32);
  const invitation = await q.insertInvitation({
    workspaceId: input.workspaceId,
    invitedByUserId: input.invitedByUserId,
    email: input.email,
    token,
  });

  const acceptUrl = `${input.appUrl}/accept-invitation?token=${token}`;
  return { invitationId: invitation.id, acceptUrl };
}

export async function getInvitationByToken(
  token: string,
): Promise<InvitationWithWorkspace | null> {
  const q = createInvitationQueries();
  return q.findInvitationByToken(token);
}

export async function acceptInvitation(input: {
  token: string;
  acceptingUserId: string;
  acceptingUserEmail: string;
  acceptingUserName?: string | null;
}): Promise<void> {
  const q = createInvitationQueries();
  const invitation = await q.findInvitationByToken(input.token);

  if (!invitation) throw new InvitationNotFoundError("Invitation not found");
  if (invitation.status === "accepted")
    throw new InvitationAlreadyAcceptedError("Invitation already accepted");
  if (invitation.status === "revoked")
    throw new InvitationNotFoundError("Invitation has been revoked");
  if (invitation.expiresAt < new Date())
    throw new InvitationExpiredError("Invitation has expired");

  await withTransaction(async (db) => {
    const wq = createWorkspaceQueries(db);
    const iq = createInvitationQueries(db);

    await wq.upsertUserProfile({
      id: input.acceptingUserId,
      email: input.acceptingUserEmail,
      name: input.acceptingUserName,
    });

    await wq.ensureWorkspaceMembership({
      workspaceId: invitation.workspaceId,
      userId: input.acceptingUserId,
      role: "member",
    });

    await iq.updateInvitationStatus(invitation.id, "accepted");
  });
}

export async function revokeInvitation(input: {
  invitationId: string;
  requestingUserId: string;
  workspaceId: string;
}): Promise<void> {
  const wq = createWorkspaceQueries();
  const canAccess = await wq.userCanAccessWorkspace(
    input.requestingUserId,
    input.workspaceId,
  );
  if (!canAccess) {
    throw new InvitationAccessError("You do not have access to this workspace");
  }

  const q = createInvitationQueries();
  await q.updateInvitationStatus(input.invitationId, "revoked");
}

export async function listInvitations(input: {
  workspaceId: string;
  requestingUserId: string;
}): Promise<InvitationRecord[]> {
  const wq = createWorkspaceQueries();
  const canAccess = await wq.userCanAccessWorkspace(
    input.requestingUserId,
    input.workspaceId,
  );
  if (!canAccess) {
    throw new InvitationAccessError("You do not have access to this workspace");
  }

  const q = createInvitationQueries();
  return q.findInvitationsByWorkspace(input.workspaceId);
}
