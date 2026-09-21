import {useCompany} from "../application/CompanyContext";
import type {BusinessId} from "../domain/businesses";
import {useBusinessText} from "../i18n/businesses";
export function CompanySelector(){const company=useCompany(),l=useBusinessText();return <div className="company-selector"><img src={company.active.logo} alt={company.active.name}/><label><span>{l.company}</span><select aria-label={l.company} value={company.active.id} onChange={e=>company.select(e.target.value as BusinessId)}>{company.available.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label></div>}
