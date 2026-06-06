// Tipos do Cockpit ISP — visão operacional unificada (NOC + churn + CSAT)
// consumida por /api/isp/cockpit e pela página /dashboard/isp.

export type ServiceState = 'ok' | 'unconfigured' | 'error';

export type NocProblem = {
  name: string;
  severity: string;
  severityLabel: string;
  host: string;
  since: string; // ISO
};

export type NocSnapshot = {
  state: ServiceState;
  error?: string;
  totalProblems: number;
  disasters: number;
  highSeverity: number;
  hostsUp: number;
  hostsDown: number;
  totalHosts: number;
  topProblems: NocProblem[];
};

export type ChurnSnapshot = {
  state: ServiceState;
  error?: string;
  churnClientes: number;       // baixas efetivas (clientes únicos)
  demandaProtocolos: number;   // pedidos de cancelamento (volume)
  demandaClientes: number;     // pedidos de cancelamento (clientes únicos)
  retidosClientes: number;     // saves (reverteram o cancelamento)
  taxaRetencao: number;        // retidos / (retidos + churn) * 100
};

export type CsatAreaSnapshot = {
  area: string;
  value: number;     // % de promotores
  base: number;      // respostas válidas
  detratores: number;
};

export type CsatSnapshot = {
  state: ServiceState;
  error?: string;
  areas: CsatAreaSnapshot[];
};

export type IspCopilot = {
  source: 'ai' | 'fallback';
  resumo: string;
  prioridades: string[];
};

export type IspCockpit = {
  generatedAt: string;
  periodo: { from: string; to: string };
  noc: NocSnapshot;
  churn: ChurnSnapshot;
  csat: CsatSnapshot;
  copilot: IspCopilot;
};
