import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Firestore } from "firebase/firestore";
import type { Functions } from "firebase/functions";
import { FirestoreMembershipRepository } from "./adapters";

const stream = vi.hoisted(() => ({ next: (_snapshot: unknown) => {}, error: () => {}, stop: vi.fn() }));
vi.mock("firebase/firestore", async importOriginal => ({
  ...await importOriginal<typeof import("firebase/firestore")>(),
  doc: vi.fn(() => ({})),
  onSnapshot: vi.fn((_ref, _options, next, error) => { stream.next = next; stream.error = error; return stream.stop; }),
}));
const document = { email: "rep@example.com", displayName: "Rep", role: "sales_rep", status: "active", scope: "assigned_records", modules: ["prospecting"] };
const snapshot = (fromCache: boolean, status = "active") => ({ metadata: { fromCache }, id: "rep", exists: () => true, data: () => ({ ...document, status }) });
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("window", globalThis); stream.stop.mockClear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("server-confirmed membership observation", () => {
  const repository = new FirestoreMembershipRepository({} as Firestore, {} as Functions, "org");
  it("ignores cached snapshots without clearing an authenticated session and still delivers revocation", () => {
    const next = vi.fn(), error = vi.fn();
    const stop = repository.observeByUid("rep", next, error);
    stream.next(snapshot(true));
    expect(next).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
    stream.next(snapshot(false));
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: "active" }));
    stream.next(snapshot(true)); vi.advanceTimersByTime(30000);
    expect(error).not.toHaveBeenCalled(); expect(next).toHaveBeenCalledTimes(1);
    stream.next(snapshot(false, "revoked"));
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: "revoked" }));
    stop(); expect(stream.stop).toHaveBeenCalledOnce();
  });
  it("fails closed if the server never confirms membership and clears the initial timer on unsubscribe", () => {
    const next = vi.fn(), error = vi.fn();
    const stop = repository.observeByUid("rep", next, error);
    stream.next(snapshot(true)); vi.advanceTimersByTime(20000);
    expect(next).not.toHaveBeenCalled(); expect(error).toHaveBeenCalledOnce(); stop();
    error.mockClear(); const stopAgain = repository.observeByUid("rep", next, error);
    stopAgain(); vi.advanceTimersByTime(20000); expect(error).not.toHaveBeenCalled();
  });
  it("does not swallow a real listener permission failure", () => {
    const error = vi.fn(); const stop = repository.observeByUid("rep", vi.fn(), error);
    stream.next(snapshot(false)); stream.error();
    expect(error).toHaveBeenCalledOnce(); stop();
  });
});
