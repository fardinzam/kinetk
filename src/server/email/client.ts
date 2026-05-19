import "server-only";

import { Resend } from "resend";

import { serverEnv } from "@/server/env";

export function getResendClient(): Resend {
  if (!serverEnv.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is not configured — set it to enable invitation emails",
    );
  }
  return new Resend(serverEnv.RESEND_API_KEY);
}
