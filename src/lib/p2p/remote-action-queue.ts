import type { GameActionMessagePayload } from "./protocol";

/**
 * Stores remote game action payloads until a replicator becomes available.
 *
 * WebRTC connections can deliver actions before the local peer finished
 * initialising its replicator. This buffer guarantees that those actions are
 * replayed in a deterministic order once the replicator is ready, preventing
 * state divergence between peers.
 */
export class RemoteActionQueue {
  private readonly pending: GameActionMessagePayload[] = [];

  /**
   * Adds a payload to the queue for later processing.
   */
  enqueue(payload: GameActionMessagePayload): void {
    this.pending.push(payload);
  }

  /**
   * Processes all queued payloads in FIFO order.
   *
   * The provided {@link process} callback is invoked for each payload. If the
   * callback throws, the error handler receives the error while the queue keeps
   * draining the remaining payloads.
   */
  drain(
    process: (payload: GameActionMessagePayload) => void,
    onError: (error: unknown, payload: GameActionMessagePayload) => void,
  ): void {
    while (this.pending.length > 0) {
      const payload = this.pending.shift();
      if (!payload) {
        continue;
      }
      try {
        process(payload);
      } catch (error) {
        onError(error, payload);
      }
    }
  }

  /**
   * Returns the number of queued payloads.
   */
  get size(): number {
    return this.pending.length;
  }
}
