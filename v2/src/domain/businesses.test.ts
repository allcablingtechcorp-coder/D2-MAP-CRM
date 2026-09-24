import { describe, expect, it } from "vitest";
import { authorizedBusinesses, businessQueryValue, preferredBusinessId } from "./businesses";

describe("Portal company links", () => {
  it("opens the selected business and keeps a later in-app choice", () => {
    expect(preferredBusinessId("?company=smart", "d2-hvac-solutions")).toBe("d2-smart-home");
    expect(preferredBusinessId("?company=hvac", "d2-smart-home")).toBe("d2-hvac-solutions");
    expect(businessQueryValue("d2-smart-home")).toBe("smart");
    expect(businessQueryValue("d2-hvac-solutions")).toBe("hvac");
  });

  it("ignores unknown company links and leaves authorization to the membership", () => {
    expect(preferredBusinessId("?company=other", "d2-hvac-solutions")).toBe("d2-hvac-solutions");
    expect(authorizedBusinesses(["d2-hvac-solutions"]).find(b => b.id === preferredBusinessId("?company=smart", null))).toBeUndefined();
  });
});
