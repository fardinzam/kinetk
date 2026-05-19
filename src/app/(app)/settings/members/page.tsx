import { cookies } from "next/headers";

import { requireUser } from "@/server/auth/session";
import {
  listInvitations,
  InvitationAccessError,
} from "@/server/invitations/service";
import {
  getActiveWorkspaceForUser,
  listMembersForWorkspace,
} from "@/server/workspaces/service";

import { InviteForm } from "./invite-form";

export default async function MembersPage() {
  const user = await requireUser();
  const cookieStore = await cookies();
  const activeWorkspaceId =
    cookieStore.get("active_workspace_id")?.value ?? undefined;

  const activeWorkspace = await getActiveWorkspaceForUser(
    { id: user.id, email: user.email, name: user.user_metadata?.name },
    activeWorkspaceId,
  );

  const [members, invitations] = await Promise.all([
    listMembersForWorkspace(activeWorkspace.id),
    listInvitations({
      workspaceId: activeWorkspace.id,
      requestingUserId: user.id,
    }).catch((err) => {
      if (err instanceof InvitationAccessError) return [];
      throw err;
    }),
  ]);

  const isOwner = members.find((m) => m.userId === user.id)?.role === "owner";
  const pendingInvitations = invitations.filter((i) => i.status === "pending");

  return (
    <section>
      <h1>Members — {activeWorkspace.name}</h1>

      <section aria-label="Current members">
        <h2>Members</h2>
        <ul>
          {members.map((member) => (
            <li key={member.userId}>
              <span>
                {member.email}
                {member.name ? ` (${member.name})` : ""}
              </span>
              <span> · {member.role}</span>
              {isOwner &&
                member.userId !== user.id &&
                member.role !== "owner" && (
                  <form
                    action={`/api/workspaces/${activeWorkspace.id}/members/${member.userId}`}
                    method="POST"
                  >
                    <input type="hidden" name="_method" value="DELETE" />
                    <button
                      type="submit"
                      onClick={async (e) => {
                        e.preventDefault();
                        await fetch(
                          `/api/workspaces/${activeWorkspace.id}/members/${member.userId}`,
                          { method: "DELETE" },
                        );
                        window.location.reload();
                      }}
                    >
                      Remove
                    </button>
                  </form>
                )}
            </li>
          ))}
        </ul>
      </section>

      {pendingInvitations.length > 0 && (
        <section aria-label="Pending invitations">
          <h2>Pending invitations</h2>
          <ul>
            {pendingInvitations.map((inv) => (
              <li key={inv.id}>
                <span>{inv.email}</span>
                <span>
                  {" "}
                  · expires {new Date(inv.expiresAt).toLocaleDateString()}
                </span>
                {isOwner && (
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(
                        `/api/workspaces/${activeWorkspace.id}/invitations/${inv.id}`,
                        { method: "DELETE" },
                      );
                      window.location.reload();
                    }}
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isOwner && <InviteForm workspaceId={activeWorkspace.id} />}
    </section>
  );
}
