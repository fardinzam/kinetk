"use client";

import { useState } from "react";

type Props = { workspaceId: string };

export function InviteForm({ workspaceId }: Props) {
  const [email, setEmail] = useState("");
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setAcceptUrl(null);
    setIsSubmitting(true);

    const res = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Something went wrong.");
      return;
    }

    const data = (await res.json()) as { acceptUrl: string };
    setAcceptUrl(data.acceptUrl);
    setEmail("");
  }

  return (
    <div>
      <h2>Invite someone</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="invite-email">Email address</label>
        <input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@example.com"
        />
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creating..." : "Create invite link"}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {acceptUrl ? (
        <div>
          <p>Share this link with {email || "the invitee"}:</p>
          <code>{acceptUrl}</code>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(acceptUrl)}
          >
            Copy link
          </button>
        </div>
      ) : null}
    </div>
  );
}
