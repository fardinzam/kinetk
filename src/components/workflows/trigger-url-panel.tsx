"use client";

import { useEffect, useState } from "react";

type TriggerState =
  | { phase: "loading" }
  | { phase: "none" }
  | { phase: "active"; triggerId: string; lastChars: string }
  | { phase: "disabled" }
  | { phase: "revealed"; url: string };

type TriggerUrlPanelProps = {
  workflowId: string;
};

export function TriggerUrlPanel({ workflowId }: TriggerUrlPanelProps) {
  const [state, setState] = useState<TriggerState>({ phase: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/workflows/${workflowId}/triggers`)
      .then((r) => r.json())
      .then((data: { trigger: { id: string; status: string } | null }) => {
        if (!data.trigger) {
          setState({ phase: "none" });
        } else if (data.trigger.status === "disabled") {
          setState({ phase: "disabled" });
        } else {
          setState({
            phase: "active",
            triggerId: data.trigger.id,
            lastChars: data.trigger.id.slice(-6),
          });
        }
      });
  }, [workflowId]);

  function buildUrl(token: string) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    return `${base}/api/hooks/${token}`;
  }

  async function handleGenerate() {
    setBusy(true);
    const response = await fetch(`/api/workflows/${workflowId}/triggers`, {
      method: "POST",
    });
    setBusy(false);
    if (!response.ok) return;
    const data = (await response.json()) as { token: string };
    setState({ phase: "revealed", url: buildUrl(data.token) });
  }

  async function handleRotate() {
    setBusy(true);
    const response = await fetch(`/api/workflows/${workflowId}/triggers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rotate" }),
    });
    setBusy(false);
    if (!response.ok) return;
    const data = (await response.json()) as { token: string };
    setState({ phase: "revealed", url: buildUrl(data.token) });
  }

  async function handleDisable() {
    setBusy(true);
    const response = await fetch(`/api/workflows/${workflowId}/triggers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disable" }),
    });
    setBusy(false);
    if (response.ok) setState({ phase: "disabled" });
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url);
  }

  if (state.phase === "loading") {
    return <section aria-label="Webhook trigger">Loading trigger...</section>;
  }

  return (
    <section aria-label="Webhook trigger">
      <h2>Webhook trigger</h2>

      {state.phase === "none" && (
        <button disabled={busy} onClick={handleGenerate} type="button">
          {busy ? "Generating..." : "Generate webhook URL"}
        </button>
      )}

      {state.phase === "revealed" && (
        <>
          <p role="alert">
            Save this URL now — you will not be able to see it again.
          </p>
          <code>{state.url}</code>
          <button onClick={() => handleCopy(state.url)} type="button">
            Copy
          </button>
          <button disabled={busy} onClick={handleRotate} type="button">
            {busy ? "Rotating..." : "Rotate"}
          </button>
          <button disabled={busy} onClick={handleDisable} type="button">
            {busy ? "Disabling..." : "Disable"}
          </button>
        </>
      )}

      {state.phase === "active" && (
        <>
          <code>…{state.lastChars}</code>
          <button disabled={busy} onClick={handleRotate} type="button">
            {busy ? "Rotating..." : "Rotate"}
          </button>
          <button disabled={busy} onClick={handleDisable} type="button">
            {busy ? "Disabling..." : "Disable"}
          </button>
        </>
      )}

      {state.phase === "disabled" && (
        <p>Trigger is disabled. Re-enable by rotating to generate a new token.</p>
      )}
    </section>
  );
}
