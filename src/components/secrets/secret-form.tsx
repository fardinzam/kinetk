"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SecretFormProps = {
  workspaceId: string;
};

export function SecretForm({ workspaceId }: SecretFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [plaintext, setPlaintext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        name,
        description: description.trim() || undefined,
        plaintext,
      }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setError("Could not create secret.");
      return;
    }

    setName("");
    setDescription("");
    setPlaintext("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>New secret</h2>
      <label htmlFor="secret-name">Name</label>
      <input
        id="secret-name"
        maxLength={120}
        onChange={(e) => setName(e.target.value)}
        required
        type="text"
        value={name}
      />
      <label htmlFor="secret-description">Description (optional)</label>
      <input
        id="secret-description"
        maxLength={500}
        onChange={(e) => setDescription(e.target.value)}
        type="text"
        value={description}
      />
      <label htmlFor="secret-value">Value</label>
      <input
        id="secret-value"
        onChange={(e) => setPlaintext(e.target.value)}
        required
        type="password"
        value={plaintext}
      />
      {error ? <p role="alert">{error}</p> : null}
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Saving..." : "Save secret"}
      </button>
    </form>
  );
}
