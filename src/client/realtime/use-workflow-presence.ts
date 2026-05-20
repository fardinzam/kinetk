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

type TrackedState = {
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
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const lastTrackRef = useRef<number>(0);
  const channelRef = useRef<ReturnType<
    typeof browserSupabase.channel
  > | null>(null);
  // Stable per-tab ID so multiple tabs of the same user are distinguished.
  // useMemo with empty deps is stable across renders (unlike useRef.current which
  // the react-hooks/refs rule forbids during render).
  const sessionId = useMemo(() => nanoid(), []);
  const selfRef = useRef(self);
  useEffect(() => {
    selfRef.current = self;
  });

  useEffect(() => {
    const channel = browserSupabase.channel(
      `workflow-presence:${workflowId}`,
    );
    channelRef.current = channel;

    function syncPresence() {
      const state = channel.presenceState<TrackedState>();
      const users: PresenceUser[] = [];
      for (const presences of Object.values(state)) {
        for (const p of presences) {
          if (p.sessionId === sessionId) continue;
          users.push({
            userId: p.userId,
            displayName: p.displayName,
            x: p.x,
            y: p.y,
            color: colorForUser(p.userId),
          });
        }
      }
      setPresenceUsers(users);
    }

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            sessionId,
            userId: selfRef.current.userId,
            displayName: selfRef.current.displayName,
            x: 0,
            y: 0,
          });
        }
      });

    return () => {
      void channel.unsubscribe();
      channelRef.current = null;
    };
  }, [workflowId, sessionId]);

  const trackCursor = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastTrackRef.current < 33) return;
    lastTrackRef.current = now;
    void channelRef.current?.track({
      sessionId,
      userId: selfRef.current.userId,
      displayName: selfRef.current.displayName,
      x,
      y,
    });
  }, [sessionId]);

  return {
    presenceUsers,
    viewerCount: presenceUsers.length + 1,
    trackCursor,
  };
}
