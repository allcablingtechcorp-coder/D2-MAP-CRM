import {beforeAll,beforeEach,describe,it,expect,vi} from "vitest";
import {getFirestore,Timestamp} from "firebase-admin/firestore";
import type {CallableRequest} from "firebase-functions/v2/https";
import {sendAccessEmail} from "./emailDelivery.js";
vi.mock("./emailDelivery.js",()=>({sendAccessEmail:vi.fn().mockResolvedValue(undefined)}));
const enabled=!!process.env.FIRESTORE_EMULATOR_HOST&&process.env.GCLOUD_PROJECT==="demo-d2-map-crm";
describe.skipIf(!enabled)("email invitation lifecycle",()=>{
 let api:typeof import("./index.js");const root=()=>getFirestore().doc("organizations/d2-group");
 const q=(uid:string,data:object,token:object={})=>({data,auth:{uid,token:{email:uid+"@example.test",email_verified:true,firebase:{sign_in_provider:"password"},...token}},rawRequest:{ip:"127.0.0.1"}}) as CallableRequest;
 const invite=(email="invited@example.test")=>({organizationId:"d2-group",email,role:"operations_admin",scope:"organization",modules:["admin","leads","reports"],teamIds:[],companyIds:["d2-hvac-solutions"]});
 const create=()=>api.createGovernanceInvitation.run(q("mail-owner",invite()));
 beforeAll(async()=>{api=await import("./index.js");});
 beforeEach(async()=>{
  vi.mocked(sendAccessEmail).mockReset().mockResolvedValue(undefined);
  await getFirestore().recursiveDelete(root());
  await getFirestore().recursiveDelete(getFirestore().doc("organizations/d2-hvac-solutions"));
  await getFirestore().recursiveDelete(getFirestore().collection("emailRequestLimits"));
  await root().set({name:"D2 Group"});
  await root().collection("memberships").doc("mail-owner").set({email:"mail-owner@example.test",displayName:"Owner",role:"owner",status:"active",scope:"organization",modules:["admin"],companyIds:["d2-hvac-solutions"]});
  await root().collection("memberships").doc("mail-admin").set({email:"mail-admin@example.test",displayName:"Admin",role:"operations_admin",status:"active",scope:"organization",modules:["admin"],companyIds:["d2-hvac-solutions"]});
 });
 it("automatically sends an access email and accepts a verified non-Google identity only for invited companies",async()=>{
  const result=await create();expect(result.invitation.deliveryStatus).toBe("provider_accepted");expect(sendAccessEmail).toHaveBeenCalledWith("invited@example.test","en");
  await expect(api.acceptGovernanceInvitation.run(q("invited",{organizationId:"d2-group"},{email_verified:false}))).rejects.toMatchObject({code:"failed-precondition"});
  expect(await api.acceptGovernanceInvitation.run(q("invited",{organizationId:"d2-group"}))).toEqual({accepted:true});
  expect((await root().collection("memberships").doc("invited").get()).data()?.companyIds).toEqual(["d2-hvac-solutions"]);
  expect((await getFirestore().doc("organizations/d2-smart-home/memberships/invited").get()).exists).toBe(false);
 });
 it("does not invent a delivery date for legacy invitations that were never emailed",async()=>{
  await root().collection("invitations").doc("legacy-unsent").set({...invite(),status:"pending",createdAt:Timestamp.now(),expiresAt:Timestamp.fromMillis(Date.now()+86400000),invitedByUid:"mail-owner"});
  const directory=await api.listGovernanceDirectory.run(q("mail-owner",{organizationId:"d2-group"}));
  expect(directory.invitations[0]?.deliveryStatus).toBe("not_sent");
  expect(directory.invitations[0]?.deliveryAt).toBe("");
 });
 it("retains a failed email as failed, allows a later resend and prevents concurrent duplicate sends",async()=>{
  vi.mocked(sendAccessEmail).mockRejectedValueOnce(Error("Provider unavailable"));
  const result=await create();expect(result.invitation.deliveryStatus).toBe("failed");
  const id=result.invitation.id, ref=root().collection("invitations").doc(id);
  await expect(api.manageInvitation.run(q("mail-owner",{action:"resend",invitationId:id}))).rejects.toMatchObject({code:"resource-exhausted"});
  await ref.update({"delivery.attemptedAt":Timestamp.fromMillis(1)});
  const attempts=await Promise.allSettled([1,2].map(()=>api.manageInvitation.run(q("mail-owner",{action:"resend",invitationId:id}))));
  expect(attempts.filter(x=>x.status==="fulfilled")).toHaveLength(1);expect((await ref.get()).data()?.delivery.status).toBe("provider_accepted");
 });
 it("removes and invalidates invitations while keeping an audit, without allowing another admin to delete",async()=>{
  const {invitation}=await create();
  await expect(api.manageInvitation.run(q("mail-admin",{action:"delete",invitationId:invitation.id}))).rejects.toMatchObject({code:"permission-denied"});
  await api.manageInvitation.run(q("mail-owner",{action:"delete",invitationId:invitation.id}));
  expect((await api.listGovernanceDirectory.run(q("mail-owner",{organizationId:"d2-group"}))).invitations).toHaveLength(0);
  expect(await api.acceptGovernanceInvitation.run(q("invited",{organizationId:"d2-group"}))).toEqual({accepted:false});
  expect((await root().collection("auditEvents").where("action","==","invitation.delete").get()).size).toBe(1);
 });
 it("renews with explicit companies and rejects renewal of accepted or removed invitations",async()=>{
  const {invitation}=await create(),ref=root().collection("invitations").doc(invitation.id);
  await ref.update({expiresAt:Timestamp.fromMillis(1),"delivery.attemptedAt":Timestamp.fromMillis(1)});
  const patch={role:"operations_admin",scope:"organization",modules:["admin","leads"],companyIds:["d2-hvac-solutions"]};
  await api.manageInvitation.run(q("mail-owner",{action:"renew",invitationId:invitation.id,patch}));
  expect((await ref.get()).data()?.expiresAt.toMillis()).toBeGreaterThan(Date.now()+6*86400000);
  await api.acceptGovernanceInvitation.run(q("invited",{organizationId:"d2-group"}));
  await expect(api.manageInvitation.run(q("mail-owner",{action:"renew",invitationId:invitation.id,patch}))).rejects.toMatchObject({code:"failed-precondition"});
  await api.manageInvitation.run(q("mail-owner",{action:"delete",invitationId:invitation.id}));
  expect((await root().collection("memberships").doc("invited").get()).data()?.status).toBe("active");
 });
 it("only sends self-service links to authorized addresses and limits repeated requests",async()=>{
  await create();vi.mocked(sendAccessEmail).mockClear();
  const unauth=(email:string)=>({data:{email,locale:"pt"},rawRequest:{ip:"127.0.0.2"}}) as CallableRequest;
  expect(await api.requestEmailAccess.run(unauth("unknown@example.test"))).toEqual({requested:true});expect(sendAccessEmail).not.toHaveBeenCalled();
  await api.requestEmailAccess.run(unauth("invited@example.test"));expect(sendAccessEmail).toHaveBeenCalledWith("invited@example.test","pt");
  for(let i=0;i<4;i++)await api.requestEmailAccess.run(unauth("invited@example.test"));
  await expect(api.requestEmailAccess.run(unauth("invited@example.test"))).rejects.toMatchObject({code:"resource-exhausted"});
 });
});
