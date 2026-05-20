"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { nanoid } from "nanoid";

import { browserSupabase } from "@/client/supabase/browser";

export type PresenceUser = {
  sessionId: string;
  userId: string;
  displayName: string;
  color: string;
};

// Only join/leave identity — no position
type TrackedState = {
  sessionId: string;
  userId: string;
  displayName: string;
};

type CursorPayload = {
  sessionId: string;
  userId: string;
  displayName: string;
  x: number;
  y: number;
};

const COLORS = [
  "#e74c3c",
  "#e67e22",
  "#f1c40f",
  "#2ecc71",
  "#1abc9c",
  "#3498db",
  "#9b59b6",
  "#e91e63",
];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

export function useWorkflowPresence(
  workflowId: string,
  self: { userId: string; displayName: string },
): {
  presenceUsers: PresenceUser[];
  cursorPositionsRef: React.RefObject<Map<string, { x: number; y: number }>>;
  viewerCount: number;
  trackCursor: (x: number, y: number) => void;
} {
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);

  // Mutable ref for cursor positions — updated on every broadcast without
  // triggering a React re-render. The canvas RAF loop reads from this directly.
  const cursorPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );

  const lastBroadcastRef = useRef<number>(0);
  const lastSentPosRef = useRef<{ x: number; y: number }>({
    x: -Infinity,
    y: -Infinity,
  });
  const channelRef = useRef<ReturnType<typeof browserSupabase.channel> | null>(
    null,
  );
  const sessionId = useMemo(() => nanoid(), []);
  const selfRef = useRef(self);
  useEffect(() => {
    selfRef.current = self;
  });

  useEffect(() => {
    const channel = browserSupabase.channel(`workflow-presence:${workflowId}`);
    channelRef.current = channel;

    function syncPresence() {
      const state = channel.presenceState<TrackedState>();
      const users: PresenceUser[] = [];
      const activeSessionIds = new Set<string>();

      for (const presences of Object.values(state)) {
        for (const p of presences) {
          if (p.sessionId === sessionId) continue;
          activeSessionIds.add(p.sessionId);
          users.push({
            sessionId: p.sessionId,
            userId: p.userId,
            displayName: p.displayName,
            color: colorForUser(p.userId),
          });
        }
      }

      // Prune stale cursor positions for users who have left
      for (const sid of cursorPositionsRef.current.keys()) {
        if (!activeSessionIds.has(sid)) cursorPositionsRef.current.delete(sid);
      }

      setPresenceUsers(users);
    }

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .on(
        "broadcast",
        { event: "cursor" },
        ({ payload }: { payload: CursorPayload }) => {
          if (payload.sessionId === sessionId) return;
          // Write directly to the ref — no setState, no re-render
          cursorPositionsRef.current.set(payload.sessionId, {
            x: payload.x,
            y: payload.y,
          });
        },
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            sessionId,
            userId: selfRef.current.userId,
            displayName: selfRef.current.displayName,
          });
        }
      });

    return () => {
      void channel.unsubscribe();
      channelRef.current = null;
    };
  }, [workflowId, sessionId]);

  const trackCursor = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      if (now - lastBroadcastRef.current < 50) return; // 20fps cap
      const rx = Math.round(x);
      const ry = Math.round(y);
      const dx = rx - lastSentPosRef.current.x;
      const dy = ry - lastSentPosRef.current.y;
      if (dx * dx + dy * dy < 16) return; // skip moves < 4px
      lastBroadcastRef.current = now;
      lastSentPosRef.current = { x: rx, y: ry };
      void channelRef.current?.send({
        type: "broadcast",
        event: "cursor",
        payload: {
          sessionId,
          userId: selfRef.current.userId,
          displayName: selfRef.current.displayName,
          x: rx,
          y: ry,
        },
      });
    },
    [sessionId],
  );

  return {
    presenceUsers,
    cursorPositionsRef,
    viewerCount: presenceUsers.length + 1,
    trackCursor,
  };
}
