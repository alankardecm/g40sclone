// Store do CRM — MVP em memória. Singleton preso ao globalThis para sobreviver ao
// hot-reload do Next em dev. A interface (getOverview/getCustomer/moveLead/addInteraction)
// é a mesma que uma implementação futura em Supabase ou ERP (IXC/SGP) deve expor.
import type {
  Customer, Lead, PipelineStage, CrmOverview, CrmKpis, CustomerSummary, Interaction, InteractionType,
} from '@/shared/types/crm';
import { PIPELINE_STAGES } from '@/shared/types/crm';
import { SEED_CUSTOMERS, SEED_LEADS } from '@/modules/crm/application/seed';

type CrmData = { customers: Customer[]; leads: Lead[] };

const clone = <T>(x: T): T =>
  (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

const g = globalThis as unknown as { __crmStore?: CrmData };
function db(): CrmData {
  if (!g.__crmStore) {
    g.__crmStore = { customers: clone(SEED_CUSTOMERS), leads: clone(SEED_LEADS) };
  }
  return g.__crmStore;
}

const OPEN_STAGES: PipelineStage[] = ['novo', 'qualificacao', 'proposta', 'negociacao'];

function computeKpis(data: CrmData): CrmKpis {
  const ativos = data.customers.filter((c) => c.contrato.status === 'ativo');
  const abertos = data.leads.filter((l) => OPEN_STAGES.includes(l.stage));
  return {
    totalClientes: data.customers.length,
    clientesAtivos: ativos.length,
    mrrTotal: Math.round(ativos.reduce((s, c) => s + c.contrato.mrr, 0) * 100) / 100,
    emRiscoAlto: data.customers.filter((c) => c.churnRisk === 'alto').length,
    leadsAbertos: abertos.length,
    valorFunilAberto: Math.round(abertos.reduce((s, l) => s + l.valorMensal, 0) * 100) / 100,
  };
}

function toSummary(c: Customer): CustomerSummary {
  const { interacoes: _omit, ...rest } = c;
  void _omit;
  return rest;
}

export function getOverview(): CrmOverview {
  const data = db();
  const pipeline = PIPELINE_STAGES.map((s) => ({
    stage: s.id,
    label: s.label,
    leads: data.leads
      .filter((l) => l.stage === s.id)
      .sort((a, b) => b.valorMensal - a.valorMensal),
  }));
  const customers = [...data.customers].sort((a, b) => b.churnScore - a.churnScore).map(toSummary);
  return { kpis: computeKpis(data), customers, pipeline };
}

export function getCustomer(id: string): Customer | null {
  return db().customers.find((c) => c.id === id) ?? null;
}

export function moveLead(id: string, stage: PipelineStage): Lead | null {
  const lead = db().leads.find((l) => l.id === id);
  if (!lead) return null;
  lead.stage = stage;
  lead.ultimaAtividade = new Date().toISOString().slice(0, 10);
  return lead;
}

export function addInteraction(
  customerId: string,
  input: { tipo: InteractionType; resumo: string; autor: string },
): Interaction | null {
  const customer = db().customers.find((c) => c.id === customerId);
  if (!customer) return null;
  const interaction: Interaction = {
    id: `i${Date.now()}`,
    data: new Date().toISOString().slice(0, 10),
    tipo: input.tipo,
    resumo: input.resumo,
    autor: input.autor,
  };
  customer.interacoes.unshift(interaction);
  customer.ultimaInteracao = interaction.data;
  return interaction;
}
