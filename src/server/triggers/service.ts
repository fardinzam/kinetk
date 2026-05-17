import "server-only";

import type { TriggerQueries, TriggerRecord } from "./queries";
import { generateToken, hashToken } from "./tokens";

export type { TriggerRecord };

export class TriggerAccessError extends Error {
  readonly code = "trigger_access_denied";
  constructor() {
    super("Access denied");
  }
}

export class TriggerNotFoundError extends Error {
  readonly code = "trigger_not_found";
  constructor() {
    super("Trigger not found");
  }
}

async function getQueries(queries?: TriggerQueries): Promise<TriggerQueries> {
  if (queries) return queries;
  const mod = await import("./queries");
  return mod.createTriggerQueries();
}

async function findTriggerWithAccess(
  userId: string,
  triggerId: string,
  q: TriggerQueries,
): Promise<TriggerRecord> {
  const trigger = await q.findTriggerById(triggerId);
  if (!trigger) throw new TriggerNotFoundError();
  if (!(await q.userCanAccessWorkspace(userId, trigger.workspaceId))) {
    throw new TriggerAccessError();
  }
  return trigger;
}

export async function createTrigger(
  input: { userId: string; workflowId: string; workspaceId: string },
  queries?: TriggerQueries,
): Promise<{ trigger: TriggerRecord; token: string }> {
  const q = await getQueries(queries);
  if (!(await q.userCanAccessWorkspace(input.userId, input.workspaceId))) {
    throw new TriggerAccessError();
  }
  const token = generateToken();
  const trigger = await q.createTrigger({
    workflowId: input.workflowId,
    workspaceId: input.workspaceId,
    tokenHash: hashToken(token),
  });
  return { trigger, token };
}

export async function rotateTrigger(
  input: { userId: string; triggerId: string },
  queries?: TriggerQueries,
): Promise<{ trigger: TriggerRecord; token: string }> {
  const q = await getQueries(queries);
  await findTriggerWithAccess(input.userId, input.triggerId, q);
  const token = generateToken();
  const trigger = await q.updateTriggerHash(input.triggerId, hashToken(token));
  return { trigger, token };
}

export async function disableTrigger(
  input: { userId: string; triggerId: string },
  queries?: TriggerQueries,
): Promise<TriggerRecord> {
  const q = await getQueries(queries);
  await findTriggerWithAccess(input.userId, input.triggerId, q);
  return q.updateTriggerStatus(input.triggerId, "disabled");
}

export async function getTriggerForWorkflow(
  input: { userId: string; workflowId: string; workspaceId: string },
  queries?: TriggerQueries,
): Promise<TriggerRecord | null> {
  const q = await getQueries(queries);
  if (!(await q.userCanAccessWorkspace(input.userId, input.workspaceId))) {
    throw new TriggerAccessError();
  }
  return q.findTriggerByWorkflow(input.workflowId);
}
