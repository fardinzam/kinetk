"use client";

import { useState } from "react";

type Props = { token: string };

export function AcceptInvitationButton({ token }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAccept() {
    setError(null);
    setIsSubmitting(true);

    const res = await fetch(`/api/invitations/${token}/accept`, {
      method: "POST",
    });

    if (res.ok) {
      window.location.assign("/workflows");
      return;
    }

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setError(data.error ?? "Something went wrong. Please try again.");
    setIsSubmitting(false);
  }

  return (
    <>
      {error ? <p role="alert">{error}</p> : null}
      <button disabled={isSubmitting} onClick={handleAccept} type="button">
        {isSubmitting ? "Joining..." : "Join workspace"}
      </button>
    </>
  );
}
