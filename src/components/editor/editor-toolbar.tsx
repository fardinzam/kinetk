type EditorToolbarProps = {
  canDelete: boolean;
  zoom: number;
  onDeleteSelected(): void;
  onPan(delta: { x: number; y: number }): void;
  onZoom(zoom: number): void;
};

export function EditorToolbar({
  canDelete,
  zoom,
  onDeleteSelected,
  onPan,
  onZoom,
}: EditorToolbarProps) {
  return (
    <div aria-label="Editor toolbar" role="toolbar">
      <button onClick={() => onPan({ x: -80, y: 0 })} type="button">
        Pan left
      </button>
      <button onClick={() => onPan({ x: 80, y: 0 })} type="button">
        Pan right
      </button>
      <button onClick={() => onPan({ x: 0, y: -80 })} type="button">
        Pan up
      </button>
      <button onClick={() => onPan({ x: 0, y: 80 })} type="button">
        Pan down
      </button>
      <button onClick={() => onZoom(zoom - 0.1)} type="button">
        Zoom out
      </button>
      <button onClick={() => onZoom(zoom + 0.1)} type="button">
        Zoom in
      </button>
      <button disabled={!canDelete} onClick={onDeleteSelected} type="button">
        Delete selected
      </button>
    </div>
  );
}
