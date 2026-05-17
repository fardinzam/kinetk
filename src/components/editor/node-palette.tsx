import type { NodeType } from "@/domain/workflows/node-configs";

type NodePaletteProps = {
  canAddWebhookTrigger: boolean;
  onAddNode(type: NodeType): void;
};

const nodeTypes: Array<{ type: NodeType; label: string }> = [
  { type: "webhook_trigger", label: "webhook trigger" },
  { type: "transform_json", label: "transform json" },
  { type: "condition", label: "condition" },
  { type: "http_request", label: "http request" },
  { type: "log", label: "log" },
];

export function NodePalette({
  canAddWebhookTrigger,
  onAddNode,
}: NodePaletteProps) {
  return (
    <aside aria-label="Node palette">
      {nodeTypes.map((nodeType) => (
        <button
          disabled={
            nodeType.type === "webhook_trigger" && !canAddWebhookTrigger
          }
          key={nodeType.type}
          onClick={() => onAddNode(nodeType.type)}
          type="button"
        >
          Add {nodeType.label}
        </button>
      ))}
    </aside>
  );
}
