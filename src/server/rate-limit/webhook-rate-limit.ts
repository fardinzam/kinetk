import "server-only";

import type { Queryable } from "@/server/db/pool";

const DEFAULT_MAX_REQUESTS = 10;

export async function checkRateLimit(
  tokenHash: string,
  maxRequests: number = DEFAULT_MAX_REQUESTS,
  db?: Queryable,
): Promise<boolean> {
  const queryable = db ?? (await import("@/server/db/pool")).getPool();
  const result = await queryable.query<{ request_count: number }>(
    `
      insert into public.webhook_rate_limits (token_hash, window_start, request_count, updated_at)
      values ($1, date_trunc('second', now()), 1, now())
      on conflict (token_hash, window_start)
      do update set
        request_count = webhook_rate_limits.request_count + 1,
        updated_at = now()
      returning request_count
    `,
    [tokenHash],
  );

  const count = result.rows[0]?.request_count ?? 1;
  return count <= maxRequests;
}
