"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CreateWorkflowDialogProps = {
  workspaceId: string;
};

export function CreateWorkflowDialog({ workspaceId }: CreateWorkflowDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, name }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setError("Could not create workflow.");
      return;
    }

    setName("");
    setIsOpen(false);
    router.refresh();
  }

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)}>
        New workflow
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create workflow</h2>
      <label htmlFor="workflow-name">Name</label>
      <input
        autoFocus
        id="workflow-name"
        maxLength={120}
        name="name"
        onChange={(event) => setName(event.target.value)}
        required
        type="text"
        value={name}
      />
      {error ? <p role="alert">{error}</p> : null}
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creating..." : "Create"}
      </button>
      <button
        disabled={isSubmitting}
        onClick={() => {
          setError(null);
          setIsOpen(false);
        }}
        type="button"
      >
        Cancel
      </button>
    </form>
  );
}
