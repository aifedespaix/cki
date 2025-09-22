import { describe, expect, it } from "bun:test";

import { PeerRole } from "./peer";
import type { GameActionMessagePayload } from "./protocol";
import { RemoteActionQueue } from "./remote-action-queue";

const createPayload = (suffix: string): GameActionMessagePayload => ({
  actionId: `action-${suffix}`,
  action: { type: "game/reset" },
  issuerPeerId: `peer-${suffix}`,
  issuerRole: PeerRole.Host,
  acknowledgedByHost: true,
});

describe("RemoteActionQueue", () => {
  it("drains queued payloads in first-in first-out order", () => {
    const queue = new RemoteActionQueue();
    const first = createPayload("1");
    const second = createPayload("2");
    const third = createPayload("3");

    queue.enqueue(first);
    queue.enqueue(second);
    queue.enqueue(third);

    const processed: GameActionMessagePayload[] = [];
    queue.drain(
      (payload) => {
        processed.push(payload);
      },
      () => {
        throw new Error("Unexpected error during drain");
      },
    );

    expect(processed).toEqual([first, second, third]);
    expect(queue.size).toBe(0);
  });

  it("invokes the error handler when processing fails and continues draining", () => {
    const queue = new RemoteActionQueue();
    const first = createPayload("1");
    const second = createPayload("2");

    queue.enqueue(first);
    queue.enqueue(second);

    const processedIds: string[] = [];
    const handledErrors: unknown[] = [];

    queue.drain(
      (payload) => {
        processedIds.push(payload.actionId);
        if (payload === first) {
          throw new Error("processing failure");
        }
      },
      (error, payload) => {
        handledErrors.push({ error, payload });
      },
    );

    expect(processedIds).toEqual([first.actionId, second.actionId]);
    expect(handledErrors).toHaveLength(1);
    expect(
      (handledErrors[0] as { payload: GameActionMessagePayload }).payload,
    ).toBe(first);
    expect(queue.size).toBe(0);
  });
});
