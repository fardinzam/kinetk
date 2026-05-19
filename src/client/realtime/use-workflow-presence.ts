"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { browserSupabase } from "@/client/supabase/browser";

export type PresenceUser = {
  userId: string;
  displayName: string;
  x: number;
  y: number;
  color: string;
};

type TrackedState = {
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
          if (p.userId === selfRef.current.userId) continue;
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
  }, [workflowId]);

  const trackCursor = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastTrackRef.current < 33) return;
    lastTrackRef.current = now;
    void channelRef.current?.track({
      userId: selfRef.current.userId,
      displayName: selfRef.current.displayName,
      x,
      y,
    });
  }, []);

  return {
    presenceUsers,
    viewerCount: presenceUsers.length + 1,
    trackCursor,
  };
}
