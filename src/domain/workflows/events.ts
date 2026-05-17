import { z } from "zod";

import type { EventSchemaVersion, WorkflowEventBase } from "./types";
import { workflowEdgeSchema, workflowNodeSchema } from "./schemas";

export const workflowEventTypeSchema = z.enum([
  "workflow_renamed",
  "node_added",
  "node_updated",
  "node_moved",
  "node_deleted",
  "edge_added",
  "edge_deleted",
]);

export type WorkflowEventType = z.infer<typeof workflowEventTypeSchema>;

export const workflowEventSchema = z.discriminatedUnion("type", [
  z.object({
    clientEventId: z.string().min(1),
    type: z.literal("workflow_renamed"),
    eventSchemaVersion: z.literal(1),
    payload: z.object({ name: z.string().min(1) }),
    createdAt: z.string().datetime(),
  }),
  z.object({
    clientEventId: z.string().min(1),
    type: z.literal("node_added"),
    eventSchemaVersion: z.literal(1),
    payload: z.object({ node: workflowNodeSchema }),
    createdAt: z.string().datetime(),
  }),
  z.object({
    clientEventId: z.string().min(1),
    type: z.literal("node_updated"),
    eventSchemaVersion: z.literal(1),
    payload: z.object({
      nodeId: z.string().min(1),
      config: z.unknown(),
    }),
    createdAt: z.string().datetime(),
  }),
  z.object({
    clientEventId: z.string().min(1),
    type: z.literal("node_moved"),
    eventSchemaVersion: z.literal(1),
    payload: z.object({
      nodeId: z.string().min(1),
      position: z.object({ x: z.number(), y: z.number() }),
    }),
    createdAt: z.string().datetime(),
  }),
  z.object({
    clientEventId: z.string().min(1),
    type: z.literal("node_deleted"),
    eventSchemaVersion: z.literal(1),
    payload: z.object({ nodeId: z.string().min(1) }),
    createdAt: z.string().datetime(),
  }),
  z.object({
    clientEventId: z.string().min(1),
    type: z.literal("edge_added"),
    eventSchemaVersion: z.literal(1),
    payload: z.object({ edge: workflowEdgeSchema }),
    createdAt: z.string().datetime(),
  }),
  z.object({
    clientEventId: z.string().min(1),
    type: z.literal("edge_deleted"),
    eventSchemaVersion: z.literal(1),
    payload: z.object({ edgeId: z.string().min(1) }),
    createdAt: z.string().datetime(),
  }),
]);

export type WorkflowEvent = z.infer<typeof workflowEventSchema>;

export const CURRENT_EVENT_SCHEMA_VERSION: EventSchemaVersion = 1;

export type WorkflowEventFor<TType extends WorkflowEventType> = Extract<
  WorkflowEvent,
  WorkflowEventBase<TType, never>
>;
