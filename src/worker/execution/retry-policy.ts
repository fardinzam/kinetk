const RETRY_DELAY_MS = [2_000, 10_000, 60_000];
export const MAX_HTTP_RETRIES = 3;

export function getRetryDelayMs(attempt: number): number {
  return RETRY_DELAY_MS[attempt - 1] ?? RETRY_DELAY_MS[RETRY_DELAY_MS.length - 1]!;
}
