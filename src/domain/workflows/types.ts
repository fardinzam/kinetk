import type { JsonValue } from "@/types/json";

import type { NodeConfigByType, NodeType } from "./node-configs";

export type WorkflowSchemaVersion = 1;
export type EventSchemaVersion = 1;

export type WorkflowPosition = {
  x: number;
  y: number;
};

export type WorkflowViewport = WorkflowPosition & {
  zoom: number;
};

export type WorkflowNode<TType extends NodeType = NodeType> = {
  id: string;
  type: TType;
  position: WorkflowPosition;
  config: NodeConfigByType[TType];
};

export type WorkflowEdge = {
  id: string;
  sourceNodeId: string;
  sourceHandle?: string;
  targetNodeId: string;
  targetHandle?: string;
};

export type WorkflowGraph = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: WorkflowViewport;
};

export type WorkflowEventBase<TType extends string, TPayload extends JsonValue> = {
  clientEventId: string;
  type: TType;
  eventSchemaVersion: EventSchemaVersion;
  payload: TPayload;
  createdAt: string;
};
