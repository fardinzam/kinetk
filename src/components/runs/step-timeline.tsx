import type { StepRunRecord } from "@/server/runs/queries";

import { JsonViewer } from "./json-viewer";

type StepTimelineProps = {
  steps: StepRunRecord[];
};

export function StepTimeline({ steps }: StepTimelineProps) {
  if (steps.length === 0) return <p>No steps recorded.</p>;

  return (
    <ol aria-label="Step timeline">
      {steps.map((step) => (
        <li key={step.id} style={{ marginBottom: 16 }}>
          <strong>{step.nodeType.replaceAll("_", " ")}</strong>{" "}
          <code>{step.nodeId}</code>
          {" · "}
          <span>{step.status}</span>
          {step.durationMs !== null && <span> · {step.durationMs}ms</span>}
          {step.attempt > 1 && <span> · attempt {step.attempt}</span>}
          <div style={{ marginTop: 4 }}>
            <JsonViewer label="Input" data={step.inputJson} />
            <JsonViewer label="Output" data={step.outputJson} />
            <JsonViewer label="Error" data={step.errorJson} />
          </div>
        </li>
      ))}
    </ol>
  );
}
