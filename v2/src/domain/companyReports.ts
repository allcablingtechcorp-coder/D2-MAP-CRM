import type {Business} from "./businesses";
import type {CommercialWorkspaceSnapshot} from "../application/commercial";
export type CompanyReport = {business:Business;data:CommercialWorkspaceSnapshot};
export function combineCompanyReports(reports:CompanyReport[]):CommercialWorkspaceSnapshot {
 const result:CommercialWorkspaceSnapshot={leads:[],activities:[],opportunities:[],companies:[],contacts:[]};
 for(const report of reports){for(const kind of ["leads","activities","opportunities","companies","contacts"] as const){
   const records=report.data[kind].filter(record=>!record.archived).map(record=>({...record,id:`${report.business.id}:${record.id}`,...("companyId" in record&&record.companyId?{companyId:`${report.business.id}:${record.companyId}`}:{})}));
   // The collection discriminant is preserved by the loop.
   (result[kind] as typeof records).push(...records);
 }}return result;
}
