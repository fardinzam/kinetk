import { z } from "zod";

import {
  conditionNodeConfigSchema,
  httpRequestNodeConfigSchema,
  logNodeConfigSchema,
  nodeTypeSchema,
  transformJsonNodeConfigSchema,
  webhookTriggerNodeConfigSchema,
} from "./node-configs";

export { httpRequestNodeConfigSchema } from "./node-configs";

export const workflowSchemaVersionSchema = z.literal(1);
export const eventSchemaVersionSchema = z.literal(1);

export const workflowPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const workflowViewportSchema = workflowPositionSchema.extend({
  zoom: z.number().positive(),
});

export const nodeConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("webhook_trigger"),
    config: webhookTriggerNodeConfigSchema,
  }),
  z.object({
    type: z.literal("transform_json"),
    config: transformJsonNodeConfigSchema,
  }),
  z.object({
    type: z.literal("condition"),
    config: conditionNodeConfigSchema,
  }),
  z.object({
    type: z.literal("http_request"),
    config: httpRequestNodeConfigSchema,
  }),
  z.object({
    type: z.literal("log"),
    config: logNodeConfigSchema,
  }),
]);

export const workflowNodeSchema = z
  .object({
    id: z.string().min(1),
    type: nodeTypeSchema,
    position: workflowPositionSchema,
    config: z.unknown(),
  })
  .superRefine((node, context) => {
    const parsed = nodeConfigSchema.safeParse({
      type: node.type,
      config: node.config,
    });

    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        context.addIssue({
          ...issue,
          path: ["config", ...issue.path.slice(1)],
        });
      });
    }
  });

export const workflowEdgeSchema = z.object({
  id: z.string().min(1),
  sourceNodeId: z.string().min(1),
  sourceHandle: z.string().min(1).optional(),
  targetNodeId: z.string().min(1),
  targetHandle: z.string().min(1).optional(),
});

export const workflowGraphSchema = z.object({
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  viewport: workflowViewportSchema,
});

export type WorkflowGraphInput = z.input<typeof workflowGraphSchema>;
