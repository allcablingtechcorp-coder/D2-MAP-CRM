import { ArrowLeft } from "lucide-react";
import { useI18n } from "../i18n/i18n";

const portalUrl = "https://d2-group-system.web.app/workspace.html";
const labels = { en: "Back to Portal", pt: "Voltar ao Portal", es: "Volver al Portal" };

export function PortalReturnLink() {
  const { locale } = useI18n();
  const params = new URLSearchParams(window.location.search);
  if (params.get("source") !== "d2-portal" || params.get("embed") === "1") return null;
  return <a className="portal-return" href={portalUrl} target="_top"><ArrowLeft size={18} aria-hidden="true" />{labels[locale]}</a>;
}
