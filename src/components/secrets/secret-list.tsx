"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SecretMetadata } from "@/server/secrets/service";

type SecretListProps = {
  secrets: SecretMetadata[];
};

export function SecretList({ secrets }: SecretListProps) {
  if (secrets.length === 0) {
    return <p>No secrets yet.</p>;
  }

  return (
    <ul aria-label="Secrets">
      {secrets.map((secret) => (
        <SecretRow key={secret.id} secret={secret} />
      ))}
    </ul>
  );
}

function SecretRow({ secret }: { secret: SecretMetadata }) {
  const router = useRouter();
  const [rotating, setRotating] = useState(false);
  const [newPlaintext, setNewPlaintext] = useState("");
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRotate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRotateError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/secrets/${secret.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rotate", plaintext: newPlaintext }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setRotateError("Could not rotate secret.");
      return;
    }

    setRotating(false);
    setNewPlaintext("");
    router.refresh();
  }

  async function handleDisable() {
    setIsSubmitting(true);
    const response = await fetch(`/api/secrets/${secret.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disable" }),
    });
    setIsSubmitting(false);
    if (response.ok) router.refresh();
  }

  return (
    <li>
      <strong>{secret.name}</strong>
      {secret.description ? <span> — {secret.description}</span> : null}
      <span> [{secret.status}]</span>

      {rotating ? (
        <form onSubmit={handleRotate}>
          <input
            autoFocus
            onChange={(e) => setNewPlaintext(e.target.value)}
            placeholder="New value"
            required
            type="password"
            value={newPlaintext}
          />
          {rotateError ? <span role="alert">{rotateError}</span> : null}
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Rotating..." : "Confirm rotate"}
          </button>
          <button
            disabled={isSubmitting}
            onClick={() => { setRotating(false); setNewPlaintext(""); }}
            type="button"
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <button
            disabled={secret.status === "disabled" || isSubmitting}
            onClick={() => setRotating(true)}
            type="button"
          >
            Rotate
          </button>
          <button
            disabled={secret.status === "disabled" || isSubmitting}
            onClick={handleDisable}
            type="button"
          >
            Disable
          </button>
        </>
      )}
    </li>
  );
}
