import type {
  ConditionNodeConfig,
  HttpRequestNodeConfig,
  LogNodeConfig,
  TransformJsonNodeConfig,
} from "@/domain/workflows/node-configs";
import type { WorkflowNode } from "@/domain/workflows/types";

type NodeConfigPanelProps = {
  node: WorkflowNode | null;
  onChange(config: unknown): void;
};

export function NodeConfigPanel({ node, onChange }: NodeConfigPanelProps) {
  if (!node) {
    return (
      <aside aria-label="Node config">
        <h2>Node config</h2>
        <p>Select a node to edit config.</p>
      </aside>
    );
  }

  return (
    <aside aria-label="Node config">
      <h2>Node config</h2>
      <p>{node.type.replaceAll("_", " ")}</p>
      {node.type === "webhook_trigger" ? (
        <p>Webhook trigger has no config.</p>
      ) : null}
      {node.type === "transform_json" ? (
        <TransformJsonFields
          config={node.config as TransformJsonNodeConfig}
          onChange={(config) => onChange(config)}
        />
      ) : null}
      {node.type === "condition" ? (
        <ConditionFields
          config={node.config as ConditionNodeConfig}
          onChange={onChange}
        />
      ) : null}
      {node.type === "http_request" ? (
        <HttpRequestFields
          config={node.config as HttpRequestNodeConfig}
          onChange={onChange}
        />
      ) : null}
      {node.type === "log" ? (
        <LogFields config={node.config as LogNodeConfig} onChange={onChange} />
      ) : null}
    </aside>
  );
}

function TransformJsonFields({
  config,
  onChange,
}: {
  config: TransformJsonNodeConfig;
  onChange(config: TransformJsonNodeConfig): void;
}) {
  const mapping = config.mappings[0] ?? { target: "", source: "" };

  return (
    <>
      <label htmlFor="mapping-target">Mapping target</label>
      <input
        id="mapping-target"
        onChange={(event) =>
          onChange({
            mappings: [{ ...mapping, target: event.target.value }],
          })
        }
        type="text"
        value={mapping.target}
      />
      <label htmlFor="mapping-source">Mapping source</label>
      <input
        id="mapping-source"
        onChange={(event) =>
          onChange({
            mappings: [{ ...mapping, source: event.target.value }],
          })
        }
        type="text"
        value={mapping.source}
      />
    </>
  );
}

function ConditionFields({
  config,
  onChange,
}: {
  config: ConditionNodeConfig;
  onChange(config: ConditionNodeConfig): void;
}) {
  return (
    <>
      <label htmlFor="condition-left-path">Left path</label>
      <input
        id="condition-left-path"
        onChange={(event) =>
          onChange({ ...config, leftPath: event.target.value })
        }
        type="text"
        value={config.leftPath}
      />
      <label htmlFor="condition-operator">Operator</label>
      <select
        id="condition-operator"
        onChange={(event) =>
          onChange({
            ...config,
            operator: event.target.value as ConditionNodeConfig["operator"],
          })
        }
        value={config.operator}
      >
        <option value="equals">equals</option>
        <option value="not_equals">not equals</option>
        <option value="greater_than">greater than</option>
        <option value="less_than">less than</option>
        <option value="exists">exists</option>
        <option value="does_not_exist">does not exist</option>
      </select>
      <label htmlFor="condition-right-value">Right value</label>
      <input
        id="condition-right-value"
        onChange={(event) =>
          onChange({ ...config, rightValue: event.target.value })
        }
        type="text"
        value={String(config.rightValue ?? "")}
      />
    </>
  );
}

function HttpRequestFields({
  config,
  onChange,
}: {
  config: HttpRequestNodeConfig;
  onChange(config: HttpRequestNodeConfig): void;
}) {
  return (
    <>
      <label htmlFor="http-method">HTTP method</label>
      <select
        id="http-method"
        onChange={(event) =>
          onChange({
            ...config,
            method: event.target.value as HttpRequestNodeConfig["method"],
          })
        }
        value={config.method}
      >
        <option value="GET">GET</option>
        <option value="POST">POST</option>
        <option value="PUT">PUT</option>
        <option value="PATCH">PATCH</option>
        <option value="DELETE">DELETE</option>
      </select>
      <label htmlFor="http-url">URL</label>
      <input
        id="http-url"
        onChange={(event) => onChange({ ...config, url: event.target.value })}
        type="url"
        value={config.url}
      />
      <label htmlFor="http-body-mode">Body mode</label>
      <select
        id="http-body-mode"
        onChange={(event) =>
          onChange({
            ...config,
            bodyMode: event.target.value as HttpRequestNodeConfig["bodyMode"],
          })
        }
        value={config.bodyMode}
      >
        <option value="current_payload">current payload</option>
        <option value="empty">empty</option>
      </select>
    </>
  );
}

function LogFields({
  config,
  onChange,
}: {
  config: LogNodeConfig;
  onChange(config: LogNodeConfig): void;
}) {
  return (
    <>
      <label htmlFor="log-label">Log label</label>
      <input
        id="log-label"
        onChange={(event) => onChange({ label: event.target.value })}
        type="text"
        value={config.label ?? ""}
      />
    </>
  );
}
