import {
  Home, BarChart3, Bot, Users2, Target,
  MessagesSquare, Wallet, CheckSquare, Settings, Activity,
  type LucideIcon,
} from 'lucide-react';

export type ModuleStatus = 'active' | 'soon';
export type ModuleGroup = 'principal' | 'gestao' | 'sistema';

export type OsModule = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  group: ModuleGroup;
  status: ModuleStatus;
  desc: string;
};

export const GROUP_LABELS: Record<ModuleGroup, string> = {
  principal: 'Principal',
  gestao: 'Gestão',
  sistema: 'Sistema',
};

/**
 * Núcleo horizontal do AM OS — serve a qualquer empresa.
 * `status: 'soon'` aponta para a tela /em-breve/[modulo].
 * Verticais (ex.: ISP) entram depois como pacotes adicionais.
 */
export const modules: OsModule[] = [
  { id: 'inicio',      label: 'Início',        href: '/',                   icon: Home,           group: 'principal', status: 'active', desc: 'Visão geral e cockpit da empresa' },
  { id: 'indicadores', label: 'Indicadores',   href: '/dashboards',         icon: BarChart3,      group: 'principal', status: 'active', desc: 'KPIs, metas e dashboards em tempo real' },
  { id: 'assistente',  label: 'Assistente IA', href: '/chat',               icon: Bot,            group: 'principal', status: 'active', desc: 'IA que lê seus dados e age por você' },
  { id: 'cockpit-isp', label: 'Cockpit ISP',   href: '/dashboard/isp',      icon: Activity,       group: 'principal', status: 'active', desc: 'NOC, churn e CSAT com copiloto de IA' },

  { id: 'crm',         label: 'CRM',           href: '/crm',         icon: Users2,        group: 'gestao',    status: 'active',   desc: 'Clientes, funil de vendas e negócios' },
  { id: 'okrs',        label: 'Metas & OKRs',  href: '/em-breve/okrs',        icon: Target,        group: 'gestao',    status: 'soon',   desc: 'Objetivos e resultados-chave da equipe' },
  { id: 'comunicacao', label: 'Comunicação',   href: '/em-breve/comunicacao', icon: MessagesSquare, group: 'gestao',   status: 'soon',   desc: 'WhatsApp, mensagens e atendimento' },
  { id: 'financeiro',  label: 'Financeiro',    href: '/em-breve/financeiro',  icon: Wallet,        group: 'gestao',    status: 'soon',   desc: 'Contas a pagar/receber e fluxo de caixa' },
  { id: 'tarefas',     label: 'Tarefas',       href: '/em-breve/tarefas',     icon: CheckSquare,   group: 'gestao',    status: 'soon',   desc: 'Rotinas de gestão e to-dos do time' },

  { id: 'config',      label: 'Configurações', href: '/settings',           icon: Settings,       group: 'sistema',   status: 'active', desc: 'Conexões, integrações e ajustes' },
];

export const moduleById = (id: string) => modules.find((m) => m.id === id);

export const groupedModules = (): Record<ModuleGroup, OsModule[]> => ({
  principal: modules.filter((m) => m.group === 'principal'),
  gestao: modules.filter((m) => m.group === 'gestao'),
  sistema: modules.filter((m) => m.group === 'sistema'),
});
