import Link from "next/link";

import { getCurrentUser } from "@/server/auth/session";
import { getInvitationByToken } from "@/server/invitations/service";

import { AcceptInvitationButton } from "./accept-button";

type AcceptInvitationPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AcceptInvitationPage({
  searchParams,
}: AcceptInvitationPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main>
        <h1>Invalid invitation</h1>
        <p>This invitation link is missing a token.</p>
        <p>
          <Link href="/sign-in">Go to sign in</Link>
        </p>
      </main>
    );
  }

  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return (
      <main>
        <h1>Invitation not found</h1>
        <p>This invitation link is invalid or has already been used.</p>
        <p>
          <Link href="/sign-in">Go to sign in</Link>
        </p>
      </main>
    );
  }

  if (invitation.status !== "pending" || invitation.expiresAt < new Date()) {
    return (
      <main>
        <h1>Invitation expired</h1>
        <p>
          This invitation to <strong>{invitation.workspaceName}</strong> is no
          longer valid. Ask the workspace owner to send a new one.
        </p>
        <p>
          <Link href="/sign-in">Go to sign in</Link>
        </p>
      </main>
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    const next = encodeURIComponent(`/accept-invitation?token=${token}`);
    return (
      <main>
        <h1>You&apos;ve been invited</h1>
        <p>
          You&apos;ve been invited to join{" "}
          <strong>{invitation.workspaceName}</strong>.
        </p>
        <p>Sign in or create an account to accept this invitation.</p>
        <p>
          <Link href={`/sign-in?next=/accept-invitation?token=${token}`}>
            Sign in
          </Link>
          {" · "}
          <Link href={`/sign-up?next=/accept-invitation?token=${token}`}>
            Create account
          </Link>
        </p>
        {/* next is encoded in the URL for the auth callback */}
        <input type="hidden" value={next} />
      </main>
    );
  }

  return (
    <main>
      <h1>You&apos;ve been invited</h1>
      <p>
        You&apos;ve been invited to join{" "}
        <strong>{invitation.workspaceName}</strong>.
      </p>
      <AcceptInvitationButton token={token} />
    </main>
  );
}
