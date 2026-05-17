import type { RunContext } from "./run-context";

export type PathResolveError = { code: "context_path_not_found"; path: string };

function isError(v: unknown): v is PathResolveError {
  return typeof v === "object" && v !== null && (v as PathResolveError).code === "context_path_not_found";
}

function traverse(value: unknown, segments: string[], originalPath: string): unknown | PathResolveError {
  if (segments.length === 0) return value;
  if (value === null || value === undefined || typeof value !== "object") {
    return { code: "context_path_not_found", path: originalPath };
  }
  const [head, ...rest] = segments;
  const next = (value as Record<string, unknown>)[head!];
  if (next === undefined) {
    return { code: "context_path_not_found", path: originalPath };
  }
  return traverse(next, rest, originalPath);
}

export function resolvePath(ctx: RunContext, path: string): unknown | PathResolveError {
  const [root, ...rest] = path.split(".");

  if (root === "current") {
    return traverse(ctx.currentPayload, rest, path);
  }

  if (root === "initial") {
    return traverse(ctx.initialPayload, rest, path);
  }

  if (root === "nodes") {
    const [nodeId, ...nestedRest] = rest;
    if (!nodeId) return { code: "context_path_not_found", path };
    if (!ctx.nodeOutputs.has(nodeId)) return { code: "context_path_not_found", path };
    return traverse(ctx.nodeOutputs.get(nodeId), nestedRest, path);
  }

  return { code: "context_path_not_found", path };
}

export { isError as isPathResolveError };
