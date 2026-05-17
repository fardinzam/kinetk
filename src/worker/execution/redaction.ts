import type { HttpRequestNodeConfig } from "@/domain/workflows/node-configs";

export function redactHttpRequestConfig(config: HttpRequestNodeConfig): object {
  return {
    ...config,
    headers: Object.fromEntries(
      Object.entries(config.headers ?? {}).map(([name, ref]) => [
        name,
        { secretId: ref.secretId, injectAs: ref.injectAs, value: "[REDACTED]" },
      ]),
    ),
  };
}
