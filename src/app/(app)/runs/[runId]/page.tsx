import { notFound } from "next/navigation";

import { RunDetail } from "@/components/runs/run-detail";
import { requireUser } from "@/server/auth/session";
import { createRunQueries } from "@/server/runs/queries";

type RunDetailPageProps = {
  params: Promise<{ runId: string }>;
};

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const user = await requireUser();
  const { runId } = await params;

  const q = createRunQueries();

  const workspaceId = await q.findRunWorkspace(runId);
  if (!workspaceId) notFound();

  if (!(await q.userCanAccessWorkspace(user.id, workspaceId))) notFound();

  const [run, steps] = await Promise.all([
    q.findRunById(runId, workspaceId),
    q.findStepsByRunId(runId, workspaceId),
  ]);

  if (!run) notFound();

  return <RunDetail run={run} steps={steps} />;
}
