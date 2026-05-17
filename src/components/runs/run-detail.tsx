import type { RunSummary, StepRunRecord } from "@/server/runs/queries";

import { StepTimeline } from "./step-timeline";

type RunDetailProps = {
  run: RunSummary;
  steps: StepRunRecord[];
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString();
}

function durationMs(start: Date | null, end: Date | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

export function RunDetail({ run, steps }: RunDetailProps) {
  return (
    <section aria-label="Run detail">
      <header>
        <h1>Run {run.id.slice(0, 8)}…</h1>
        <dl>
          <dt>Status</dt><dd>{run.status}</dd>
          <dt>Steps</dt><dd>{run.stepCount}</dd>
          <dt>Queued</dt><dd>{formatDate(run.queuedAt)}</dd>
          <dt>Started</dt><dd>{formatDate(run.startedAt)}</dd>
          <dt>Finished</dt><dd>{formatDate(run.finishedAt)}</dd>
          <dt>Duration</dt><dd>{durationMs(run.startedAt, run.finishedAt)}</dd>
          {run.errorSummary && <><dt>Error</dt><dd>{run.errorSummary}</dd></>}
        </dl>
        <a href={`/workflows/${run.workflowId}?runId=${run.id}`}>
          Open in editor
        </a>
      </header>
      <StepTimeline steps={steps} />
    </section>
  );
}
