import { describe, expect, it } from "vitest";
import { leonardoCrmMembershipReady, portalCrmGrant } from "./portalBridge.js";
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

describe("Leonardo Smart Home CRM handoff", () => {
  const email = "leonardo.dantas@allcablingtech.com";
  const manager = {uid:"leonardo-portal",email,emailVerified:true,superAdmin:false,companies:["smart"],grants:{
    smart:{role:"manager",status:"active",modules:{crm:{scope:"company",actions:["read","create","edit","assign"]}}},
  }};
  it("accepts only the verified Smart manager with full commercial grant", () => {
    expect(portalCrmGrant(manager, manager.uid, email, "smart")).toBe(true);
    expect(portalCrmGrant(manager, manager.uid, email, "hvac")).toBe(false);
    expect(portalCrmGrant({...manager,emailVerified:false}, manager.uid, email, "smart")).toBe(false);
    expect(portalCrmGrant({...manager,uid:"other"}, manager.uid, email, "smart")).toBe(false);
    expect(portalCrmGrant({...manager,grants:{smart:{...manager.grants.smart,modules:{crm:{scope:"company",actions:["read"]}}}}},manager.uid,email,"smart")).toBe(false);
    expect(portalCrmGrant({...manager,email:"someone@example.com"},manager.uid,"someone@example.com","smart")).toBe(false);
  });
  it("requires active Smart-only commercial memberships without administration", () => {
    const membership={email:"leonardoagiani@gmail.com",displayName:"Leonardo",role:"sales_manager" as const,status:"active" as const,scope:"organization" as const,modules:["dashboard","leads","pipeline","activities","prospecting","companies","reports"] as const};
    const group={...membership,modules:[...membership.modules]};
    const company={...membership,modules:[...membership.modules]};
    expect(leonardoCrmMembershipReady(group,company,["d2-smart-home"])).toBe(true);
    expect(leonardoCrmMembershipReady(group,company,["d2-smart-home","d2-hvac-solutions"])).toBe(false);
    expect(leonardoCrmMembershipReady(group,{...company,status:"suspended"},["d2-smart-home"])).toBe(false);
    expect(leonardoCrmMembershipReady(group,{...company,modules:["dashboard"]},["d2-smart-home"])).toBe(false);
    expect(leonardoCrmMembershipReady(group,{...company,ownerProtected:true},["d2-smart-home"])).toBe(false);
  });
});
