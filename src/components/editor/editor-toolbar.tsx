type EditorToolbarProps = {
  canDelete: boolean;
  canRedo: boolean;
  canUndo: boolean;
  zoom: number;
  onDeleteSelected(): void;
  onPan(delta: { x: number; y: number }): void;
  onRedo(): void;
  onUndo(): void;
  onZoom(zoom: number): void;
};

export function EditorToolbar({
  canDelete,
  canRedo,
  canUndo,
  zoom,
  onDeleteSelected,
  onPan,
  onRedo,
  onUndo,
  onZoom,
}: EditorToolbarProps) {
  return (
    <div aria-label="Editor toolbar" role="toolbar">
      <button disabled={!canUndo} onClick={onUndo} type="button">
        Undo
      </button>
      <button disabled={!canRedo} onClick={onRedo} type="button">
        Redo
      </button>
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
