import {beforeAll,beforeEach,describe,it,expect,vi} from "vitest";
import {getFirestore} from "firebase-admin/firestore";
import type {CallableRequest} from "firebase-functions/v2/https";
vi.mock("./emailDelivery.js",async importOriginal=>({...await importOriginal<typeof import("./emailDelivery.js")>(),sendAccessEmail:vi.fn().mockResolvedValue(undefined)}));
const enabled=!!process.env.FIRESTORE_EMULATOR_HOST&&process.env.GCLOUD_PROJECT==="demo-d2-map-crm";
describe.skipIf(!enabled)("company isolation in the Firestore emulator",()=>{
 let api:typeof import("./index.js");
 const group="d2-group",smart="d2-smart-home",hvac="d2-hvac-solutions";
 const modules=["dashboard","leads","pipeline","activities","prospecting","companies","reports","admin"];
 const member=(uid:string,role="sales_rep")=>({email:`${uid}@example.test`,displayName:uid,role,status:"active",scope:"organization",modules,teamIds:[]});
 const ref=(org:string)=>getFirestore().doc(`organizations/${org}`);
 const q=(uid:string,org:string,data:object={},token:object={})=>({data:{organizationId:org,...data},auth:{uid,token:{email:`${uid}@example.test`,email_verified:true,auth_time:123456,firebase:{sign_in_provider:"google.com"},...token}}}) as CallableRequest;
 const access=(uid:string,data:object)=>({...q(uid,group),data}) as CallableRequest;
 beforeAll(async()=>{api=await import("./index.js");});
 beforeEach(async()=>{
  for(const org of [group,smart,hvac]){await getFirestore().recursiveDelete(ref(org));await ref(org).set({name:org});}
  for(const [uid,role,ids] of [["company-owner","owner",[smart,hvac]],["smart-admin","operations_admin",[smart]],["both-rep","sales_rep",[smart,hvac]]] as const){
   await ref(group).collection("memberships").doc(uid).set({...member(uid,role),companyIds:ids});
   for(const org of ids)await ref(org).collection("memberships").doc(uid).set(member(uid,role));
  }
 });
 it("isolates identical customer IDs and refuses cross-company reads, writes, history and assignments",async()=>{
  for(const org of [smart,hvac])await ref(org).collection("companies").doc("same").set({name:org,ownerUid:"both-rep",teamId:null});
  expect((await api.loadCommercialPage.run(q("smart-admin",smart,{collection:"companies"}))).records[0]?.name).toBe(smart);
  for(const call of [()=>api.loadCommercialPage.run(q("smart-admin",hvac,{collection:"companies"})),()=>api.createCommercialCompany.run(q("smart-admin",hvac,{name:"Attempt",location:"FL",industry:"",website:"",phone:""})),()=>api.commercialRecordHistory.run(q("smart-admin",hvac,{collection:"companies",recordId:"same"})),()=>api.listAssignmentOptions.run(q("smart-admin",hvac))])await expect(call()).rejects.toMatchObject({code:"permission-denied"});
  expect((await api.loadCommercialPage.run(q("both-rep",hvac,{collection:"companies"}))).records[0]?.name).toBe(hvac);
 });
 it("does not trust a stale company membership after the group grant is removed",async()=>{
  await ref(hvac).collection("memberships").doc("smart-admin").set(member("smart-admin","operations_admin"));
  await expect(api.loadCommercialPage.run(q("smart-admin",hvac,{collection:"leads"}))).rejects.toMatchObject({code:"permission-denied"});
  await ref(group).collection("memberships").doc("both-rep").update({status:"suspended"});
  await expect(api.loadCommercialPage.run(q("both-rep",smart,{collection:"leads"}))).rejects.toMatchObject({code:"permission-denied"});
 });
 it("allows only the group owner to change grants and preserves company-specific roles",async()=>{
  const grant={action:"save",targetUid:"both-rep",companyIds:[smart],reason:"Separate assignments"};
  await expect(api.companyAccess.run(access("smart-admin",grant))).rejects.toMatchObject({code:"permission-denied"});
  await ref(smart).collection("memberships").doc("both-rep").update({role:"operations_admin"});
  await api.companyAccess.run(access("company-owner",grant));
  expect((await ref(smart).collection("memberships").doc("both-rep").get()).data()?.role).toBe("operations_admin");
  expect((await ref(hvac).collection("memberships").doc("both-rep").get()).data()?.status).toBe("revoked");
  await expect(api.loadCommercialPage.run(q("both-rep",hvac,{collection:"leads"}))).rejects.toMatchObject({code:"permission-denied"});
  await api.companyAccess.run(access("company-owner",{...grant,companyIds:[smart,hvac]}));
  expect((await ref(hvac).collection("memberships").doc("both-rep").get()).data()?.role).toBe("sales_rep");
  await expect(api.companyAccess.run(access("company-owner",{...grant,targetUid:"company-owner",companyIds:[]}))).rejects.toMatchObject({code:"failed-precondition"});
  await api.companyAccess.run(access("company-owner",{...grant,targetUid:"smart-admin",companyIds:[smart,hvac]}));
  expect((await ref(hvac).collection("memberships").doc("smart-admin").get()).data()?.role).toBe("operations_admin");
  await expect(api.loadCommercialPage.run(q("smart-admin",hvac,{collection:"leads"}))).resolves.toBeDefined();
 });
 it("accepts a verified invitation for exactly its selected companies atomically",async()=>{
  const invitation={email:"company-new@example.test",role:"operations_admin",scope:"organization",modules,teamIds:[],companyIds:[smart,hvac]};
  await expect(api.createGovernanceInvitation.run(q("smart-admin",group,invitation))).rejects.toMatchObject({code:"permission-denied"});
  await api.createGovernanceInvitation.run(q("company-owner",group,invitation));
  await expect(api.acceptGovernanceInvitation.run(q("company-new",group,{}, {email_verified:false}))).rejects.toMatchObject({code:"failed-precondition"});
  expect(await api.acceptGovernanceInvitation.run(q("company-new",group))).toEqual({accepted:true});
  for(const org of [group,smart,hvac])expect((await ref(org).collection("memberships").doc("company-new").get()).data()?.role).toBe("operations_admin");
  expect((await ref(group).collection("memberships").doc("company-new").get()).data()?.companyIds).toEqual([smart,hvac]);
  await api.companyAccess.run(access("company-owner",{action:"save",targetUid:"company-new",companyIds:[],reason:"Remove company access"}));
  await api.acceptGovernanceInvitation.run(q("company-new",group));
  await expect(api.loadCommercialPage.run(q("company-new",smart,{collection:"leads"}))).rejects.toMatchObject({code:"permission-denied"});
 });
 it("keeps Google places, visits and retry IDs independent for each company",async()=>{
  const visit={requestId:"same-request",action:"complete",placeId:"same-google-place",name:"Customer",location:"Boca",position:{lat:26,lng:-80},at:new Date().toISOString(),note:"Visit"};
  await api.saveProspectingVisit.run(q("both-rep",smart,visit));
  await api.saveProspectingVisit.run(q("both-rep",hvac,visit));
  for(const org of [smart,hvac]){expect((await ref(org).collection("leads").get()).size).toBe(1);expect((await ref(org).collection("activities").get()).size).toBe(1);}
  await expect(api.saveProspectingVisit.run(q("smart-admin",hvac,visit))).rejects.toMatchObject({code:"permission-denied"});
 });
 it("rejects operating in the group namespace and unselected/forged invitation companies",async()=>{
  await expect(api.loadCommercialPage.run(q("company-owner",group,{collection:"leads"}))).rejects.toMatchObject({code:"failed-precondition"});
  for(const companyIds of [[],["forged"]])await expect(api.createGovernanceInvitation.run(q("company-owner",group,{email:"bad@example.test",role:"sales_rep",scope:"assigned_records",modules,teamIds:[],companyIds}))).rejects.toMatchObject({code:"invalid-argument"});
  await expect(api.createGovernanceInvitation.run(q("company-owner",smart,{email:"bad@example.test",role:"sales_rep",scope:"assigned_records",modules,teamIds:[]}))).rejects.toMatchObject({code:"failed-precondition"});
 });
});
