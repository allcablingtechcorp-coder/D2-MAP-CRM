import type { ComponentType, ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Building2,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Settings2,
  Target,
  UsersRound,
  X,
} from "lucide-react";
import type { ModuleId } from "../domain/access";
import { useI18n, type Locale, type TranslationKey } from "../i18n/i18n";
import { LanguageFlag } from "./LanguageFlag";
import {CompanySelector} from "./CompanySelector";
import { Brand } from "./Brand";
import { PortalReturnLink } from "./PortalReturnLink";
import { portalEmbedCompany } from "../application/portalHandoff";

export interface NavigationItem {
  id: ModuleId;
  labelKey: TranslationKey;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}

export const navigation: NavigationItem[] = [
  { id: "dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { id: "leads", labelKey: "nav.leads", icon: UsersRound },
  { id: "pipeline", labelKey: "nav.pipeline", icon: Target },
  { id: "activities", labelKey: "nav.activities", icon: Activity },
  { id: "prospecting", labelKey: "nav.prospecting", icon: MapPinned },
  { id: "companies", labelKey: "nav.companies", icon: Building2 },
  { id: "reports", labelKey: "nav.reports", icon: BarChart3 },
];

interface AppShellProps {
  activeModule: ModuleId;
  onNavigate: (module: ModuleId) => void;
  mobileNavigationOpen: boolean;
  onToggleNavigation: () => void;
  availableModules?: readonly ModuleId[];
  account?: { displayName: string; detail: string; photoUrl?: string };
  environmentLabel?: string;
  onSignOut?: () => Promise<void>;
  sessionError?: boolean;
  children: ReactNode;
}

export function AppShell({
  activeModule,
  onNavigate,
  mobileNavigationOpen,
  onToggleNavigation,
  availableModules,
  account,
  environmentLabel,
  onSignOut,
  sessionError,
  children,
}: AppShellProps) {
  const { locale, setLocale, t } = useI18n();
  const portalEmbed = Boolean(portalEmbedCompany(window.location.search));
  const navigate = (module: ModuleId) => {
    onNavigate(module);
    if (mobileNavigationOpen) onToggleNavigation();
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavigationOpen ? "sidebar-open" : ""}`} aria-label={t("shell.mainNavigation")}>
        <div className="brand-row">
          <Brand inverse subtitle={t("brand.subtitle")} />
          <button className="icon-button sidebar-close" onClick={onToggleNavigation} aria-label={t("shell.closeNavigation")}>
            <X size={20} />
          </button>
        </div>

        <nav className="primary-navigation">
          <p className="nav-label">{t("nav.workspace")}</p>
          {navigation.filter((item) => !availableModules || availableModules.includes(item.id)).map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${active ? "active" : ""}`}
                onClick={() => navigate(item.id)}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <p className="nav-label">{t("nav.system")}</p>
          {(!availableModules || availableModules.includes("admin")) && <button className={`nav-item ${activeModule === "admin" ? "active" : ""}`} onClick={() => navigate("admin")}>
            <Settings2 size={18} strokeWidth={1.9} />
            <span>{t("nav.admin")}</span>
          </button>}
          <div className="account-card">
            <div className="avatar">{account?.photoUrl ? <img src={account.photoUrl} alt={account.displayName} referrerPolicy="no-referrer" /> : initials(account?.displayName ?? "All Cabling Tech")}</div>
            <div className="account-copy">
              <strong>{account?.displayName ?? "All Cabling Tech"}</strong>
              <span>{account?.detail ?? t("shell.superAdmin")}</span>
            </div>
          </div>
          {onSignOut && !portalEmbed && <button className="nav-item" onClick={() => { void onSignOut(); }}><LogOut size={18} /><span>{t("auth.signOut")}</span></button>}
          {sessionError && <p role="alert">{t("auth.operationError")}</p>}
        </div>
      </aside>

      {mobileNavigationOpen && <button className="sidebar-scrim" onClick={onToggleNavigation} aria-label={t("shell.closeNavigation")} />}

      <div className="workspace">
        <header className="topbar">
          <PortalReturnLink />
          <button className="icon-button menu-button" onClick={onToggleNavigation} aria-label={t("shell.openNavigation")}>
            <Menu size={21} />
          </button>
          <strong className="topbar-title">{t(`nav.${activeModule}` as TranslationKey)}</strong>
          <div className="topbar-actions">
            {!portalEmbed && <div className="language-switcher" role="group" aria-label={t("language.label")}>
              {(["en", "pt", "es"] as Locale[]).map((language) => (
                <button key={language} className={locale === language ? "active" : ""} onClick={() => setLocale(language)} aria-pressed={locale === language} title={t(`language.${language}` as TranslationKey)}>
                  <LanguageFlag locale={language} />
                  <span>{language.toUpperCase()}</span>
                </button>
              ))}
            </div>}
            {environmentLabel && <span className="environment-badge">{environmentLabel}</span>}

          </div>
        </header>
        <CompanySelector/>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "positive" | "warning";
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={`metric-detail ${tone}`}>{detail}</small>
    </article>
  );
}
