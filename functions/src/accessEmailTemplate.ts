export type EmailLocale = "en" | "pt" | "es";
export interface AccessEmailContext {
  kind: "invitation" | "signin";
  companyIds: string[];
  role?: string;
  scope?: string;
  expiresAt?: number;
}
export interface AccessEmailInput extends AccessEmailContext {
  recipient: string;
  link: string;
  locale?: string;
  publicImages?: boolean;
}

const assetBase = "https://allcablingtechcorp-coder.github.io/D2-MAP-CRM/";
export const emailAssets = {
  group: { file: "logo.png", alt: "D2 Group", cid: "d2-group-logo" },
  "d2-smart-home": { file: "logo-d2-smart-home.png", alt: "D2 Smart Home", cid: "d2-smart-home-logo" },
  "d2-hvac-solutions": { file: "logo-d2-hvac-solutions.png", alt: "D2 HVAC Solutions", cid: "d2-hvac-logo" },
} as const;
type CompanyId = "d2-smart-home" | "d2-hvac-solutions";
const copy = {
  en: {
    subject: "You're invited — welcome to D2 Group", signinSubject: "Your secure access to D2 CRM",
    preheader: "Your team. Your opportunities. One workspace. Welcome to D2 CRM.",
    eyebrow: "YOUR PERSONAL INVITATION", title: "Your next opportunity starts here.",
    intro: "Welcome to D2 Group. You're invited to join our sales workspace — a place to discover new leads, build customer relationships, and turn opportunities into results.",
    workspace: "YOUR WORKSPACE", role: "Your role", scope: "Access", all: "All records in the selected companies", assigned: "Records assigned to you",
    button: "Accept invitation & get started", signinButton: "Open my workspace",
    signinTitle: "Welcome back.", signinIntro: "Your secure sign-in link is ready. Open your workspace and pick up where you left off.",
    section: "Make your first connection.", features: ["Discover promising leads on the map.", "Plan visits and keep customer history close.", "Move opportunities forward with your team."],
    next: "Open the link, confirm the email address that received this invitation, then select Accept invitation in the CRM.",
    signinNext: "Open the link and confirm the same email address that received this message.",
    expiry: "Invitation valid until", timezone: "Eastern Time", closing: "We look forward to building the next chapter with you.",
    signature: "The D2 Group team", fallback: "Button not working? Copy this secure link into your browser:",
    security: "This link is personal. Please don't forward it. If you weren't expecting this email, you can ignore it.",
    sentTo: "Sent to", support: "Need help? Reply to this email.",
    roles: {operations_admin:"Operations administrator",sales_manager:"Sales manager",sales_rep:"Sales representative",sdr:"SDR / Prospecting",viewer:"Read-only / Analyst",owner:"Super Admin"},
  },
  pt: {
    subject: "Você foi convidado — boas-vindas à D2 Group", signinSubject: "Seu acesso seguro ao D2 CRM",
    preheader: "Sua equipe. Suas oportunidades. Um só ambiente. Boas-vindas ao D2 CRM.",
    eyebrow: "UM CONVITE PARA VOCÊ", title: "Sua próxima oportunidade começa aqui.",
    intro: "Boas-vindas à D2 Group. Você foi convidado para nosso ambiente comercial — um espaço para descobrir novos leads, construir relacionamentos e transformar oportunidades em resultados.",
    workspace: "SEU AMBIENTE DE TRABALHO", role: "Sua função", scope: "Acesso", all: "Todos os registros das empresas selecionadas", assigned: "Registros atribuídos a você",
    button: "Aceitar convite e começar", signinButton: "Abrir meu ambiente",
    signinTitle: "Bem-vindo de volta.", signinIntro: "Seu link seguro de entrada está pronto. Acesse seu ambiente e continue de onde parou.",
    section: "Comece sua próxima conexão.", features: ["Descubra novos leads pelo mapa.", "Planeje visitas e tenha o histórico do cliente à mão.", "Avance nas oportunidades junto com sua equipe."],
    next: "Abra o link, confirme o e-mail que recebeu este convite e selecione Aceitar convite no CRM.",
    signinNext: "Abra o link e confirme o mesmo e-mail que recebeu esta mensagem.",
    expiry: "Convite válido até", timezone: "horário do leste dos EUA", closing: "Estamos prontos para construir o próximo capítulo com você.",
    signature: "Equipe D2 Group", fallback: "O botão não abriu? Copie este link seguro no navegador:",
    security: "Este link é pessoal. Não o encaminhe. Se você não esperava esta mensagem, pode ignorá-la.",
    sentTo: "Enviado para", support: "Precisa de ajuda? Responda a este e-mail.",
    roles: {operations_admin:"Administrador operacional",sales_manager:"Gerente comercial",sales_rep:"Vendedor",sdr:"SDR / Prospecção",viewer:"Leitura / Analista",owner:"Super Admin"},
  },
  es: {
    subject: "Está invitado — bienvenido a D2 Group", signinSubject: "Su acceso seguro a D2 CRM",
    preheader: "Su equipo. Sus oportunidades. Un solo espacio. Bienvenido a D2 CRM.",
    eyebrow: "UNA INVITACIÓN PARA USTED", title: "Su próxima oportunidad comienza aquí.",
    intro: "Bienvenido a D2 Group. Está invitado a nuestro espacio comercial: un lugar para descubrir nuevos leads, construir relaciones y convertir oportunidades en resultados.",
    workspace: "SU ESPACIO DE TRABAJO", role: "Su función", scope: "Acceso", all: "Todos los registros de las empresas seleccionadas", assigned: "Registros asignados a usted",
    button: "Aceptar invitación y comenzar", signinButton: "Abrir mi espacio",
    signinTitle: "Bienvenido de nuevo.", signinIntro: "Su enlace seguro de acceso está listo. Abra su espacio y continúe donde lo dejó.",
    section: "Comience su próxima conexión.", features: ["Descubra nuevos leads en el mapa.", "Planifique visitas y consulte el historial del cliente.", "Avance en las oportunidades con su equipo."],
    next: "Abra el enlace, confirme el correo que recibió esta invitación y seleccione Aceptar invitación en el CRM.",
    signinNext: "Abra el enlace y confirme el mismo correo que recibió este mensaje.",
    expiry: "Invitación válida hasta", timezone: "hora del este de EE. UU.", closing: "Esperamos construir el próximo capítulo con usted.",
    signature: "Equipo D2 Group", fallback: "¿El botón no funciona? Copie este enlace seguro en su navegador:",
    security: "Este enlace es personal. No lo reenvíe. Si no esperaba este mensaje, puede ignorarlo.",
    sentTo: "Enviado a", support: "¿Necesita ayuda? Responda a este correo.",
    roles: {operations_admin:"Administrador operativo",sales_manager:"Gerente comercial",sales_rep:"Vendedor",sdr:"SDR / Prospección",viewer:"Lectura / Analista",owner:"Super Admin"},
  },
};
const escape = (v: string) => v.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));

export function buildAccessEmail(input: AccessEmailInput) {
  const locale: EmailLocale = input.locale === "pt" || input.locale === "es" ? input.locale : "en";
  const t = copy[locale], invitation = input.kind === "invitation";
  const companies = (["d2-smart-home", "d2-hvac-solutions"] as CompanyId[]).filter(id => input.companyIds.includes(id));
  if (!companies.length) throw new Error("EMAIL_COMPANIES_REQUIRED");
  const url = new URL(input.link);
  if (url.protocol !== "https:" || !["d2-map-crm.firebaseapp.com", "allcablingtechcorp-coder.github.io"].includes(url.hostname)) throw new Error("EMAIL_LINK_NOT_ALLOWED");
  const link = escape(url.href);
  const image = (id: keyof typeof emailAssets, width: number) => {
    const a = emailAssets[id];
    return `<img src="${input.publicImages ? assetBase + a.file : "cid:" + a.cid}" alt="${a.alt}" width="${width}" style="display:block;width:${width}px;max-width:100%;height:auto;border:0;" />`;
  };
  const title = invitation ? t.title : t.signinTitle;
  const intro = invitation ? t.intro : t.signinIntro;
  const button = invitation ? t.button : t.signinButton;
  const role = input.role && input.role in t.roles ? t.roles[input.role as keyof typeof t.roles] : "";
  const expiry = invitation && input.expiresAt ? `${t.expiry} ${new Intl.DateTimeFormat(locale, {dateStyle:"long", timeStyle:"short", timeZone:"America/New_York"}).format(input.expiresAt)} (${t.timezone}).` : "";
  const companyRows = companies.map(id => `<tr><td style="padding:16px 20px;background:#ffffff;border:1px solid #e5e8ee;border-radius:10px;">${image(id, 202)}</td></tr><tr><td height="10" style="font-size:1px;line-height:10px;">&nbsp;</td></tr>`).join("");
  const features = invitation ? `<h2 style="margin:0 0 16px;color:#132139;font-size:20px;line-height:28px;">${t.section}</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${t.features.map((f, i) => `<tr><td valign="top" width="34" style="padding:0 0 14px;color:#a17c31;font-size:17px;font-weight:bold;">0${i + 1}</td><td style="padding:0 0 14px;color:#526079;font-size:16px;line-height:25px;">${f}</td></tr>`).join("")}</table>` : "";
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(invitation ? t.subject : t.signinSubject)}</title><style>@media only screen and (max-width:600px){.outer{padding:12px 8px!important}.pad{padding:28px 24px!important}.hero{font-size:32px!important;line-height:38px!important}.brand-pad{padding:24px!important}.button{display:block!important;padding:18px 14px!important}.footer{padding:24px!important}}</style></head>
<body style="margin:0;padding:0;background:#f0f2f6;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;color:#132139;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escape(invitation ? t.preheader : t.signinIntro)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0f2f6;"><tr><td class="outer" align="center" style="padding:36px 16px;">
<!--[if mso]><table role="presentation" width="640" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e6ed;border-radius:16px;overflow:hidden;">
<tr><td class="brand-pad" style="padding:26px 40px;background:#0d192c;border-bottom:4px solid #c6a14b;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td>${image("group", 176)}</td><td align="right" style="color:#d8c18b;font-size:12px;letter-spacing:2px;font-weight:bold;">D2 CRM</td></tr></table></td></tr>
<tr><td class="pad" style="padding:38px 40px 30px;"><p style="margin:0 0 16px;color:#8d6b24;font-size:12px;font-weight:bold;letter-spacing:2px;">${invitation ? t.eyebrow : "D2 GROUP · CRM"}</p>
<h1 class="hero" style="margin:0 0 22px;font-size:40px;line-height:46px;font-weight:bold;letter-spacing:-1px;color:#132139;">${title}</h1>
<p style="margin:0;color:#526079;font-size:17px;line-height:28px;">${intro}</p></td></tr>
<tr><td class="pad" style="padding:0 40px 30px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f6f9;border-radius:12px;"><tr><td style="padding:24px;">
<p style="margin:0 0 16px;font-size:11px;letter-spacing:1.8px;color:#657086;font-weight:bold;">${t.workspace}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${companyRows}</table>
${invitation && role ? `<p style="margin:6px 0 0;font-size:14px;line-height:22px;color:#526079;">${t.role}: <strong style="color:#132139;">${role}</strong></p>` : ""}
${invitation && input.scope ? `<p style="margin:6px 0 0;font-size:14px;line-height:22px;color:#526079;">${t.scope}: ${input.scope === "organization" ? t.all : t.assigned}</p>` : ""}
</td></tr></table></td></tr>
<tr><td class="pad" align="center" style="padding:0 40px 34px;">
<table role="presentation" cellspacing="0" cellpadding="0" width="100%"><tr><td align="center" bgcolor="#245bdd" style="border-radius:8px;mso-padding-alt:18px 28px;"><a class="button" href="${link}" style="display:block;padding:18px 28px;font-size:17px;font-weight:bold;text-align:center;color:#ffffff;text-decoration:none;line-height:24px;border-radius:8px;">${button} &nbsp;→</a></td></tr></table>
<p style="margin:16px 0 0;font-size:14px;line-height:22px;color:#657086;">${invitation ? t.next : t.signinNext}</p>
${expiry ? `<p style="margin:12px 0 0;font-size:12px;line-height:20px;color:#657086;">${expiry}</p>` : ""}</td></tr>
<tr><td class="pad" style="padding:0 40px 34px;">${features}<p style="margin:14px 0 8px;font-size:16px;line-height:26px;color:#526079;">${invitation ? t.closing : t.support}</p><p style="margin:0;font-size:16px;line-height:26px;font-weight:bold;color:#132139;">${t.signature}</p></td></tr>
<tr><td class="footer" style="padding:26px 40px;background:#f8f9fb;border-top:1px solid #e5e8ee;font-size:12px;line-height:20px;color:#657086;">
<p style="margin:0 0 10px;">${t.fallback}<br><a href="${link}" style="color:#245bdd;text-decoration:underline;word-break:break-all;overflow-wrap:anywhere;">${link}</a></p>
<p style="margin:0 0 10px;">${t.security}</p><p style="margin:0;">${t.sentTo} ${escape(input.recipient)} · D2 Group<br>${t.support}</p>
</td></tr></table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
  const text = [title,intro,t.workspace,...companies.map(id => emailAssets[id].alt),role,button,url.href,invitation?t.next:t.signinNext,expiry,...(invitation?t.features:[]),t.security,t.signature].filter(Boolean).join("\n\n");
  return {subject:invitation?t.subject:t.signinSubject,html,text,assets:[emailAssets.group,...companies.map(id=>emailAssets[id])]};
}
