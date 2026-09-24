import { describe, expect, it } from "vitest";
import { portalCrmGrant } from "./portalBridge.js";
import { assertPortalLease } from "./requestProtection.js";

const owner = "dante.frota@allcablingtech.com";
const session = {
  uid: "portal-owner", email: owner, superAdmin: true, companies: ["smart", "hvac"],
  grants: {
    smart: { status: "active", modules: { crm: { actions: ["read"], scope: "company" } } },
    hvac: { status: "active", modules: { crm: { actions: ["read"], scope: "company" } } },
  },
};

describe("Portal CRM owner handoff", () => {
  it("requires the exact live owner session and selected company grant", () => {
    expect(portalCrmGrant(session, "portal-owner", owner, "smart")).toBe(true);
    expect(portalCrmGrant(session, "portal-owner", owner, "hvac")).toBe(true);
    expect(portalCrmGrant({ ...session, superAdmin: false }, "portal-owner", owner, "smart")).toBe(false);
    expect(portalCrmGrant({ ...session, uid: "other" }, "portal-owner", owner, "smart")).toBe(false);
    expect(portalCrmGrant({ ...session, grants: { ...session.grants, smart: { status: "suspended" } } }, "portal-owner", owner, "smart")).toBe(false);
    expect(portalCrmGrant(session, "portal-owner", "other@example.com", "smart")).toBe(false);
  });

  it("expires custom sessions and prevents cross-company or group calls", () => {
    const token = { firebase: { sign_in_provider: "custom" }, portal_bridge: true,
      portal_company: "smart", portal_until: Math.floor(Date.now() / 1000) + 900 };
    expect(() => assertPortalLease(token, "d2-smart-home")).not.toThrow();
    expect(() => assertPortalLease(token, "d2-hvac-solutions")).toThrow();
    expect(() => assertPortalLease(token, "d2-group")).toThrow();
    expect(() => assertPortalLease(token, "d2-group", true)).not.toThrow();
    expect(() => assertPortalLease({ ...token, portal_until: 1 }, "d2-smart-home")).toThrow();
    expect(() => assertPortalLease({ ...token, portal_bridge: undefined }, "d2-smart-home")).toThrow();
    expect(() => assertPortalLease({ ...token, firebase: { sign_in_provider: "google.com" } }, "d2-smart-home")).toThrow();
    expect(() => assertPortalLease({ firebase: { sign_in_provider: "google.com" } }, "d2-hvac-solutions")).not.toThrow();
  });
});
