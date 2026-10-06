import { describe, expect, it } from "vitest";
import { leonardoCrmMembershipReady, portalCrmGrant, ownerPortalReady } from "./portalBridge.js";
import { assertPortalLease } from "./requestProtection.js";
import {parseMembershipDocument} from "./membershipPolicy.js";

const owner = "dante.frota@allcablingtech.com";
const session = {
  uid: "portal-owner", email: owner, superAdmin: true, companies: ["smart", "hvac"],
  grants: {
    smart: { status: "active", modules: { crm: { actions: ["read"], scope: "company" } } },
    hvac: { status: "active", modules: { crm: { actions: ["read"], scope: "company" } } },
  },
};

describe("Portal CRM owner handoff", () => {
  it("issues full administration only for a protected source owner and two full live Portal grants",()=>{
    const member=parseMembershipDocument({email:"allcablingtechcorp@gmail.com",displayName:"Owner",role:"owner",status:"active",scope:"organization",modules:["dashboard","leads","pipeline","activities","prospecting","companies","reports","admin"],ownerProtected:true});
    const grant={status:"active",modules:{crm:{scope:"company",actions:["read","create","edit","assign","export"]}}};
    const full={...session,grants:{smart:grant,hvac:grant}};
    const members={"d2-smart-home":member,"d2-hvac-solutions":member},ids=Object.keys(members);
    const ready=(group=member,portal:unknown=full,records=members,companies:unknown=ids)=>ownerPortalReady(portal,"portal-owner",owner,group,companies,records);
    expect(ready()).toBe(true);
    expect(ready({...member,ownerProtected:false})).toBe(false);
    expect(ready({...member,status:"suspended"})).toBe(false);
    expect(ready({...member,role:"sales_manager"})).toBe(false);
    expect(ready(member,session)).toBe(false);
    expect(ready(member,{...full,superAdmin:false})).toBe(false);
    expect(ready(member,full,members,["d2-smart-home"])).toBe(false);
    expect(ready(member,full,{...members,"d2-hvac-solutions":{...member,status:"revoked"}})).toBe(false);
  });
  it("owner leases allow existing company and group operations but report leases remain read-only",()=>{
    const token={firebase:{sign_in_provider:"custom"},portal_bridge:true,portal_owner:true,portal_company:"smart",portal_until:Math.floor(Date.now()/1000)+300};
    for(const org of ["d2-group","d2-smart-home","d2-hvac-solutions"])expect(()=>assertPortalLease(token,org)).not.toThrow();
    expect(()=>assertPortalLease(token,"other")).toThrow();
    expect(()=>assertPortalLease({...token,portal_until:1},"d2-group")).toThrow();
    expect(()=>assertPortalLease({...token,portal_report_all:true},"d2-smart-home")).toThrow();
  });
  it("allows consolidated reads but rejects business mutations even in the base company", () => {
    const token={firebase:{sign_in_provider:"custom"},portal_bridge:true,portal_company:"smart",portal_until:Math.floor(Date.now()/1000)+300,portal_report_all:true};
    for(const org of ["d2-smart-home","d2-hvac-solutions"]){
      expect(()=>assertPortalLease(token,org,false,true)).not.toThrow();
      expect(()=>assertPortalLease(token,org)).toThrow();
    }
    expect(()=>assertPortalLease(token,"d2-group",true,true)).not.toThrow();
    expect(()=>assertPortalLease(token,"other",true,true)).toThrow();
    expect(()=>assertPortalLease({...token,portal_until:1},"d2-hvac-solutions",false,true)).toThrow();
  });
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
