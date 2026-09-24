import { useEffect, useRef, useState } from "react";
import { useRuntimeSession } from "../application/SessionRuntime";
import { useI18n } from "../i18n/i18n";
import { useLifecycleText } from "../i18n/lifecycle";

export function LocaleSync() {
  const runtime = useRuntimeSession(), { locale, setLocale } = useI18n(), l = useLifecycleText();
  const [ready, setReady] = useState(false), [error, setError] = useState(false);
  const latest = useRef(locale); latest.current = locale;
  const repository = runtime.mode === "firebase" ? runtime.commercial : null;
  const uid = runtime.identity?.uid;
  useEffect(() => {
    if (!repository) return;
    let active = true; setReady(false); const initial = latest.current;
    repository.preferences().then((stored) => {
      if (!active) return;
      const requested = new URLSearchParams(window.location.search).get("lang");
      const preferred = requested === "en" || requested === "pt" || requested === "es" ? requested : stored.locale;
      if (latest.current === initial && (preferred === "en" || preferred === "pt" || preferred === "es")) setLocale(preferred);
      setReady(true); setError(false);
    }).catch(() => { if(active) { setError(true); setReady(true); } });
    return () => { active = false; };
  }, [repository, uid]);
  useEffect(() => {
    if (!ready || !repository) return;
    let active = true;
    const timer = window.setTimeout(() => { repository.preferences(locale).then(() => { if(active) setError(false); }).catch(() => { if(active) setError(true); }); }, 400);
    return () => { active=false; window.clearTimeout(timer); };
  }, [locale, ready, repository]);
  return error ? <div role="status" className="governance-feedback error">{l.preferenceError}</div> : null;
}
