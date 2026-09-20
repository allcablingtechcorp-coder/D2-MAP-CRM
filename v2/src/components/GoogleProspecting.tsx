import { useEffect, useRef, useState } from "react";
import { ChevronRight, MapPin, Plus, Route, Search, Sparkles } from "lucide-react";
import { useI18n, type TranslationKey } from "../i18n/i18n";
import { useCrmWorkspace } from "../application/CrmWorkspaceLive";
import { LeadDialog } from "./CommercialDialogs";
import { PageHeader } from "./AppShell";

interface MapProspect {
  id: string;
  name: string;
  category: string;
  location: string;
  score: number;
  position: google.maps.LatLngLiteral;
}

let googleMapsLoader: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve();
  if (googleMapsLoader) return googleMapsLoader;
  googleMapsLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const callbackName = `d2MapsReady${Date.now()}`;
    const callbacks = window as unknown as Record<string, unknown>;
    const timer = window.setTimeout(() => fail(), 30000);
    const clean = () => { window.clearTimeout(timer); delete callbacks[callbackName]; };
    const fail = () => { clean(); script.remove(); googleMapsLoader = null; reject(new Error("Google Maps failed to load")); };
    callbacks[callbackName] = () => {
      if (!window.google?.maps?.places) { fail(); return; }
      clean(); resolve();
    };
    script.addEventListener("error", fail, { once: true });
    script.dataset.d2GoogleMaps = "true";
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly&loading=async&callback=${callbackName}`;
    document.head.append(script);
  });
  return googleMapsLoader;
}

function categoryKey(types: string[] | undefined): TranslationKey {
  if (types?.includes("general_contractor")) return "prospecting.categoryContractor";
  if (types?.includes("architect")) return "prospecting.categoryArchitect";
  if (types?.includes("home_goods_store") || types?.includes("furniture_store")) return "prospecting.categoryDesigner";
  return "prospecting.categoryBusiness";
}

function commercialScore(place: google.maps.places.PlaceResult): number {
  const rating = place.rating ?? 3.5;
  const reviewSignal = Math.min(14, Math.log10((place.user_ratings_total ?? 0) + 1) * 5);
  return Math.min(99, Math.round(55 + rating * 6 + reviewSignal));
}

export function GoogleProspecting() {
  const { t } = useI18n();
  const { can } = useCrmWorkspace();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const places = useRef<google.maps.places.PlacesService | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const infoWindow = useRef<google.maps.InfoWindow | null>(null);
  const searchRevision = useRef(0);
  const [ready, setReady] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<"" | "configuration" | "load" | "search">("");
  const [queryText, setQueryText] = useState(t("prospecting.searchValue"));
  const [locationText, setLocationText] = useState("Boca Raton, FL");
  const [radius, setRadius] = useState("20");
  const [results, setResults] = useState<MapProspect[]>([]);
  const [selected, setSelected] = useState(0);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadCreated, setLeadCreated] = useState(false);

  useEffect(() => {
    if (!apiKey) {
      setError("configuration");
      return;
    }
    let active = true;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (!active || !mapElement.current) return;
        map.current = new google.maps.Map(mapElement.current, {
          center: { lat: 26.3683, lng: -80.1289 },
          zoom: 11,
          mapTypeControl: true,
          fullscreenControl: true,
          streetViewControl: true,
          zoomControl: true,
        });
        places.current = new google.maps.places.PlacesService(map.current);
        infoWindow.current = new google.maps.InfoWindow();
        setReady(true);
      })
      .catch(() => { if (active) setError("load"); });
    return () => {
      active = false;
      searchRevision.current++;
      markers.current.forEach((marker) => marker.setMap(null));
    };
  }, [apiKey]);

  const selectProspect = (index: number, items = results) => {
    const prospect = items[index];
    const selectedMarker = markers.current[index];
    if (!prospect || !map.current) return;
    setSelected(index);
    setLeadCreated(false);
    map.current.panTo(prospect.position);
    if ((map.current.getZoom() ?? 0) < 14) map.current.setZoom(14);
    if (selectedMarker) {
      const content = document.createElement("div");
      const title = document.createElement("strong");
      const address = document.createElement("div");
      title.textContent = prospect.name;
      address.textContent = prospect.location;
      content.append(title, address);
      infoWindow.current?.setContent(content);
      infoWindow.current?.open({ map: map.current, anchor: selectedMarker });
    }
  };

  const searchPlaces = () => {
    if (!ready || !places.current || !map.current || !queryText.trim() || !locationText.trim()) return;
    setSearching(true);
    setError("");
    const revision = ++searchRevision.current;
    markers.current.forEach((marker) => marker.setMap(null));
    markers.current = [];
    infoWindow.current?.close();
    setResults([]);
    setLeadDialogOpen(false);
    setLeadCreated(false);
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: locationText }, (geocodeResults, geocodeStatus) => {
      if (revision !== searchRevision.current) return;
      const center = geocodeStatus === "OK" ? geocodeResults?.[0]?.geometry.location : undefined;
      const request: google.maps.places.TextSearchRequest = {
        query: `${queryText.trim()} near ${locationText.trim()}`,
        ...(center ? { location: center, radius: Number(radius) * 1609.344 } : {}),
      };
      places.current?.textSearch(request, (placeResults, status) => {
        if (revision !== searchRevision.current) return;
        setSearching(false);
        if (status !== google.maps.places.PlacesServiceStatus.OK || !placeResults?.length || !map.current) {
          setResults([]);
          setError("search");
          return;
        }
        const prospects = placeResults
          .filter((place) => place.geometry?.location && place.name)
          .slice(0, 20)
          .map((place) => ({
            id: place.place_id ?? `${place.name}-${place.formatted_address ?? ""}`,
            name: place.name!,
            category: t(categoryKey(place.types)),
            location: place.formatted_address ?? locationText,
            score: commercialScore(place),
            position: place.geometry!.location!.toJSON(),
          }))
          .sort((left, right) => right.score - left.score);
        markers.current.forEach((marker) => marker.setMap(null));
        const bounds = new google.maps.LatLngBounds();
        markers.current = prospects.map((prospect, index) => {
          const marker = new google.maps.Marker({
            map: map.current,
            position: prospect.position,
            title: prospect.name,
            label: { text: String(index + 1), color: "#ffffff", fontSize: "11px", fontWeight: "700" },
          });
          marker.addListener("click", () => selectProspect(index, prospects));
          bounds.extend(prospect.position);
          return marker;
        });
        setResults(prospects);
        setSelected(0);
        map.current.fitBounds(bounds, 56);
      });
    });
  };

  useEffect(() => {
    if (ready) searchPlaces();
    // The first search must run exactly once after the map service is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const selectedProspect = results[selected];
  const planRoute = () => {
    if (!selectedProspect) return;
    const destination = `${selectedProspect.position.lat},${selectedProspect.position.lng}`;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`, "_blank", "noopener,noreferrer");
  };

  return <>
    <PageHeader eyebrow={t("prospecting.eyebrow")} title={t("prospecting.title")} description={t("prospecting.description")} actions={<button className="action-button secondary" onClick={planRoute} disabled={!selectedProspect}><Route size={17} /> {t("prospecting.planRoute")}</button>} />
    {leadCreated && <div className="workflow-feedback" role="status">{t("prospecting.leadCreated")}</div>}
    <div className="prospecting-shell">
      <aside className="prospecting-panel">
        <div className="prospecting-search"><label>{t("prospecting.searchLabel")}</label><div><Search size={17} /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchPlaces()} /></div></div>
        <div className="search-grid"><label>{t("prospecting.location")}<input value={locationText} onChange={(event) => setLocationText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchPlaces()} /></label><label>{t("prospecting.radius")}<select value={radius} onChange={(event) => setRadius(event.target.value)}><option value="20">{t("prospecting.miles", { count: 20 })}</option><option value="35">{t("prospecting.miles", { count: 35 })}</option></select></label></div>
        <button className="action-button full" onClick={searchPlaces} disabled={!ready || searching}><Sparkles size={17} /> {searching ? t("prospecting.searching") : t("prospecting.searchCompanies")}</button>
        <div className="result-summary"><div><strong>{t("prospecting.qualifiedResults", { count: results.length })}</strong><span>{t("prospecting.sorted")}</span></div></div>
        {error && <div className="map-error" role="alert">{t(`prospecting.error.${error}`)}</div>}
        <div className="map-result-list">{results.map((result, index) => <button className={`map-result ${selected === index ? "selected" : ""}`} key={result.id} onClick={() => selectProspect(index)}><div className="result-score">{result.score}</div><div><strong>{result.name}</strong><span>{result.category}</span><small><MapPin size={12} /> {result.location}</small></div><ChevronRight size={17} /></button>)}</div>
      </aside>
      <section className="map-canvas google-map-canvas" aria-label={t("prospecting.mapLabel")}>
        <div ref={mapElement} className="google-map-surface" />
        {!ready && !error && <div className="map-loading">{t("prospecting.loadingMap")}</div>}
        {selectedProspect && <div className="map-detail"><div className="map-detail-heading"><span className="company-mark">{selectedProspect.name.slice(0, 2).toUpperCase()}</span><div><strong>{selectedProspect.name}</strong><span>{selectedProspect.category} • {selectedProspect.location}</span></div></div><div className="score-line"><span>{t("prospecting.commercialFit")}</span><strong>{selectedProspect.score}/100</strong></div><button className="action-button full" disabled={!can("lead.create")} onClick={() => setLeadDialogOpen(true)}><Plus size={16} /> {t("prospecting.addAsLead")}</button></div>}
        <div className="map-notice">Google Maps • {t("prospecting.mapInteractive")}</div>
      </section>
    </div>
    {leadDialogOpen && selectedProspect && <LeadDialog preset={{ companyName: selectedProspect.name, location: selectedProspect.location, ownerName: "Dante Frota", source: "map", priority: selectedProspect.score >= 90 ? "high" : "medium", nextAction: t("prospecting.firstContact") }} onClose={() => setLeadDialogOpen(false)} onCreated={() => setLeadCreated(true)} />}
  </>;
}
