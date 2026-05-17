type JsonViewerProps = {
  label: string;
  data: unknown;
};

export function JsonViewer({ label, data }: JsonViewerProps) {
  if (data === null || data === undefined) return null;

  return (
    <details>
      <summary>{label}</summary>
      <pre
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 4,
          fontSize: 12,
          maxHeight: 240,
          overflowY: "auto",
          padding: 8,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}
