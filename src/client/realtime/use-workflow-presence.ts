"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { nanoid } from "nanoid";

import { browserSupabase } from "@/client/supabase/browser";

export type PresenceUser = {
  userId: string;
  displayName: string;
  x: number;
  y: number;
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
  viewerCount: number;
  trackCursor: (x: number, y: number) => void;
} {
  // Presence: who is currently online (keyed by sessionId)
  const [onlineMap, setOnlineMap] = useState<
    Map<string, { userId: string; displayName: string }>
  >(new Map());
  // Broadcast: latest cursor positions (keyed by sessionId)
  const [cursorMap, setCursorMap] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());

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
      const map = new Map<string, { userId: string; displayName: string }>();
      for (const presences of Object.values(state)) {
        for (const p of presences) {
          if (p.sessionId === sessionId) continue;
          map.set(p.sessionId, {
            userId: p.userId,
            displayName: p.displayName,
          });
        }
      }
      setOnlineMap(map);
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
          setCursorMap((prev) =>
            new Map(prev).set(payload.sessionId, { x: payload.x, y: payload.y }),
          );
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

  // Merge: show only online users, with their latest broadcast position
  const presenceUsers = useMemo<PresenceUser[]>(() => {
    const users: PresenceUser[] = [];
    for (const [sid, user] of onlineMap) {
      const pos = cursorMap.get(sid) ?? { x: 0, y: 0 };
      users.push({
        userId: user.userId,
        displayName: user.displayName,
        x: pos.x,
        y: pos.y,
        color: colorForUser(user.userId),
      });
    }
    return users;
  }, [onlineMap, cursorMap]);

  return {
    presenceUsers,
    viewerCount: presenceUsers.length + 1,
    trackCursor,
  };
}
