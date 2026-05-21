type ConnectionHandlesProps = {
  nodeId: string;
  nodeType: string;
  isConnectingFrom: boolean;
  onConnectFrom(nodeId: string, sourceHandle?: string): void;
  onConnectTo(nodeId: string): void;
};

export function ConnectionHandles({
  nodeId,
  nodeType,
  isConnectingFrom,
  onConnectFrom,
  onConnectTo,
}: ConnectionHandlesProps) {
  return (
    <span
      style={{
        display: "flex",
        gap: 8,
        marginTop: 10,
      }}
    >
      {nodeType === "condition" ? (
        <>
          <button
            aria-pressed={isConnectingFrom}
            onClick={(event) => {
              event.stopPropagation();
              onConnectFrom(nodeId, "true");
            }}
            type="button"
          >
            Connect true from {nodeId}
          </button>
          <button
            aria-pressed={isConnectingFrom}
            onClick={(event) => {
              event.stopPropagation();
              onConnectFrom(nodeId, "false");
            }}
            type="button"
          >
            Connect false from {nodeId}
          </button>
        </>
      ) : (
        <button
          aria-pressed={isConnectingFrom}
          onClick={(event) => {
            event.stopPropagation();
            onConnectFrom(nodeId);
          }}
          type="button"
        >
          Connect from {nodeId}
        </button>
      )}
      <button
        onClick={(event) => {
          event.stopPropagation();
          onConnectTo(nodeId);
        }}
        type="button"
      >
        Connect to {nodeId}
      </button>
    </span>
  );
}
