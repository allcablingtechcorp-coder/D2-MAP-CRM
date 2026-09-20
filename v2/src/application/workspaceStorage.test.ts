import { describe, it, expect } from "vitest";
import { workspaceStorageKey } from "./workspaceStorage";
describe("temporary commercial storage isolation", () => {
  it("never reuses an anonymous workspace or another account or organization", () => {
    const keys = [workspaceStorageKey(), workspaceStorageKey({ organizationId: "one", uid: "alice" }), workspaceStorageKey({ organizationId: "one", uid: "bob" }), workspaceStorageKey({ organizationId: "two", uid: "alice" })];
    expect(new Set(keys).size).toBe(4);
  });
  it("avoids collisions between encoded identifiers", () => {
    expect(workspaceStorageKey({ organizationId: "a:b", uid: "c" })).not.toBe(workspaceStorageKey({ organizationId: "a", uid: "b:c" }));
  });
});
