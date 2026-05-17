import type { ConditionNodeConfig } from "@/domain/workflows/node-configs";

import { isPathResolveError, resolvePath } from "../context/path-resolver";
import type { NodeExecutor } from "./index";

function evaluate(
  left: unknown,
  operator: ConditionNodeConfig["operator"],
  right: unknown,
): boolean {
  switch (operator) {
    case "equals":
      return left === right;
    case "not_equals":
      return left !== right;
    case "greater_than":
      return Number(left) > Number(right);
    case "less_than":
      return Number(left) < Number(right);
    case "exists":
      return left !== null && left !== undefined;
    case "does_not_exist":
      return left === null || left === undefined;
  }
}

export const conditionExecutor: NodeExecutor = async ({ config, context }) => {
  const { leftPath, operator, rightValue } = config as ConditionNodeConfig;

  const left = resolvePath(context, leftPath);
  if (isPathResolveError(left)) {
    return {
      ok: false,
      error: `Path not found: ${leftPath}`,
      retryable: false,
    };
  }

  const result = evaluate(left, operator, rightValue);
  return {
    ok: true,
    output: context.currentPayload,
    branch: result ? "true" : "false",
  };
};
