import { NextResponse } from "next/server";

import { handleWebhook } from "@/server/webhooks/handler";

type HookRouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: HookRouteContext) {
  const { token } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const result = await handleWebhook(token, payload);
  return NextResponse.json(result);
}
