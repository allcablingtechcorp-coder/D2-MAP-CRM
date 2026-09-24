import { describe, expect, it } from "vitest";
import { portalEmbedCompany, validPortalReply } from "./portalHandoff";

describe("Portal CRM handoff", () => {
  it("only enters bridge mode for a Portal embedded company", () => {
    expect(portalEmbedCompany("?source=d2-portal&embed=1&company=smart")).toBe("smart");
    expect(portalEmbedCompany("?source=d2-portal&embed=1&company=hvac")).toBe("hvac");
    expect(portalEmbedCompany("?source=d2-portal&company=smart")).toBeNull();
    expect(portalEmbedCompany("?source=other&embed=1&company=smart")).toBeNull();
  });
  it("rejects a forged parent response", () => {
    const reply = { type: "d2-crm-handoff-response", nonce: "abc", company: "smart", token: "secret" };
    expect(validPortalReply("https://d2-group-system.web.app", reply, "abc", "smart")).toBe(true);
    expect(validPortalReply("https://other.example", reply, "abc", "smart")).toBe(false);
    expect(validPortalReply("https://d2-group-system.web.app", reply, "other", "smart")).toBe(false);
    expect(validPortalReply("https://d2-group-system.web.app", reply, "abc", "hvac")).toBe(false);
  });
});
