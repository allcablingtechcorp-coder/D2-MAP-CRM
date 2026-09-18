import { useMemo, useState } from "react";
import {
  Building2, CalendarDays, CheckCircle2, ChevronRight, CircleDollarSign, Clock3,
  Download, Filter, ListFilter, MapPin, MoreHorizontal, Phone, Plus, Route,
  Search, ShieldCheck, SlidersHorizontal, Sparkles, TrendingUp, UserPlus, UsersRound,
} from "lucide-react";
import { AppShell, MetricCard, PageHeader } from "./components/AppShell";
import { Brand } from "./components/Brand";
import { demoActivities, demoLeads, demoMemberships, demoOpportunities } from "./data/demo";
import type { Membership, ModuleId } from "./domain/access";
import { roleLabels } from "./domain/access";
import { money, openStages, qualificationLabels, stageLabels, type ActivityKind, type OpportunityStage } from "./domain/crm";

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function ActionButton({ children, secondary = false }: { children: React.ReactNode; secondary?: boolean }) {
  return <button className={`action-button ${secondary ? "secondary" : ""}`}>{children}</button>;
}

function Panel({ title, description, action, children, className = "" }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><header className="panel-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</header>{children}</section>;
}

function Dashboard() {
  const pipelineValue = demoOpportunities.reduce((sum, item) => sum + (item.amountCents ?? 0), 0);
  const chart = openStages.map((stage) => ({
    stage,
    count: demoOpportunities.filter((item) => item.stage === stage).length,
    value: demoOpportunities.filter((item) => item.stage === stage).reduce((sum, item) => sum + (item.amountCents ?? 0), 0),
  }));
  return <>
    <PageHeader eyebrow="Visão geral" title="Bom dia, Dante" description="Acompanhe a operação comercial e identifique onde agir primeiro." actions={<ActionButton><Plus size={17} /> Novo lead</ActionButton>} />
    <div className="metrics-grid">
      <MetricCard label="Pipeline aberto" value={money(pipelineValue)} detail="4 oportunidades ativas" tone="positive" />
      <MetricCard label="Leads ativos" value={String(demoLeads.length)} detail="2 originados pelo mapa" />
      <MetricCard label="Atividades pendentes" value={String(demoActivities.length)} detail="1 com vencimento hoje" tone="warning" />
      <MetricCard label="Conversão estimada" value="28%" detail="Indicador demonstrativo" />
    </div>
    <div className="dashboard-grid">
      <Panel title="Pipeline comercial" description="Valor e volume por etapa" action={<button className="text-button">Abrir pipeline <ChevronRight size={16} /></button>}>
        <div className="pipeline-summary">{chart.map((item, index) => <div className="pipeline-row" key={item.stage}><div className="pipeline-row-label"><span>{stageLabels[item.stage]}</span><strong>{money(item.value)}</strong></div><div className="progress-track"><span style={{ width: `${96 - index * 16}%` }} /></div><small>{item.count} negócio{item.count === 1 ? "" : "s"}</small></div>)}</div>
      </Panel>
      <Panel title="Prioridades de hoje" description="Próximas ações da equipe" action={<button className="icon-button"><MoreHorizontal size={19} /></button>}>
        <div className="activity-list">{demoActivities.map((activity) => <div className="activity-item" key={activity.id}><div className={`activity-icon ${activity.kind}`}>{activity.kind === "call" ? <Phone size={16} /> : activity.kind === "visit" ? <MapPin size={16} /> : <CalendarDays size={16} />}</div><div><strong>{activity.subject}</strong><span>{activity.companyName}</span></div><time>{dateTime.format(new Date(activity.dueAt))}</time></div>)}</div>
      </Panel>
      <Panel title="Negócios que exigem atenção" description="Ações críticas antes do fechamento" className="span-two">
        <div className="attention-list">{demoOpportunities.slice(0, 3).map((opportunity) => <div className="attention-item" key={opportunity.id}><div className="company-mark">{opportunity.companyName.slice(0, 2).toUpperCase()}</div><div><strong>{opportunity.companyName}</strong><span>{opportunity.nextAction}</span></div><span className={`stage-pill ${opportunity.stage}`}>{stageLabels[opportunity.stage]}</span><strong>{money(opportunity.amountCents)}</strong><time>{shortDate.format(new Date(`${opportunity.expectedCloseAt}T12:00:00`))}</time></div>)}</div>
      </Panel>
    </div>
  </>;
}

function Leads() {
  const [query, setQuery] = useState("");
  const filtered = demoLeads.filter((lead) => `${lead.companyName} ${lead.location} ${lead.ownerName}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHeader eyebrow="Relacionamento" title="Leads" description="Qualifique, distribua e acompanhe cada oportunidade desde a primeira descoberta." actions={<ActionButton><UserPlus size={17} /> Adicionar lead</ActionButton>} />
    <div className="toolbar"><label className="table-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por empresa, cidade ou responsável" /></label><ActionButton secondary><ListFilter size={16} /> Filtros</ActionButton><ActionButton secondary><Download size={16} /> Exportar</ActionButton></div>
    <Panel title={`${filtered.length} leads no workspace`} description="Dados demonstrativos para validação da experiência">
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Empresa</th><th>Status</th><th>Prioridade</th><th>Responsável</th><th>Próxima ação</th><th>Última atividade</th><th /></tr></thead><tbody>{filtered.map((lead) => <tr key={lead.id}>
        <td><div className="table-primary"><span className="company-mark small">{lead.companyName.slice(0, 2).toUpperCase()}</span><div><strong>{lead.companyName}</strong><span><MapPin size={12} /> {lead.location}</span></div></div></td>
        <td><span className={`status-pill ${lead.qualification}`}>{qualificationLabels[lead.qualification]}</span></td><td><span className={`priority ${lead.priority}`}><i /> {lead.priority === "high" ? "Alta" : lead.priority === "medium" ? "Média" : "Baixa"}</span></td>
        <td>{lead.ownerName}</td><td><strong className="cell-action">{lead.nextAction}</strong><span>{dateTime.format(new Date(lead.nextActionAt))}</span></td><td>{dateTime.format(new Date(lead.lastActivityAt))}</td><td><button className="icon-button"><MoreHorizontal size={18} /></button></td>
      </tr>)}</tbody></table></div>
    </Panel>
  </>;
}

function Pipeline() {
  const columns: OpportunityStage[] = ["discovery", "diagnosis", "proposal", "negotiation"];
  return <>
    <PageHeader eyebrow="Vendas" title="Pipeline" description="Visualize o avanço das oportunidades e mantenha o próximo passo definido." actions={<ActionButton><Plus size={17} /> Nova oportunidade</ActionButton>} />
    <div className="pipeline-toolbar"><div><strong>Pipeline principal</strong><span>4 negócios • {money(demoOpportunities.reduce((sum, item) => sum + (item.amountCents ?? 0), 0))}</span></div><ActionButton secondary><SlidersHorizontal size={16} /> Personalizar etapas</ActionButton></div>
    <div className="kanban-board">{columns.map((stage) => { const items = demoOpportunities.filter((item) => item.stage === stage); return <section className="kanban-column" key={stage}>
      <header><div><i className={`stage-dot ${stage}`} /><strong>{stageLabels[stage]}</strong><span>{items.length}</span></div><strong>{money(items.reduce((sum, item) => sum + (item.amountCents ?? 0), 0))}</strong></header>
      <div className="kanban-cards">{items.map((item) => <article className="deal-card" key={item.id}><div className="deal-top"><span>{item.companyName}</span><button className="icon-button"><MoreHorizontal size={17} /></button></div><h3>{item.title}</h3><strong className="deal-value">{money(item.amountCents)}</strong><div className="deal-next"><Clock3 size={14} /><span>{item.nextAction}</span></div><footer><span className="mini-avatar">{item.ownerName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><time>{shortDate.format(new Date(`${item.expectedCloseAt}T12:00:00`))}</time></footer></article>)}</div>
      <button className="add-card"><Plus size={15} /> Adicionar negócio</button></section>; })}</div>
  </>;
}

const activityLabels: Record<ActivityKind, string> = { call: "Ligação", email: "E-mail", meeting: "Reunião", visit: "Visita", note: "Nota" };
function Activities() {
  return <><PageHeader eyebrow="Execução" title="Atividades" description="Organize contatos, visitas e compromissos da equipe comercial." actions={<ActionButton><Plus size={17} /> Nova atividade</ActionButton>} />
    <div className="metrics-grid compact"><MetricCard label="Para hoje" value="1" detail="Dentro do prazo" /><MetricCard label="Próximos 7 dias" value="3" detail="Agenda da equipe" /><MetricCard label="Concluídas no mês" value="18" detail="Indicador demonstrativo" tone="positive" /></div>
    <Panel title="Agenda da equipe" description="Ordenada por data de vencimento" action={<ActionButton secondary><Filter size={16} /> Filtrar</ActionButton>}><div className="agenda-list">{demoActivities.map((activity) => <article key={activity.id}><button className="complete-control" aria-label="Marcar como concluída"><CheckCircle2 size={20} /></button><div className={`activity-kind ${activity.kind}`}>{activityLabels[activity.kind]}</div><div className="agenda-copy"><strong>{activity.subject}</strong><span>{activity.companyName}</span></div><div className="agenda-owner"><span className="mini-avatar">{activity.ownerName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>{activity.ownerName}</div><time>{dateTime.format(new Date(activity.dueAt))}</time><button className="icon-button"><MoreHorizontal size={18} /></button></article>)}</div></Panel>
  </>;
}

const mapResults = [
  { name: "Boca Office Interiors", category: "Interior designer", location: "Boca Raton, FL", score: 92, x: 46, y: 35 },
  { name: "Coastal Build Partners", category: "General contractor", location: "Deerfield Beach, FL", score: 86, x: 57, y: 58 },
  { name: "Palm Workspace Group", category: "Architect", location: "Pompano Beach, FL", score: 78, x: 38, y: 76 },
];
function Prospecting() {
  const [selected, setSelected] = useState(0);
  return <><PageHeader eyebrow="Inteligência comercial" title="Prospecção geográfica" description="Encontre empresas, avalie o potencial e transforme resultados do mapa em leads rastreáveis." actions={<ActionButton secondary><Route size={17} /> Planejar rota</ActionButton>} />
    <div className="prospecting-shell"><aside className="prospecting-panel"><div className="prospecting-search"><label>O que você procura?</label><div><Search size={17} /><input defaultValue="Arquitetos e interior designers" /></div></div><div className="search-grid"><label>Localidade<input defaultValue="Boca Raton, FL" /></label><label>Raio<select defaultValue="20"><option value="20">20 milhas</option><option value="35">35 milhas</option></select></label></div><button className="action-button full"><Sparkles size={17} /> Buscar empresas</button><div className="result-summary"><div><strong>3 resultados qualificados</strong><span>Ordenados por potencial</span></div><button className="icon-button"><Filter size={17} /></button></div><div className="map-result-list">{mapResults.map((result, index) => <button className={`map-result ${selected === index ? "selected" : ""}`} key={result.name} onClick={() => setSelected(index)}><div className="result-score">{result.score}</div><div><strong>{result.name}</strong><span>{result.category}</span><small><MapPin size={12} /> {result.location}</small></div><ChevronRight size={17} /></button>)}</div></aside>
      <section className="map-canvas" aria-label="Mapa demonstrativo de prospecção"><div className="map-grid" /><div className="water-shape" /><span className="map-city city-one">Boca Raton</span><span className="map-city city-two">Deerfield Beach</span><span className="map-city city-three">Pompano Beach</span>{mapResults.map((result, index) => <button key={result.name} className={`map-pin ${selected === index ? "selected" : ""}`} onClick={() => setSelected(index)} style={{ left: `${result.x}%`, top: `${result.y}%` }}><MapPin size={selected === index ? 24 : 19} fill="currentColor" /><span>{index + 1}</span></button>)}<div className="map-detail"><div className="map-detail-heading"><span className="company-mark">{mapResults[selected].name.slice(0, 2).toUpperCase()}</span><div><strong>{mapResults[selected].name}</strong><span>{mapResults[selected].category} • {mapResults[selected].location}</span></div></div><div className="score-line"><span>Fit comercial</span><strong>{mapResults[selected].score}/100</strong></div><button className="action-button full"><Plus size={16} /> Adicionar como lead</button></div><div className="map-notice">Visualização cartográfica demonstrativa • integração Google Maps preservada para a fase segura de migração</div></section>
    </div>
  </>;
}

function Companies() {
  const companies = demoLeads.map((lead, index) => ({ ...lead, contacts: index + 1, opportunities: demoOpportunities.filter((item) => item.companyName === lead.companyName).length }));
  return <><PageHeader eyebrow="Base comercial" title="Empresas" description="Centralize contas, contatos, oportunidades e histórico de relacionamento." actions={<ActionButton><Building2 size={17} /> Nova empresa</ActionButton>} /><Panel title={`${companies.length} empresas`} description="Contas em acompanhamento no workspace demonstrativo"><div className="company-grid">{companies.map((company) => <article className="company-card" key={company.id}><div className="company-card-top"><span className="company-mark">{company.companyName.slice(0, 2).toUpperCase()}</span><button className="icon-button"><MoreHorizontal size={18} /></button></div><h3>{company.companyName}</h3><span><MapPin size={13} /> {company.location}</span><div className="company-stats"><div><strong>{company.contacts}</strong><span>Contatos</span></div><div><strong>{company.opportunities}</strong><span>Negócios</span></div></div><footer><span className="mini-avatar">{company.ownerName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>{company.ownerName}<ChevronRight size={16} /></footer></article>)}</div></Panel></>;
}

function Reports() {
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const exportReport = async () => {
    setExporting(true);
    setExportMessage("");
    try {
      const { exportExecutiveReport } = await import("./lib/exportExecutiveReport");
      await exportExecutiveReport({ activities: demoActivities, generatedBy: "All Cabling Tech", leads: demoLeads, opportunities: demoOpportunities });
      setExportMessage("PDF institucional gerado pelo navegador.");
    } catch {
      setExportMessage("Não foi possível gerar o PDF. Recarregue a página e tente novamente.");
    } finally {
      setExporting(false);
    }
  };
  return <><PageHeader eyebrow="Gestão" title="Relatórios" description="Analise desempenho, origem de leads e saúde do pipeline." actions={<button className="action-button secondary" onClick={exportReport} disabled={exporting}><Download size={17} /> {exporting ? "Gerando PDF..." : "Exportar PDF com marca"}</button>} />{exportMessage && <div className="export-feedback" role="status" aria-live="polite">{exportMessage}</div>}<div className="report-brand-banner"><Brand inverse subtitle="Inteligência comercial" /><div><strong>Relatório executivo</strong><span>Identidade D2 Group aplicada à visualização e ao PDF exportado.</span></div><span className="report-period">Setembro 2026</span></div><div className="metrics-grid"><MetricCard label="Receita em pipeline" value="$59,500" detail="Indicador demonstrativo" /><MetricCard label="Ticket médio" value="$19,833" detail="Negócios com valor" /><MetricCard label="Cobertura de atividades" value="75%" detail="3 de 4 leads com ação" tone="positive" /><MetricCard label="Ciclo médio" value="21 dias" detail="Indicador demonstrativo" /></div><div className="reports-grid"><Panel title="Origem dos leads" description="Distribuição do workspace"><div className="donut-layout"><div className="donut-chart"><div><strong>4</strong><span>leads</span></div></div><div className="legend"><span><i className="map-source" />Mapa <strong>50%</strong></span><span><i className="ref-source" />Indicação <strong>25%</strong></span><span><i className="inbound-source" />Inbound <strong>25%</strong></span></div></div></Panel><Panel title="Atividade por responsável" description="Volume demonstrativo dos últimos 30 dias"><div className="bar-chart">{[{ n: "Dante", v: 92 }, { n: "Leonardo", v: 68 }, { n: "Luciano", v: 54 }].map((item) => <div key={item.n}><span>{item.n}</span><div><i style={{ width: `${item.v}%` }} /></div><strong>{item.v}</strong></div>)}</div></Panel><Panel title="Indicadores disponíveis na fase seguinte" description="Relatórios definidos no plano diretor" className="span-two"><div className="report-catalog"><span><TrendingUp size={18} />Conversão por origem</span><span><CircleDollarSign size={18} />Previsão de receita</span><span><UsersRound size={18} />Desempenho por equipe</span><span><Clock3 size={18} />Tempo em cada etapa</span></div></Panel></div></>;
}

function Admin() {
  const [selected, setSelected] = useState<Membership>(demoMemberships[0]);
  return <><PageHeader eyebrow="Governança" title="Administração" description="Gerencie papéis, escopos e acessos sem alterar o cargo do usuário por um clique isolado." actions={<ActionButton><UserPlus size={17} /> Convidar usuário</ActionButton>} /><div className="admin-alert"><ShieldCheck size={21} /><div><strong>Conta proprietária protegida</strong><span>allcablingtechcorp@gmail.com mantém o papel Super Admin no modelo proposto. Mudanças exigirão confirmação e registro de auditoria no backend.</span></div></div><div className="admin-grid"><Panel title="Usuários e acessos" description="3 registros demonstrativos"><div className="member-list">{demoMemberships.map((member) => <button key={member.uid} onClick={() => setSelected(member)} className={selected.uid === member.uid ? "selected" : ""}><span className="member-avatar">{member.displayName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{member.displayName}</strong><span>{member.email}</span></div><span className={`member-status ${member.status}`}>{member.status === "active" ? "Ativo" : "Convidado"}</span><ChevronRight size={16} /></button>)}</div></Panel><Panel title="Resumo do acesso" description="Prévia antes de qualquer alteração"><div className="access-detail"><div className="access-identity"><span className="member-avatar large">{selected.displayName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{selected.displayName}</strong><span>{selected.email}</span></div></div><label>Papel atribuído<div className="readonly-field"><ShieldCheck size={17} /><span>{roleLabels[selected.role]}</span><ChevronRight size={16} /></div></label><label>Escopo dos dados<div className="readonly-field"><UsersRound size={17} /><span>{selected.scope === "organization" ? "Toda a organização" : selected.scope === "assigned_teams" ? "Equipes atribuídas" : "Registros atribuídos"}</span></div></label><div><span className="field-label">Módulos permitidos</span><div className="module-tags">{selected.modules.map((module) => <span key={module}>{module === "dashboard" ? "Visão geral" : module === "prospecting" ? "Prospecção" : module.charAt(0).toUpperCase() + module.slice(1)}</span>)}</div></div><div className="access-actions"><ActionButton secondary>Cancelar</ActionButton><ActionButton><ShieldCheck size={16} /> Revisar alteração</ActionButton></div><small className="prototype-copy">Controles em modo demonstrativo. Persistência e auditoria serão ativadas após validação do ambiente Firebase.</small></div></Panel></div></>;
}

const pages: Record<ModuleId, () => React.ReactNode> = { dashboard: Dashboard, leads: Leads, pipeline: Pipeline, activities: Activities, prospecting: Prospecting, companies: Companies, reports: Reports, admin: Admin };
export function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const Page = useMemo(() => pages[activeModule], [activeModule]);
  return <AppShell activeModule={activeModule} onNavigate={setActiveModule} mobileNavigationOpen={mobileNavigationOpen} onToggleNavigation={() => setMobileNavigationOpen((open) => !open)}><Page /></AppShell>;
}
