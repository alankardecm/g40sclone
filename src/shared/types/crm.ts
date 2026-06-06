// Modelo de domínio do CRM (vertical ISP).
// "Base comum": Cliente 360 (pós-venda) + Funil de vendas (pré-venda) compartilham este modelo.
// A persistência atual é em memória (seed); a interface do store permite trocar por
// Supabase ou ERP (IXC/SGP) sem mudar a UI.

export type CustomerStatus = 'ativo' | 'suspenso' | 'cancelado';
export type ChurnRisk = 'baixo' | 'medio' | 'alto';
export type Tecnologia = 'fibra' | 'radio';

export interface Contract {
  plano: string;
  mrr: number;            // mensalidade em R$
  velocidadeMbps: number;
  tecnologia: Tecnologia;
  inicio: string;         // ISO date
  status: CustomerStatus;
}

export type InteractionType = 'whatsapp' | 'ligacao' | 'email' | 'visita' | 'nota';

export interface Interaction {
  id: string;
  data: string;           // ISO
  tipo: InteractionType;
  resumo: string;
  autor: string;
}

export interface Customer {
  id: string;
  nome: string;
  documento: string;      // CPF/CNPJ (mascarado)
  cidade: string;
  uf: string;
  telefone?: string;
  email?: string;
  contrato: Contract;
  csat: number | null;    // último CSAT (%)
  protocolosAbertos: number;
  churnRisk: ChurnRisk;
  churnScore: number;     // 0-100
  tags: string[];
  desde: string;          // ISO date (cliente desde)
  ultimaInteracao?: string; // ISO
  interacoes: Interaction[];
}

// Resumo do cliente para listagens (sem o histórico completo).
export type CustomerSummary = Omit<Customer, 'interacoes'>;

export type PipelineStage = 'novo' | 'qualificacao' | 'proposta' | 'negociacao' | 'ganho' | 'perdido';

export const PIPELINE_STAGES: { id: PipelineStage; label: string }[] = [
  { id: 'novo', label: 'Novo' },
  { id: 'qualificacao', label: 'Qualificação' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'negociacao', label: 'Negociação' },
  { id: 'ganho', label: 'Ganho' },
  { id: 'perdido', label: 'Perdido' },
];

export interface Lead {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  origem: string;         // indicação, site, anúncio, porta-a-porta...
  valorMensal: number;    // MRR potencial em R$
  stage: PipelineStage;
  responsavel: string;
  telefone?: string;
  email?: string;
  criadoEm: string;       // ISO
  ultimaAtividade: string;// ISO
  observacao?: string;
}

export interface CrmKpis {
  totalClientes: number;
  clientesAtivos: number;
  mrrTotal: number;
  emRiscoAlto: number;
  leadsAbertos: number;     // não ganhos nem perdidos
  valorFunilAberto: number; // soma do MRR potencial dos leads abertos
}

export interface CrmOverview {
  kpis: CrmKpis;
  customers: CustomerSummary[];
  pipeline: { stage: PipelineStage; label: string; leads: Lead[] }[];
}
