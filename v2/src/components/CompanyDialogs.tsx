import { useState, type FormEvent } from "react";
import { Building2, UserPlus, X } from "lucide-react";
import { useCrmWorkspace } from "../application/CrmWorkspaceLive";
import { useI18n } from "../i18n/i18n";

export function CompanyDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const workspace = useCrmWorkspace();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !location.trim()) { setError(true); return; }
    setSaving(true); setError(false);
    const result = await workspace.addCompany({ name: name.trim(), location: location.trim(), industry: industry.trim(), website: website.trim(), phone: phone.trim() });
    setSaving(false);
    if (!result) { setError(true); return; }
    onClose();
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><section className="governance-modal commercial-modal" role="dialog" aria-modal="true" aria-labelledby="company-dialog-title"><header><div><span>{t("companies.eyebrow")}</span><h2 id="company-dialog-title">{t("companies.new")}</h2><p>{t("companies.createDescription")}</p></div><button className="icon-button" onClick={onClose} aria-label={t("common.cancel")}><X size={19}/></button></header><form onSubmit={submit}><div className="dialog-grid"><label>{t("companies.name")}<input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></label><label>{t("leadDialog.location")}<input value={location} onChange={(event) => setLocation(event.target.value)} /></label><label>{t("companies.industry")}<input value={industry} onChange={(event) => setIndustry(event.target.value)} /></label><label>{t("companies.phone")}<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label className="span-two">{t("companies.website")}<input type="url" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://" /></label></div>{error && <div className="governance-feedback error" role="alert">{t("workspace.remoteError")}</div>}<footer><button type="button" className="action-button secondary" onClick={onClose}>{t("common.cancel")}</button><button type="submit" className="action-button" disabled={saving}><Building2 size={16}/>{t("companies.create")}</button></footer></form></section></div>;
}

export function ContactDialog({ companyId, onClose }: { companyId?: string; onClose: () => void }) {
  const { t } = useI18n();
  const workspace = useCrmWorkspace();
  const [selectedCompanyId, setSelectedCompanyId] = useState(companyId ?? workspace.companies[0]?.id ?? "");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCompanyId || !name.trim()) { setError(true); return; }
    setSaving(true); setError(false);
    const result = await workspace.addContact({ companyId: selectedCompanyId, name: name.trim(), title: title.trim(), email: email.trim(), phone: phone.trim() });
    setSaving(false);
    if (!result) { setError(true); return; }
    onClose();
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><section className="governance-modal commercial-modal" role="dialog" aria-modal="true" aria-labelledby="contact-dialog-title"><header><div><span>{t("companies.contacts")}</span><h2 id="contact-dialog-title">{t("companies.newContact")}</h2><p>{t("companies.contactDescription")}</p></div><button className="icon-button" onClick={onClose} aria-label={t("common.cancel")}><X size={19}/></button></header><form onSubmit={submit}><div className="dialog-grid"><label className="span-two">{t("companies.company")}<select value={selectedCompanyId} onChange={(event) => setSelectedCompanyId(event.target.value)}>{workspace.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label>{t("companies.contactName")}<input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></label><label>{t("companies.contactTitle")}<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>{t("companies.email")}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>{t("companies.phone")}<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label></div>{error && <div className="governance-feedback error" role="alert">{t("workspace.remoteError")}</div>}<footer><button type="button" className="action-button secondary" onClick={onClose}>{t("common.cancel")}</button><button type="submit" className="action-button" disabled={saving}><UserPlus size={16}/>{t("companies.createContact")}</button></footer></form></section></div>;
}
