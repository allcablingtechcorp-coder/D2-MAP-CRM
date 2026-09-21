import { createContext, useContext } from "react";
import { businesses, type Business, type BusinessId } from "../domain/businesses";
import type { MembershipRepository } from "./session";
import type { CommercialRepository } from "./commercial";
export interface CompanyAccessMember { uid:string; email:string; displayName:string; status:string; protected:boolean; companyIds:string[] }
export interface CompanyAccessRepository { list():Promise<CompanyAccessMember[]>; save(uid:string,companyIds:string[],reason:string):Promise<void> }
export interface CompanyScopeRepositories { memberships:MembershipRepository; commercial:CommercialRepository }
export interface CompanyContextValue {
  active:Business; available:Business[]; select:(id:BusinessId)=>void;
  superAdmin:boolean; groupMemberships?:MembershipRepository; access?:CompanyAccessRepository;
  repositories?:(id:BusinessId)=>CompanyScopeRepositories;
}
export const CompanyContext=createContext<CompanyContextValue>({active:businesses[0],available:[...businesses],select:()=>{},superAdmin:true});
export const useCompany=()=>useContext(CompanyContext);
