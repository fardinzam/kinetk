import type { NodeType } from "@/domain/workflows/node-configs";
import type { Queryable } from "@/server/db/pool";

import type { RunContext } from "../context/run-context";

export type NodeExecutorInput = {
  config: unknown;
  context: RunContext;
  db: Queryable;
};

export type NodeExecutorResult =
  | { ok: true; output: unknown; branch?: string }
  | { ok: false; error: string; retryable: boolean };

export type NodeExecutor = (
  input: NodeExecutorInput,
) => Promise<NodeExecutorResult>;

import { webhookTriggerExecutor } from "./webhook-trigger";
import { transformJsonExecutor } from "./transform-json";
import { conditionExecutor } from "./condition";
import { httpRequestExecutor } from "./http-request";
import { logExecutor } from "./log";

export const nodeExecutors: Record<NodeType, NodeExecutor> = {
  webhook_trigger: webhookTriggerExecutor,
  transform_json: transformJsonExecutor,
  condition: conditionExecutor,
  http_request: httpRequestExecutor,
  log: logExecutor,
};
