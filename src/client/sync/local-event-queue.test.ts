import { describe, expect, it } from "vitest";

import type { WorkflowEvent } from "@/domain/workflows/events";

import {
  createLocalEventQueue,
  type EventQueueStorage,
} from "./local-event-queue";

const createdAt = "2026-05-15T00:00:00.000Z";

function makeEvent(clientEventId: string): WorkflowEvent {
  return {
    clientEventId,
    type: "node_deleted",
    eventSchemaVersion: 1,
    payload: { nodeId: "node_1" },
    createdAt,
  };
}

function makeMemoryStorage(): EventQueueStorage {
  const store = new Map<string, WorkflowEvent[]>();

  return {
    async add(workflowId, event) {
      const events = store.get(workflowId) ?? [];
      store.set(workflowId, [...events, event]);
    },
    async getAll(workflowId) {
      return store.get(workflowId) ?? [];
    },
    async remove(workflowId, clientEventId) {
      const events = store.get(workflowId) ?? [];
      store.set(
        workflowId,
        events.filter((e) => e.clientEventId !== clientEventId),
      );
    },
  };
}

describe("createLocalEventQueue", () => {
  it("enqueue adds the event to storage", async () => {
    const storage = makeMemoryStorage();
    const queue = createLocalEventQueue("wf_1", storage);
    const event = makeEvent("evt_1");

    await queue.enqueue(event);

    expect(await queue.getPendingEvents()).toEqual([event]);
  });

  it("getPendingEvents returns events in insertion order", async () => {
    const storage = makeMemoryStorage();
    const queue = createLocalEventQueue("wf_1", storage);
    const evtA = makeEvent("evt_a");
    const evtB = makeEvent("evt_b");
    const evtC = makeEvent("evt_c");

    await queue.enqueue(evtA);
    await queue.enqueue(evtB);
    await queue.enqueue(evtC);

    expect(await queue.getPendingEvents()).toEqual([evtA, evtB, evtC]);
  });

  it("markCommitted removes the matched event and preserves others", async () => {
    const storage = makeMemoryStorage();
    const queue = createLocalEventQueue("wf_1", storage);
    const evtA = makeEvent("evt_a");
    const evtB = makeEvent("evt_b");

    await queue.enqueue(evtA);
    await queue.enqueue(evtB);
    await queue.markCommitted("evt_a");

    expect(await queue.getPendingEvents()).toEqual([evtB]);
  });

  it("queues for different workflowIds are isolated", async () => {
    const storage = makeMemoryStorage();
    const queueA = createLocalEventQueue("wf_a", storage);
    const queueB = createLocalEventQueue("wf_b", storage);

    await queueA.enqueue(makeEvent("evt_1"));
    await queueB.enqueue(makeEvent("evt_2"));

    expect(await queueA.getPendingEvents()).toHaveLength(1);
    expect(await queueB.getPendingEvents()).toHaveLength(1);
    expect((await queueA.getPendingEvents())[0].clientEventId).toBe("evt_1");
    expect((await queueB.getPendingEvents())[0].clientEventId).toBe("evt_2");
  });

  it("getPendingEvents returns empty array when nothing enqueued", async () => {
    const storage = makeMemoryStorage();
    const queue = createLocalEventQueue("wf_1", storage);

    expect(await queue.getPendingEvents()).toEqual([]);
  });
});
