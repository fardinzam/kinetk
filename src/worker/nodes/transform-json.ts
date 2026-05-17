import type { TransformJsonNodeConfig } from "@/domain/workflows/node-configs";

import { isPathResolveError, resolvePath } from "../context/path-resolver";
import type { NodeExecutor } from "./index";

export const transformJsonExecutor: NodeExecutor = async ({
  config,
  context,
}) => {
  const { mappings } = config as TransformJsonNodeConfig;
  const output: Record<string, unknown> = {};

  for (const { source, target } of mappings) {
    const value = resolvePath(context, source);
    if (isPathResolveError(value)) {
      return {
        ok: false,
        error: `Path not found: ${source}`,
        retryable: false,
      };
    }
    output[target] = value;
  }

  return { ok: true, output };
};
