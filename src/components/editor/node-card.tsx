import type { WorkflowNode, WorkflowPosition } from "@/domain/workflows/types";

import { ConnectionHandles } from "./connection-handles";

type StepStatus = "succeeded" | "failed" | "running" | "skipped";

type NodeCardProps = {
  node: WorkflowNode;
  isSelected: boolean;
  isConnectingFrom: boolean;
  stepStatus?: StepStatus;
  onConnectFrom(nodeId: string, sourceHandle?: string): void;
  onConnectTo(nodeId: string): void;
  onPointerDown(nodeId: string, pointer: WorkflowPosition): void;
};

function formatNodeType(type: string): string {
  return type.replaceAll("_", " ");
}

export function NodeCard({
  node,
  isSelected,
  isConnectingFrom,
  stepStatus,
  onConnectFrom,
  onConnectTo,
  onPointerDown,
}: NodeCardProps) {
  const label = formatNodeType(node.type);

  return (
    <div
      aria-label={`${label} ${node.id}`}
      data-position={`${node.position.x},${node.position.y}`}
      data-testid={`node-${node.id}`}
      onPointerDown={(event) => {
        event.preventDefault();
        onPointerDown(node.id, {
          x: event.clientX,
          y: event.clientY,
        });
      }}
      role="button"
      style={{
        position: "absolute",
        left: node.position.x,
        top: node.position.y,
        width: 180,
        minHeight: 76,
        border: isSelected
          ? "2px solid #0f766e"
          : stepStatus === "failed"
            ? "2px solid #dc2626"
            : stepStatus === "succeeded"
              ? "2px solid #16a34a"
              : stepStatus === "running"
                ? "2px solid #d97706"
                : "1px solid #cbd5e1",
        borderRadius: 8,
        background: stepStatus === "failed" ? "#fef2f2" : "#ffffff",
        boxShadow: isSelected
          ? "0 12px 24px rgba(15, 118, 110, 0.16)"
          : "0 8px 18px rgba(15, 23, 42, 0.08)",
        color: "#0f172a",
        cursor: "grab",
        padding: 12,
        textAlign: "left",
        touchAction: "none",
      }}
      tabIndex={0}
    >
      {stepStatus === "failed" && (
        <span
          aria-label="Failed"
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            background: "#dc2626",
            color: "#fff",
            borderRadius: "50%",
            width: 18,
            height: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: "bold",
          }}
        >
          ✕
        </span>
      )}
      <span style={{ display: "block", fontSize: 12, color: "#475569" }}>
        {label}
      </span>
      <strong style={{ display: "block", marginTop: 6 }}>{node.id}</strong>
      <ConnectionHandles
        isConnectingFrom={isConnectingFrom}
        nodeId={node.id}
        nodeType={node.type}
        onConnectFrom={onConnectFrom}
        onConnectTo={onConnectTo}
      />
    </div>
  );
}
