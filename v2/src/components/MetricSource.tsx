import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import {useI18n} from '../i18n/i18n';
export type MetricSourceRow={id:string;label:string;value?:string;detail?:string};

export function MetricSource({label,value,detail,rows,onClose}:{label:string;value:string;detail:string;rows:MetricSourceRow[];onClose:()=>void}){
 const {t}=useI18n();const dialog=useRef<HTMLElement>(null);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  const priorOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
  return()=>{document.body.style.overflow=priorOverflow;previous?.focus();};
 },[]);
 return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section ref={dialog} className="governance-modal metric-source-modal" role="dialog" aria-modal="true" aria-label={label} onKeyDown={e=>{
   if(e.key==='Escape'){e.preventDefault();onClose();}
   if(e.key==='Tab'){e.preventDefault();dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();}
  }}>
   <header><div><h2>{label}</h2><strong className="metric-source-value">{value}</strong><p>{detail}</p></div><button type="button" className="icon-button" aria-label={t('common.cancel')} onClick={onClose}><X size={20}/></button></header>
   {rows.length?<ul className="metric-source-list">{rows.map(row=><li key={row.id}><div><strong>{row.label}</strong>{row.detail&&<small>{row.detail}</small>}</div>{row.value&&<strong>{row.value}</strong>}</li>)}</ul>:<p className="empty-detail">{t('audit.noData')}</p>}
  </section>
 </div>;
}
