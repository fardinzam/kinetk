import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import { createRunQueries } from "@/server/runs/queries";

type RunRouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_request: Request, context: RunRouteContext) {
  const user = await requireUser();
  const { runId } = await context.params;

  const q = createRunQueries();

  const workspaceId = await q.findRunWorkspace(runId);
  if (!workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await q.userCanAccessWorkspace(user.id, workspaceId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [run, steps] = await Promise.all([
    q.findRunById(runId, workspaceId),
    q.findStepsByRunId(runId, workspaceId),
  ]);

  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ run, steps });
}
