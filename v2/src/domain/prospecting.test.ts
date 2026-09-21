import {describe,it,expect} from "vitest";
import {prospectLead,prospectStatus,visitsForLead} from "./prospecting";
import type {Activity,Lead} from "./crm";
describe("map visit identity and status",()=>{
 const lead={id:"lead",companyId:"company",companyName:"Office",location:"Boca",placeId:"place"} as Lead;
 const prospect={id:"place",name:"Office renamed",location:"Boca",score:null,position:{lat:26,lng:-80}};
 it("links by Google place ID despite name changes, never by name alone",()=>{
  expect(prospectLead(prospect,[lead])).toBe(lead);
  expect(prospectLead({...prospect,id:"other",name:"Office"},[lead])).toBeUndefined();
 });
 it("keeps planned revisits visible and excludes unrelated or archived history",()=>{
  const history=[{id:"done",companyId:"company",kind:"visit",completed:true,completedAt:"2026-09-20",dueAt:"2026-09-20"},{id:"next",companyId:"company",kind:"visit",completed:false,dueAt:"2026-09-22"},{id:"other",companyId:"other",kind:"visit",completed:true},{id:"archived",companyId:"company",kind:"visit",archived:true}] as Activity[];
  const visits=visitsForLead(lead,history); expect(visits).toHaveLength(2); expect(prospectStatus(lead,visits)).toBe("planned");
  expect(prospectStatus(lead,visits.filter(a=>a.completed))).toBe("visited");
  expect(prospectStatus(lead,[])).toBe("saved"); expect(prospectStatus(undefined,[])).toBe("new");
 });
});
