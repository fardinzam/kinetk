import { useState } from "react";

import type {
  ConditionNodeConfig,
  HttpRequestNodeConfig,
  LogNodeConfig,
  SecretReference,
  TransformJsonNodeConfig,
} from "@/domain/workflows/node-configs";
import type { WorkflowNode } from "@/domain/workflows/types";

import { SecretPicker } from "./secret-picker";

type NodeConfigPanelProps = {
  node: WorkflowNode | null;
  workspaceId?: string;
  onChange(config: unknown): void;
};

export function NodeConfigPanel({
  node,
  workspaceId,
  onChange,
}: NodeConfigPanelProps) {
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
          key={node.id}
          config={node.config as TransformJsonNodeConfig}
          onChange={(config) => onChange(config)}
        />
      ) : null}
      {node.type === "condition" ? (
        <ConditionFields
          key={node.id}
          config={node.config as ConditionNodeConfig}
          onChange={onChange}
        />
      ) : null}
      {node.type === "http_request" ? (
        <HttpRequestFields
          key={node.id}
          config={node.config as HttpRequestNodeConfig}
          workspaceId={workspaceId}
          onChange={onChange}
        />
      ) : null}
      {node.type === "log" ? (
        <LogFields
          key={node.id}
          config={node.config as LogNodeConfig}
          onChange={onChange}
        />
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
  const initial = config.mappings[0] ?? { target: "", source: "" };
  const [target, setTarget] = useState(initial.target);
  const [source, setSource] = useState(initial.source);

  function persist(nextTarget: string, nextSource: string) {
    if (nextTarget.trim() && nextSource.trim()) {
      onChange({ mappings: [{ target: nextTarget, source: nextSource }] });
    }
  }

  return (
    <>
      <label htmlFor="mapping-target">Mapping target</label>
      <input
        id="mapping-target"
        onChange={(e) => {
          setTarget(e.target.value);
          persist(e.target.value, source);
        }}
        type="text"
        value={target}
      />
      <label htmlFor="mapping-source">Mapping source</label>
      <input
        id="mapping-source"
        onChange={(e) => {
          setSource(e.target.value);
          persist(target, e.target.value);
        }}
        type="text"
        value={source}
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
  const [leftPath, setLeftPath] = useState(config.leftPath);

  return (
    <>
      <label htmlFor="condition-left-path">Left path</label>
      <input
        id="condition-left-path"
        onChange={(e) => {
          setLeftPath(e.target.value);
          if (e.target.value.trim())
            onChange({ ...config, leftPath: e.target.value });
        }}
        type="text"
        value={leftPath}
      />
      <label htmlFor="condition-operator">Operator</label>
      <select
        id="condition-operator"
        onChange={(event) =>
          onChange({
            ...config,
            leftPath,
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
          onChange({ ...config, leftPath, rightValue: event.target.value })
        }
        type="text"
        value={String(config.rightValue ?? "")}
      />
    </>
  );
}

function HttpRequestFields({
  config,
  workspaceId,
  onChange,
}: {
  config: HttpRequestNodeConfig;
  workspaceId?: string;
  onChange(config: HttpRequestNodeConfig): void;
}) {
  const [draftUrl, setDraftUrl] = useState(config.url);
  // Local draft state allows rows with an empty secretId (not yet selected).
  // Only headers with both a non-empty name and secretId are passed to onChange
  // so Zod validation in updateSelectedNodeConfig never sees incomplete rows.
  const [draftHeaders, setDraftHeaders] = useState<
    Record<string, SecretReference>
  >(() => config.headers ?? {});

  const headerEntries = Object.entries(draftHeaders);

  function validHeaders(headers: Record<string, SecretReference>) {
    return Object.fromEntries(
      Object.entries(headers).filter(
        ([name, ref]) => name.trim() !== "" && ref.secretId !== "",
      ),
    );
  }

  function setHeader(name: string, ref: SecretReference) {
    const updated = { ...draftHeaders, [name]: ref };
    setDraftHeaders(updated);
    onChange({ ...config, url: draftUrl, headers: validHeaders(updated) });
  }

  function removeHeader(name: string) {
    const rest = Object.fromEntries(
      Object.entries(draftHeaders).filter(([k]) => k !== name),
    );
    setDraftHeaders(rest);
    onChange({ ...config, url: draftUrl, headers: validHeaders(rest) });
  }

  function addHeader() {
    // Only update local draft — don't call onChange since secretId is empty
    const name = `Header-${headerEntries.length + 1}`;
    setDraftHeaders((prev) => ({
      ...prev,
      [name]: { secretId: "", injectAs: "raw" },
    }));
  }

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
        onChange={(e) => {
          setDraftUrl(e.target.value);
          try {
            new URL(e.target.value);
            onChange({
              ...config,
              headers: validHeaders(draftHeaders),
              url: e.target.value,
            });
          } catch {
            // invalid URL — keep last valid config, show draft in input
          }
        }}
        type="url"
        value={draftUrl}
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
      <fieldset>
        <legend>Headers</legend>
        {headerEntries.map(([name, ref]) => (
          <div key={name}>
            <input
              aria-label="Header name"
              onChange={(e) => {
                const newName = e.target.value;
                const updated = Object.fromEntries(
                  Object.entries(draftHeaders).map(([k, v]) => [
                    k === name ? newName : k,
                    v,
                  ]),
                );
                setDraftHeaders(updated);
                onChange({
                  ...config,
                  url: draftUrl,
                  headers: validHeaders(updated),
                });
              }}
              type="text"
              value={name}
            />
            {workspaceId ? (
              <SecretPicker
                workspaceId={workspaceId}
                value={ref.secretId}
                onChange={(secretId) => setHeader(name, { ...ref, secretId })}
              />
            ) : (
              <input
                aria-label="Secret ID"
                onChange={(e) =>
                  setHeader(name, { ...ref, secretId: e.target.value })
                }
                placeholder="secret ID"
                type="text"
                value={ref.secretId}
              />
            )}
            <select
              aria-label="Inject as"
              onChange={(e) =>
                setHeader(name, {
                  ...ref,
                  injectAs: e.target.value as SecretReference["injectAs"],
                })
              }
              value={ref.injectAs}
            >
              <option value="raw">raw</option>
              <option value="Bearer">Bearer</option>
              <option value="Basic">Basic</option>
            </select>
            <button onClick={() => removeHeader(name)} type="button">
              Remove
            </button>
          </div>
        ))}
        <button onClick={addHeader} type="button">
          Add header
        </button>
      </fieldset>
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
  const [label, setLabel] = useState(config.label ?? "");

  return (
    <>
      <label htmlFor="log-label">Log label</label>
      <input
        id="log-label"
        onChange={(e) => {
          setLabel(e.target.value);
          // Empty string maps to undefined (label is optional but min(1) if present)
          onChange({ label: e.target.value.trim() || undefined });
        }}
        type="text"
        value={label}
      />
    </>
  );
}
