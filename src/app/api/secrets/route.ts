import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/server/auth/session";
import {
  createSecretForWorkspace,
  listSecretsForWorkspace,
  SecretAccessError,
} from "@/server/secrets/service";

const createSecretSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  plaintext: z.string().min(1),
});

export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId is required" },
      { status: 400 },
    );
  }

  try {
    const secrets = await listSecretsForWorkspace({
      userId: user.id,
      workspaceId,
    });
    return NextResponse.json({ secrets });
  } catch (error) {
    if (error instanceof SecretAccessError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = createSecretSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const secret = await createSecretForWorkspace({
      userId: user.id,
      workspaceId: parsed.data.workspaceId,
      name: parsed.data.name,
      description: parsed.data.description,
      plaintext: parsed.data.plaintext,
    });
    return NextResponse.json({ secret }, { status: 201 });
  } catch (error) {
    if (error instanceof SecretAccessError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    throw error;
  }
}
