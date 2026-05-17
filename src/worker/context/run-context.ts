export type RunContext = {
  readonly initialPayload: unknown;
  readonly currentPayload: unknown;
  readonly nodeOutputs: ReadonlyMap<string, unknown>;
};

export function createRunContext(initialPayload: unknown): RunContext {
  return {
    initialPayload,
    currentPayload: initialPayload,
    nodeOutputs: new Map(),
  };
}

export function setNodeOutput(
  ctx: RunContext,
  nodeId: string,
  output: unknown,
): RunContext {
  const nodeOutputs = new Map(ctx.nodeOutputs);
  nodeOutputs.set(nodeId, output);
  return { ...ctx, currentPayload: output, nodeOutputs };
}
