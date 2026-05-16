import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/server/auth/session";
import {
  disableSecret,
  rotateSecretValue,
  SecretAccessError,
  SecretNotFoundError,
} from "@/server/secrets/service";

type SecretRouteContext = {
  params: Promise<{ secretId: string }>;
};

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rotate"), plaintext: z.string().min(1) }),
  z.object({ action: z.literal("disable") }),
]);

export async function PATCH(request: Request, context: SecretRouteContext) {
  const user = await requireUser();
  const { secretId } = await context.params;
  const parsed = patchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const secret =
      parsed.data.action === "rotate"
        ? await rotateSecretValue({ userId: user.id, secretId, newPlaintext: parsed.data.plaintext })
        : await disableSecret({ userId: user.id, secretId });

    return NextResponse.json({ secret });
  } catch (error) {
    if (error instanceof SecretAccessError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (error instanceof SecretNotFoundError) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }
    throw error;
  }
}
