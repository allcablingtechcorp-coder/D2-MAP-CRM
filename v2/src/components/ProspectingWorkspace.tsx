import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { CalendarPlus, CheckCircle2, ChevronRight, List, Map as MapIcon, MapPin, Plus, RefreshCw, Route, Search, X } from "lucide-react";
import { useI18n } from "../i18n/i18n";
import { useProspectingText } from "../i18n/prospecting";
import { useCrmWorkspace } from "../application/CrmWorkspaceLive";
import { PageHeader } from "./AppShell";
import { TeamSelector } from "./TeamSelector";
import { prospectLead, prospectStatus, visitsForLead, visitColors, type MapProspect, type VisitStatus } from "../domain/prospecting";
import type { Activity, Lead } from "../domain/crm";
import type { ProspectVisitInput } from "../application/commercial";

let googleMapsLoader: Promise<void> | null = null;
function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve();
  if (googleMapsLoader) return googleMapsLoader;
  googleMapsLoader = new Promise((resolve,reject)=>{
    const script=document.createElement("script"), callbackName=`d2MapsReady${Date.now()}`;
    const callbacks=window as unknown as Record<string,unknown>;
    const clean=()=>{window.clearTimeout(timer);delete callbacks[callbackName];};
    const fail=()=>{clean();script.remove();googleMapsLoader=null;reject(new Error("Map unavailable"));};
    const timer=window.setTimeout(fail,30000);
    callbacks[callbackName]=()=>{if(!window.google?.maps?.places){fail();return;}clean();resolve();};
    script.addEventListener("error",fail,{once:true});script.async=true;script.dataset.d2GoogleMaps="true";
    script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly&loading=async&callback=${callbackName}`;
    document.head.append(script);
  });return googleMapsLoader;
}

export function GoogleProspecting() {
  const l=useProspectingText(),{t,formatDateTime}=useI18n(),workspace=useCrmWorkspace();
  const apiKey=import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()??"";
  const mapElement=useRef<HTMLDivElement>(null),map=useRef<google.maps.Map|null>(null),places=useRef<google.maps.places.PlacesService|null>(null),markers=useRef<google.maps.Marker[]>([]);
  const searchRevision=useRef(0),fittedSet=useRef(""),nextPage=useRef<(()=>void)|null>(null);
  const [ready,setReady]=useState(false),[searching,setSearching]=useState(false),[error,setError]=useState(""),[more,setMore]=useState(false);
  const [queryText,setQueryText]=useState(t("prospecting.searchValue")),[locationText,setLocationText]=useState("Boca Raton, FL"),[radius,setRadius]=useState("20");
  const [results,setResults]=useState<MapProspect[]>([]),[selectedId,setSelectedId]=useState<string|null>(null);
  const [mode,setMode]=useState<"search"|"saved">("search"),[view,setView]=useState<"map"|"list">("map"),[filter,setFilter]=useState<VisitStatus|"all">("all");
  const [action,setAction]=useState<"save"|"plan"|"complete"|null>(null),[selectedActivity,setSelectedActivity]=useState<Activity|undefined>();
  const [feedback,setFeedback]=useState(""),[refreshing,setRefreshing]=useState(false);
  const [searchExpanded,setSearchExpanded]=useState(true);
  const detailElement=useRef<HTMLElement>(null);
  useEffect(()=>{if(selectedId)detailElement.current?.scrollIntoView({behavior:"smooth",block:"start"});},[selectedId]);
  const closeDetails=()=>{setSelectedId(null);mapElement.current?.scrollIntoView({behavior:"smooth",block:"start"});};
  const savedPlaces=useMemo(()=>workspace.leads.filter(lead=>lead.placeId && lead.position).map(lead=>({id:lead.placeId!,name:lead.companyName,location:lead.location,score:null,position:lead.position!})),[workspace.leads]);
  const items=useMemo(()=>(mode==="search"?results:savedPlaces).map(prospect=>{
    const lead=prospectLead(prospect,workspace.leads),visits=visitsForLead(lead,workspace.activities);
    return {...prospect,lead,visits,status:prospectStatus(lead,visits)};
  }),[mode,results,savedPlaces,workspace.leads,workspace.activities]);
  const visible=useMemo(()=>items.filter(item=>filter==="all"||item.status===filter),[items,filter]);
  const selected=items.find(item=>item.id===selectedId);
  useEffect(()=>{
    let active=true;if(!apiKey){setError("setup");return;}
    loadGoogleMaps(apiKey).then(()=>{
      if(!active||!mapElement.current)return;
      map.current=new google.maps.Map(mapElement.current,{center:{lat:26.3683,lng:-80.1289},zoom:11,mapTypeControl:true,fullscreenControl:true,streetViewControl:true,zoomControl:true,gestureHandling:"cooperative"});
      places.current=new google.maps.places.PlacesService(map.current);setReady(true);
    }).catch(()=>{if(active)setError("setup");});
    return ()=>{active=false;searchRevision.current++;markers.current.forEach(marker=>marker.setMap(null));};
  },[apiKey]);
  useEffect(()=>{
    if(!ready||!map.current)return;markers.current.forEach(marker=>marker.setMap(null));
    const bounds=new google.maps.LatLngBounds();
    markers.current=visible.map((item,index)=>{
      const marker=new google.maps.Marker({map:map.current,position:item.position,title:`${item.name} · ${l[item.status]}`,label:{text:String(index+1),color:"white",fontSize:"14px",fontWeight:"700"},icon:{path:google.maps.SymbolPath.CIRCLE,scale:item.id===selectedId?19:16,fillColor:visitColors[item.status],fillOpacity:1,strokeColor:"#ffffff",strokeWeight:item.id===selectedId?4:2},zIndex:item.id===selectedId?100:1});
      marker.addListener("click",()=>{setSelectedId(item.id);setView("map");setFeedback("");});bounds.extend(item.position);return marker;
    });
    const key=mode+":"+filter+":"+visible.map(item=>item.id).join(",");
    if(visible.length && fittedSet.current!==key){map.current.fitBounds(bounds,50);if(visible.length===1)map.current.setZoom(14);fittedSet.current=key;}
    return ()=>markers.current.forEach(marker=>marker.setMap(null));
  },[ready,visible,selectedId,mode,filter,l]);
  useEffect(()=>{if(ready&&view==="map"&&map.current)google.maps.event.trigger(map.current,"resize");},[view,ready]);
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!action)setSelectedId(null);};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close);},[action]);
  const searchPlaces=(event?:FormEvent)=>{
    event?.preventDefault();if(!ready||!places.current||!queryText.trim()||!locationText.trim())return;
    const revision=++searchRevision.current;setSearching(true);setError("");setMode("search");setResults([]);setSelectedId(null);setMore(false);nextPage.current=null;setFeedback("");
    let collected:MapProspect[]=[];
    new google.maps.Geocoder().geocode({address:locationText},(geo,status)=>{
      if(revision!==searchRevision.current)return;const center=status==="OK"?geo?.[0]?.geometry.location:undefined;
      places.current?.textSearch({query:`${queryText.trim()} near ${locationText.trim()}`,...(center?{location:center,radius:Number(radius)*1609.344}:{})},(rows,resultStatus,pagination)=>{
        if(revision!==searchRevision.current)return;setSearching(false);
        if(resultStatus===google.maps.places.PlacesServiceStatus.ZERO_RESULTS){setResults(collected);setMore(false);return;}
        if(resultStatus!==google.maps.places.PlacesServiceStatus.OK||!rows){setError("search");return;}
        const batch=rows.filter(place=>place.place_id&&place.geometry?.location&&place.name).map(place=>({id:place.place_id!,name:place.name!,location:place.formatted_address??locationText,score:place.rating??null,position:place.geometry!.location!.toJSON()}));
        collected=[...new Map([...collected,...batch].map(place=>[place.id,place])).values()];
        setResults(collected);setSearchExpanded(false);setMore(!!pagination?.hasNextPage);nextPage.current=pagination?.hasNextPage?()=>pagination.nextPage():null;
      });
    });
  };
  const openAction=(kind:"save"|"plan"|"complete",activity?:Activity)=>{setSelectedActivity(activity);setAction(kind);setFeedback("");};
  const choose=(item:MapProspect)=>{setSelectedId(item.id);setFeedback("");setView("map");map.current?.panTo(item.position);};
  const directions=()=>{if(selected)window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selected.location)}&destination_place_id=${encodeURIComponent(selected.id)}`,"_blank","noopener,noreferrer");};
  return <div className="prospecting-page" data-search-expanded={mode==="search"&&searchExpanded}><PageHeader title={l.title} description={l.description}/>
    {mode==="search"&&!searchExpanded&&<button className="prospect-search-summary" onClick={()=>setSearchExpanded(true)}><Search size={20}/><span><strong>{queryText}</strong><small>{locationText} · {radius} {l.miles}</small></span><span>{l.editSearch}</span></button>}
    <form className={`prospect-search-form ${searchExpanded&&mode==="search"?"":"collapsed"}`} onSubmit={searchPlaces}>
      <label>{l.query}<input value={queryText} onChange={e=>setQueryText(e.target.value)} required/></label><label>{l.location}<input value={locationText} onChange={e=>setLocationText(e.target.value)} required/></label>
      <label>{l.radius}<select value={radius} onChange={e=>setRadius(e.target.value)}>{[5,10,20,35].map(n=><option key={n} value={n}>{n} {l.miles}</option>)}</select></label>
      <button className="action-button" disabled={!ready||searching}><Search size={19}/>{searching?l.searching:l.search}</button>
    </form>
    <div className="prospect-toolbar"><div className="prospect-tabs" role="group" aria-label={l.results}><button aria-pressed={mode==="search"} onClick={()=>{setMode("search");setSelectedId(null);}}>{l.search}</button><button aria-pressed={mode==="saved"} onClick={()=>{setMode("saved");setSelectedId(null);}}>{l.savedPlaces} ({savedPlaces.length})</button></div>
      <label className="prospect-filter"><span className="sr-only">{l.filter}</span><select value={filter} onChange={e=>{setFilter(e.target.value as VisitStatus|"all");setSelectedId(null);}}><option value="all">{l.all}</option>{(["new","saved","planned","visited"] as const).map(status=><option key={status} value={status}>{l[status]}</option>)}</select></label>
      <button className="icon-button" aria-label={l.refresh} disabled={refreshing} onClick={async()=>{setRefreshing(true);try{await workspace.refresh();setFeedback("");}catch{setFeedback(l.error);}finally{setRefreshing(false);}}}><RefreshCw size={20}/></button>
      <div className="prospect-view-switch" role="group" aria-label={l.map}><button aria-pressed={view==="map"} onClick={()=>setView("map")}><MapIcon size={18}/>{l.map}</button><button aria-pressed={view==="list"} onClick={()=>setView("list")}><List size={18}/>{l.list} ({visible.length})</button></div>
    </div>
    {error&&<p className="map-error" role="alert">{error==="setup"?l.setupError:l.requestError}</p>}{feedback&&<p className="workflow-feedback" role="status">{feedback}</p>}
    <div className="prospect-legend">{(["new","saved","planned","visited"] as const).map(status=><span key={status}><i style={{background:visitColors[status]}}/>{l[status]}</span>)}</div>
    <div className="prospect-workspace" data-view={view}><section className="prospect-list" aria-label={l.list}><h2>{visible.length} {l.results}</h2>
      {visible.map((item,index)=><button className={`prospect-list-item ${selectedId===item.id?"selected":""}`} key={item.id} onClick={()=>choose(item)}><span className="prospect-number" style={{background:visitColors[item.status]}}>{index+1}</span><span><strong>{item.name}</strong><small>{item.location}</small><span className={`visit-status ${item.status}`}>{l[item.status]}</span></span><ChevronRight size={19}/></button>)}
      {!visible.length&&<p>{mode==="saved"&&!savedPlaces.length?l.noSaved:l.noResults}</p>}{mode==="search"&&more&&<button className="action-button secondary full" disabled={searching} onClick={()=>{setSearching(true);nextPage.current?.();}}>{searching?l.searching:l.more}</button>}
    </section><div className="prospect-map-column"><section className="prospect-map" aria-label={t("prospecting.mapLabel")}><div ref={mapElement} className="google-map-surface"/>{!ready&&!error&&<p className="map-loading">{l.loading}</p>}</section>
      {!selected&&<p className="prospect-hint">{l.openDetails}</p>}{selected&&<section ref={detailElement} className="prospect-detail" aria-label={selected.name}><header><div><span className={`visit-status ${selected.status}`}>{l[selected.status]}</span><h2>{selected.name}</h2><p><MapPin size={17}/>{selected.location}</p>{selected.lead&&<p>{l.owner}: <strong>{selected.lead.ownerName}</strong></p>}{selected.score!==null&&<p>{l.rating}: {selected.score}/5</p>}</div><button className="icon-button" aria-label={l.close} onClick={closeDetails}><X size={23}/></button></header>
        <button className="prospect-back" onClick={closeDetails}><MapIcon size={18}/>{l.backToMap}</button>
        <div className="prospect-detail-actions">{!selected.lead&&<button className="action-button secondary" disabled={!workspace.can("lead.create")} onClick={()=>openAction("save")}><Plus size={18}/>{l.save}</button>}<button className="action-button" disabled={!workspace.can("activity.create")} onClick={()=>openAction("plan")}><CalendarPlus size={19}/>{l.plan}</button><button className="action-button secondary" disabled={!workspace.can("activity.create")} onClick={()=>openAction("complete",selected.visits.filter(v=>!v.completed).sort((a,b)=>a.dueAt.localeCompare(b.dueAt))[0])}><CheckCircle2 size={19}/>{l.complete}</button><button className="action-button secondary" onClick={directions}><Route size={18}/>{l.route}</button></div>
        <h3>{l.history}</h3>{!selected.visits.length&&<p>{l.emptyHistory}</p>}<ol className="visit-timeline">{selected.visits.map(visit=><li key={visit.id}><div><strong>{visit.completed?l.visited:l.scheduled}</strong><time>{formatDateTime(visit.completedAt||visit.dueAt)}</time></div><p>{visit.completed?l.visitedBy:l.scheduledFor}: <strong>{visit.completed?(visit.completedByName||l.unknownVisitor):visit.ownerName}</strong></p><p className="visit-note">{visit.visitNote||visit.subject||l.unnamedNote}</p>{!visit.completed&&<button className="action-button secondary" disabled={!workspace.can("activity.create")} onClick={()=>openAction("complete",visit)}>{l.completeScheduled}</button>}</li>)}</ol>
      </section>}</div></div>
    {selected&&action&&<VisitDialog key={`${selected.id}-${action}-${selectedActivity?.id??""}`} prospect={selected} lead={selected.lead} action={action} activity={selectedActivity} onClose={()=>setAction(null)} onSaved={()=>{setAction(null);setFeedback(l.success);}}/>}
  </div>;
}

function VisitDialog({prospect,lead,action,activity,onClose,onSaved}:{prospect:MapProspect;lead?:Lead;action:ProspectVisitInput["action"];activity?:Activity;onClose:()=>void;onSaved:()=>void}) {
  const l=useProspectingText(),workspace=useCrmWorkspace(),ref=useRef<HTMLDivElement>(null);
  const [requestId]=useState(()=>crypto.randomUUID()),[busy,setBusy]=useState(false),[error,setError]=useState(false),[note,setNote]=useState("");
  const [teamId,setTeamId]=useState<string|null|undefined>();
  const [at,setAt]=useState(()=>{const date=new Date(Date.now()+(action==="plan"?86400000:0));return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);});
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.focus();return()=>previous?.focus();},[]);
  const submit=async(event:FormEvent)=>{event.preventDefault();if(busy)return;setBusy(true);setError(false);try{await workspace.saveProspectingVisit({requestId,action,placeId:prospect.id,name:prospect.name,location:prospect.location,position:prospect.position,...(lead?{leadId:lead.id}:{}),...(activity?{activityId:activity.id}:{}),...(teamId!==undefined?{teamId}:{}),...(action!=="save"?{at:new Date(at).toISOString(),note}:{})});onSaved();}catch{setError(true);}finally{setBusy(false);}};
  return <div className="modal-backdrop visit-dialog-backdrop"><div className="visit-dialog" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="visit-dialog-title" onKeyDown={e=>{
    if(e.key==="Escape"&&!busy){e.stopPropagation();onClose();}
    if(e.key==="Tab"){const nodes=ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea');if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  }}><header><h2 id="visit-dialog-title">{action==="save"?l.save:action==="plan"?l.plan:l.complete}</h2><button className="icon-button" disabled={busy} onClick={onClose} aria-label={l.cancel}><X/></button></header><strong>{prospect.name}</strong><p>{action==="save"?l.saveHelp:action==="plan"?l.scheduleHelp:l.completeHelp}</p><form onSubmit={submit}>
    {action!=="save"&&<><label>{l.date}<input type="datetime-local" required value={at} onChange={e=>setAt(e.target.value)}/></label><label>{l.note}<textarea maxLength={2000} rows={4} value={note} onChange={e=>setNote(e.target.value)}/></label></>}
    {!lead&&<TeamSelector value={teamId} onChange={setTeamId}/>}{error&&<p role="alert" className="session-error">{l.error}</p>}<footer><button type="button" className="action-button secondary" disabled={busy} onClick={onClose}>{l.cancel}</button><button className="action-button" disabled={busy}>{busy?l.saving:action==="save"?l.save:l.saveVisit}</button></footer>
  </form></div></div>;
}
