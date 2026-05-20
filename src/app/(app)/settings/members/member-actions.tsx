"use client";

type RemoveMemberButtonProps = { workspaceId: string; userId: string };

export function RemoveMemberButton({
  workspaceId,
  userId,
}: RemoveMemberButtonProps) {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
          method: "DELETE",
        });
        window.location.reload();
      }}
    >
      Remove
    </button>
  );
}

type RevokeInvitationButtonProps = {
  workspaceId: string;
  invitationId: string;
};

export function RevokeInvitationButton({
  workspaceId,
  invitationId,
}: RevokeInvitationButtonProps) {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch(
          `/api/workspaces/${workspaceId}/invitations/${invitationId}`,
          { method: "DELETE" },
        );
        window.location.reload();
      }}
    >
      Revoke
    </button>
  );
}
