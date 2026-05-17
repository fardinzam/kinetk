import { z } from "zod";

export const nodeTypeSchema = z.enum([
  "webhook_trigger",
  "transform_json",
  "condition",
  "http_request",
  "log",
]);

export const secretReferenceSchema = z.object({
  secretId: z.string().min(1),
  injectAs: z.enum(["raw", "Bearer", "Basic"]).default("raw"),
});

export const webhookTriggerNodeConfigSchema = z.object({}).strict();

export const transformJsonNodeConfigSchema = z.object({
  mappings: z
    .array(
      z.object({
        target: z.string().min(1),
        source: z.string().min(1),
      }),
    )
    .default([]),
});

export const conditionNodeConfigSchema = z.object({
  leftPath: z.string().min(1),
  operator: z.enum([
    "equals",
    "not_equals",
    "greater_than",
    "less_than",
    "exists",
    "does_not_exist",
  ]),
  rightValue: z.unknown().optional(),
});

export const httpRequestNodeConfigSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url: z.string().url(),
  headers: z.record(z.string(), secretReferenceSchema).default({}),
  bodyMode: z.enum(["current_payload", "empty"]).default("current_payload"),
});

export const logNodeConfigSchema = z.object({
  label: z.string().min(1).optional(),
});

export type NodeType = z.infer<typeof nodeTypeSchema>;
export type SecretReference = z.infer<typeof secretReferenceSchema>;
export type WebhookTriggerNodeConfig = z.infer<
  typeof webhookTriggerNodeConfigSchema
>;
export type TransformJsonNodeConfig = z.infer<
  typeof transformJsonNodeConfigSchema
>;
export type ConditionNodeConfig = z.infer<typeof conditionNodeConfigSchema>;
export type HttpRequestNodeConfig = z.infer<typeof httpRequestNodeConfigSchema>;
export type LogNodeConfig = z.infer<typeof logNodeConfigSchema>;

export type NodeConfigByType = {
  webhook_trigger: WebhookTriggerNodeConfig;
  transform_json: TransformJsonNodeConfig;
  condition: ConditionNodeConfig;
  http_request: HttpRequestNodeConfig;
  log: LogNodeConfig;
};

export type NodeConfig = NodeConfigByType[NodeType];
