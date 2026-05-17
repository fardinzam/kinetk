import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/session";
import { createRunQueries } from "@/server/runs/queries";

type HistoryRouteContext = {
  params: Promise<{ workflowId: string }>;
};

export async function GET(request: Request, context: HistoryRouteContext) {
  const user = await requireUser();
  const { workflowId } = await context.params;
  const url = new URL(request.url);

  const limitParam = Number(url.searchParams.get("limit") ?? "20");
  const limit = Math.min(Math.max(1, limitParam), 50);
  const beforeParam = url.searchParams.get("before");
  const before = beforeParam ? new Date(beforeParam) : undefined;

  const q = createRunQueries();

  const workspaceId = await q.findWorkflowWorkspace(workflowId);
  if (!workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await q.userCanAccessWorkspace(user.id, workspaceId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const runs = await q.listRunsForWorkflow(workflowId, workspaceId, limit + 1, before);
  const hasMore = runs.length > limit;
  const page = hasMore ? runs.slice(0, limit) : runs;
  const nextCursor = hasMore ? page[page.length - 1]!.queuedAt.toISOString() : null;

  return NextResponse.json({ runs: page, nextCursor });
}
