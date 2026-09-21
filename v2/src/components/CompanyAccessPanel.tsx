import {useEffect,useState} from "react";
import {useCompany,type CompanyAccessMember} from "../application/CompanyContext";
import {businesses} from "../domain/businesses";
import {useBusinessText} from "../i18n/businesses";
export function CompanyAccessPanel(){
  const company=useCompany(),l=useBusinessText();
  const [members,setMembers]=useState<CompanyAccessMember[]>([]),[error,setError]=useState(false);
  useEffect(()=>{let current=true;if(company.access)company.access.list().then(rows=>{if(current)setMembers(rows);}).catch(()=>{if(current)setError(true);});return()=>{current=false;};},[company.access]);
  return <section className="panel company-admin"><header className="panel-header"><div><h2>{l.access}</h2><p>{l.accessHelp}</p></div></header><div className="business-cards">{businesses.map(b=><button key={b.id} aria-pressed={company.active.id===b.id} onClick={()=>company.select(b.id)}><img src={b.logo} alt={b.name}/><span>{l.configure}</span></button>)}</div>{company.superAdmin&&<div className="company-access-list">{error&&<p role="alert">{l.error}</p>}{members.filter(m=>!m.protected).map(member=><CompanyMemberAccess key={member.uid} member={member}/>)}{!members.some(m=>!m.protected)&&!error&&<p>{l.noMembers}</p>}</div>}</section>;
}
function CompanyMemberAccess({member}:{member:CompanyAccessMember}){
 const company=useCompany(),l=useBusinessText(); const [ids,setIds]=useState(member.companyIds),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 return <form className="company-access-row" onSubmit={async e=>{e.preventDefault();if(!company.access)return;setBusy(true);setMessage("");try{await company.access.save(member.uid,ids,reason);setReason("");setMessage(l.saved);}catch{setMessage(l.error);}finally{setBusy(false);}}}><div><strong>{member.displayName}</strong><small>{member.email}</small></div><fieldset disabled={busy||member.status!=="active"}>{businesses.map(b=><label key={b.id}><input type="checkbox" checked={ids.includes(b.id)} onChange={()=>setIds(items=>items.includes(b.id)?items.filter(id=>id!==b.id):[...items,b.id])}/>{b.name}</label>)}</fieldset><label className="company-reason">{l.reason}<input required minLength={3} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="action-button" disabled={busy||member.status!=="active"}>{l.save}</button>{message&&<p role="status">{message}</p>}</form>
}
