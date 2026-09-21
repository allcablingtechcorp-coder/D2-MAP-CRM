import {describe,it,expect} from "vitest";
import {combineCompanyReports} from "./companyReports";
import {businesses,authorizedBusinesses} from "./businesses";
import type {CommercialWorkspaceSnapshot} from "../application/commercial";
describe("company report boundaries",()=>{
 it("keeps equal record IDs from two companies separate and excludes archived data",()=>{
   const data={leads:[{id:"same",companyId:"customer",archived:false},{id:"old",archived:true}],companies:[],contacts:[],opportunities:[],activities:[]} as unknown as CommercialWorkspaceSnapshot;
   const combined=combineCompanyReports(businesses.map(business=>({business,data})));
   expect(combined.leads.map(l=>l.id)).toEqual(["d2-smart-home:same","d2-hvac-solutions:same"]);
   expect(combined.leads.map(l=>l.companyId)).toEqual(["d2-smart-home:customer","d2-hvac-solutions:customer"]);
 });
 it("does not default an absent or forged grant to another company",()=>{
   expect(authorizedBusinesses()).toEqual([]);expect(authorizedBusinesses(["unknown"])).toEqual([]);
   expect(authorizedBusinesses(["d2-hvac-solutions"]).map(b=>b.id)).toEqual(["d2-hvac-solutions"]);
 });
});
