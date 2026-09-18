import type { ComponentType, ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  MapPinned,
  Menu,
  Search,
  Settings2,
  Target,
  UsersRound,
  X,
} from "lucide-react";
import type { ModuleId } from "../domain/access";

export interface NavigationItem {
  id: ModuleId;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}

export const navigation: NavigationItem[] = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "leads", label: "Leads", icon: UsersRound },
  { id: "pipeline", label: "Pipeline", icon: Target },
  { id: "activities", label: "Atividades", icon: Activity },
  { id: "prospecting", label: "Prospecção", icon: MapPinned },
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "reports", label: "Relatórios", icon: BarChart3 },
];

interface AppShellProps {
  activeModule: ModuleId;
  onNavigate: (module: ModuleId) => void;
  mobileNavigationOpen: boolean;
  onToggleNavigation: () => void;
  children: ReactNode;
}

export function AppShell({
  activeModule,
  onNavigate,
  mobileNavigationOpen,
  onToggleNavigation,
  children,
}: AppShellProps) {
  const navigate = (module: ModuleId) => {
    onNavigate(module);
    if (mobileNavigationOpen) onToggleNavigation();
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavigationOpen ? "sidebar-open" : ""}`} aria-label="Navegação principal">
        <div className="brand-row">
          <img src="./logo.png" alt="D2 Group" />
          <div>
            <strong>D2 CRM</strong>
            <span>Sales workspace</span>
          </div>
          <button className="icon-button sidebar-close" onClick={onToggleNavigation} aria-label="Fechar navegação">
            <X size={20} />
          </button>
        </div>

        <nav className="primary-navigation">
          <p className="nav-label">Workspace</p>
          {navigation.map((item) => {
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
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <p className="nav-label">Sistema</p>
          <button className={`nav-item ${activeModule === "admin" ? "active" : ""}`} onClick={() => navigate("admin")}>
            <Settings2 size={18} strokeWidth={1.9} />
            <span>Administração</span>
          </button>
          <button className="nav-item">
            <CircleHelp size={18} strokeWidth={1.9} />
            <span>Ajuda e documentação</span>
          </button>
          <div className="account-card">
            <div className="avatar">AC</div>
            <div className="account-copy">
              <strong>All Cabling Tech</strong>
              <span>Super Admin</span>
            </div>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
        </div>
      </aside>

      {mobileNavigationOpen && <button className="sidebar-scrim" onClick={onToggleNavigation} aria-label="Fechar navegação" />}

      <div className="workspace">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={onToggleNavigation} aria-label="Abrir navegação">
            <Menu size={21} />
          </button>
          <label className="global-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Busca global</span>
            <input placeholder="Buscar empresas, leads e contatos..." />
            <kbd>⌘ K</kbd>
          </label>
          <div className="topbar-actions">
            <span className="environment-badge">Protótipo • dados demonstrativos</span>
            <button className="icon-button notification-button" aria-label="Notificações">
              <Bell size={19} />
              <span className="notification-dot" />
            </button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
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
