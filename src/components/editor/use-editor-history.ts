"use client";

import { useState } from "react";

import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from "@/domain/workflows/history";
import type { WorkflowGraph } from "@/domain/workflows/types";

import { createEditorState } from "./editor-state";
import type { EditorState } from "./editor-state";

type Combined = {
  editorState: EditorState;
  history: ReturnType<typeof createHistory>;
};

export function useEditorHistory(initialGraph: WorkflowGraph) {
  const [combined, setCombined] = useState<Combined>(() => ({
    editorState: createEditorState(initialGraph),
    history: createHistory(),
  }));

  function applyState(updater: (s: EditorState) => EditorState) {
    setCombined((prev) => ({ ...prev, editorState: updater(prev.editorState) }));
  }

  function applyGraphChange(updater: (s: EditorState) => EditorState) {
    setCombined((prev) => ({
      history: pushHistory(prev.history, prev.editorState.graph),
      editorState: updater(prev.editorState),
    }));
  }

  function snapshotGraph() {
    setCombined((prev) => ({
      ...prev,
      history: pushHistory(prev.history, prev.editorState.graph),
    }));
  }

  function undo() {
    setCombined((prev) => {
      const result = undoHistory(prev.history, prev.editorState.graph);
      if (!result) return prev;
      return {
        history: result.history,
        editorState: { ...prev.editorState, graph: result.graph },
      };
    });
  }

  function redo() {
    setCombined((prev) => {
      const result = redoHistory(prev.history, prev.editorState.graph);
      if (!result) return prev;
      return {
        history: result.history,
        editorState: { ...prev.editorState, graph: result.graph },
      };
    });
  }

  return {
    state: combined.editorState,
    applyState,
    applyGraphChange,
    snapshotGraph,
    undo,
    redo,
    canUndo: canUndo(combined.history),
    canRedo: canRedo(combined.history),
  };
}
