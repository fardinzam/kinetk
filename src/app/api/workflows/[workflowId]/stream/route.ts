import { requireUser } from "@/server/auth/session";
import { createRunQueries } from "@/server/runs/queries";
import { pollWorkflowStream, type StreamEvent } from "@/server/realtime/workflow-stream";

type StreamRouteContext = {
  params: Promise<{ workflowId: string }>;
};

function encodeEvent(event: StreamEvent): string {
  const { type, ...payload } = event;
  const data = Object.keys(payload).length > 0 ? JSON.stringify(payload) : "{}";
  return `event: ${type}\ndata: ${data}\n\n`;
}

export async function GET(request: Request, context: StreamRouteContext) {
  const user = await requireUser();
  const { workflowId } = await context.params;
  const url = new URL(request.url);
  const afterRevision = Number(url.searchParams.get("afterRevision") ?? "0");

  const q = createRunQueries();
  const workspaceId = await q.findWorkflowWorkspace(workflowId);

  if (!workspaceId || !(await q.userCanAccessWorkspace(user.id, workspaceId))) {
    return new Response("Not found", { status: 404 });
  }

  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of pollWorkflowStream(
          workspaceId,
          workflowId,
          afterRevision,
          abortController.signal,
        )) {
          controller.enqueue(encodeEvent(event));
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
