import { Buffer } from "node:buffer";

import { z } from "zod";

const encryptionKeySchema = z.string().superRefine((value, context) => {
  try {
    const decoded = Buffer.from(value, "base64");

    if (decoded.length !== 32) {
      context.addIssue({
        code: "custom",
        message: "APP_ENCRYPTION_KEY_BASE64 must decode to 32 bytes",
      });
    }
  } catch {
    context.addIssue({
      code: "custom",
      message: "APP_ENCRYPTION_KEY_BASE64 must be valid base64",
    });
  }
});

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  APP_ENCRYPTION_KEY_BASE64: encryptionKeySchema,
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  RESEND_API_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  env: Record<string, string | undefined>,
): ServerEnv {
  const parsed = serverEnvSchema.safeParse(env);

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment: ${z.prettifyError(parsed.error)}`,
    );
  }

  return parsed.data;
}
