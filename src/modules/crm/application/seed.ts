// Dados de exemplo (seed) para o CRM em modo MVP. Realistas para um provedor regional.
// Trocar por Supabase/ERP depois implementando a mesma interface em crm-store.ts.
import type { Customer, Lead } from '@/shared/types/crm';

export const SEED_CUSTOMERS: Customer[] = [
  {
    id: 'c001', nome: 'Padaria Pão Quente', documento: '12.***.***/0001-90',
    cidade: 'Cascavel', uf: 'PR', telefone: '(45) 99101-2233', email: 'contato@paoquente.com',
    contrato: { plano: 'Empresa 500MB', mrr: 249.9, velocidadeMbps: 500, tecnologia: 'fibra', inicio: '2022-03-10', status: 'ativo' },
    csat: 92, protocolosAbertos: 0, churnRisk: 'baixo', churnScore: 12,
    tags: ['PME', 'fibra', 'adimplente'], desde: '2022-03-10', ultimaInteracao: '2026-05-28',
    interacoes: [
      { id: 'i1', data: '2026-05-28', tipo: 'whatsapp', resumo: 'Cliente elogiou estabilidade após upgrade.', autor: 'Suporte' },
      { id: 'i2', data: '2026-04-02', tipo: 'visita', resumo: 'Visita técnica preventiva — OK.', autor: 'Campo' },
    ],
  },
  {
    id: 'c002', nome: 'Maria Aparecida Lima', documento: '045.***.***-22',
    cidade: 'Toledo', uf: 'PR', telefone: '(45) 99876-5544', email: 'mariaap@gmail.com',
    contrato: { plano: 'Residencial 300MB', mrr: 99.9, velocidadeMbps: 300, tecnologia: 'fibra', inicio: '2024-08-01', status: 'ativo' },
    csat: 58, protocolosAbertos: 2, churnRisk: 'alto', churnScore: 78,
    tags: ['residencial', 'reclamação recorrente'], desde: '2024-08-01', ultimaInteracao: '2026-06-03',
    interacoes: [
      { id: 'i1', data: '2026-06-03', tipo: 'ligacao', resumo: 'Reclamou de lentidão à noite pela 3ª vez. Abriu protocolo.', autor: 'Suporte' },
      { id: 'i2', data: '2026-05-20', tipo: 'whatsapp', resumo: 'Pediu informação sobre planos concorrentes.', autor: 'Suporte' },
    ],
  },
  {
    id: 'c003', nome: 'Auto Peças Veloz Ltda', documento: '23.***.***/0001-05',
    cidade: 'Cascavel', uf: 'PR', telefone: '(45) 98812-0099', email: 'ti@veloz.com.br',
    contrato: { plano: 'Empresa 1GB Dedicado', mrr: 899.0, velocidadeMbps: 1000, tecnologia: 'fibra', inicio: '2021-11-15', status: 'ativo' },
    csat: 85, protocolosAbertos: 1, churnRisk: 'medio', churnScore: 44,
    tags: ['PME', 'link dedicado', 'SLA'], desde: '2021-11-15', ultimaInteracao: '2026-05-30',
    interacoes: [
      { id: 'i1', data: '2026-05-30', tipo: 'email', resumo: 'Solicitou relatório de disponibilidade do mês (SLA).', autor: 'Comercial' },
    ],
  },
  {
    id: 'c004', nome: 'Sítio Boa Esperança', documento: '67.***.***/0001-31',
    cidade: 'Marechal Cândido Rondon', uf: 'PR', telefone: '(45) 99933-1100',
    contrato: { plano: 'Rural 100MB', mrr: 149.9, velocidadeMbps: 100, tecnologia: 'radio', inicio: '2023-05-20', status: 'ativo' },
    csat: 70, protocolosAbertos: 0, churnRisk: 'medio', churnScore: 51,
    tags: ['rural', 'agro', 'rádio'], desde: '2023-05-20', ultimaInteracao: '2026-03-11',
    interacoes: [
      { id: 'i1', data: '2026-03-11', tipo: 'visita', resumo: 'Reposicionamento de antena após temporal.', autor: 'Campo' },
    ],
  },
  {
    id: 'c005', nome: 'Studio Bella Estética', documento: '88.***.***/0001-77',
    cidade: 'Toledo', uf: 'PR', telefone: '(45) 99700-4321', email: 'contato@bellaestetica.com',
    contrato: { plano: 'Empresa 500MB', mrr: 249.9, velocidadeMbps: 500, tecnologia: 'fibra', inicio: '2025-01-09', status: 'suspenso' },
    csat: 40, protocolosAbertos: 1, churnRisk: 'alto', churnScore: 84,
    tags: ['PME', 'inadimplente'], desde: '2025-01-09', ultimaInteracao: '2026-06-01',
    interacoes: [
      { id: 'i1', data: '2026-06-01', tipo: 'whatsapp', resumo: 'Suspenso por falta de pagamento (2 faturas). Negociação em aberto.', autor: 'Financeiro' },
    ],
  },
  {
    id: 'c006', nome: 'Mercado Central', documento: '34.***.***/0001-12',
    cidade: 'Cascavel', uf: 'PR', telefone: '(45) 98800-7766', email: 'gerencia@mercadocentral.com',
    contrato: { plano: 'Empresa 700MB', mrr: 349.9, velocidadeMbps: 700, tecnologia: 'fibra', inicio: '2020-06-01', status: 'ativo' },
    csat: 95, protocolosAbertos: 0, churnRisk: 'baixo', churnScore: 8,
    tags: ['PME', 'cliente antigo', 'promotor'], desde: '2020-06-01', ultimaInteracao: '2026-05-15',
    interacoes: [
      { id: 'i1', data: '2026-05-15', tipo: 'nota', resumo: 'Indicou 2 novos clientes (programa de indicação).', autor: 'Comercial' },
    ],
  },
  {
    id: 'c007', nome: 'João Pedro Nunes', documento: '102.***.***-08',
    cidade: 'Toledo', uf: 'PR', telefone: '(45) 99611-2080',
    contrato: { plano: 'Residencial 600MB', mrr: 129.9, velocidadeMbps: 600, tecnologia: 'fibra', inicio: '2025-09-12', status: 'ativo' },
    csat: 80, protocolosAbertos: 0, churnRisk: 'baixo', churnScore: 20,
    tags: ['residencial', 'gamer'], desde: '2025-09-12', ultimaInteracao: '2026-04-22',
    interacoes: [
      { id: 'i1', data: '2026-04-22', tipo: 'whatsapp', resumo: 'Perguntou sobre upgrade para 1GB.', autor: 'Comercial' },
    ],
  },
  {
    id: 'c008', nome: 'Clínica Vida Plena', documento: '45.***.***/0001-66',
    cidade: 'Cascavel', uf: 'PR', telefone: '(45) 98444-1212', email: 'ti@vidaplena.com.br',
    contrato: { plano: 'Empresa 1GB', mrr: 599.0, velocidadeMbps: 1000, tecnologia: 'fibra', inicio: '2023-02-28', status: 'ativo' },
    csat: 66, protocolosAbertos: 3, churnRisk: 'alto', churnScore: 72,
    tags: ['PME', 'saúde', 'SLA', 'protocolos abertos'], desde: '2023-02-28', ultimaInteracao: '2026-06-04',
    interacoes: [
      { id: 'i1', data: '2026-06-04', tipo: 'ligacao', resumo: 'Instabilidade no fim de semana afetou agendamento online. Cliente irritado.', autor: 'NOC' },
      { id: 'i2', data: '2026-05-25', tipo: 'email', resumo: 'Cobrou retorno sobre SLA do mês anterior.', autor: 'Comercial' },
    ],
  },
];

export const SEED_LEADS: Lead[] = [
  { id: 'l01', nome: 'Restaurante Sabor & Arte', cidade: 'Cascavel', uf: 'PR', origem: 'Indicação', valorMensal: 349.9, stage: 'novo', responsavel: 'Ana', telefone: '(45) 99000-1111', criadoEm: '2026-06-02', ultimaAtividade: '2026-06-02' },
  { id: 'l02', nome: 'Condomínio Jardins', cidade: 'Toledo', uf: 'PR', origem: 'Site', valorMensal: 1200, stage: 'novo', responsavel: 'Bruno', email: 'sindico@jardins.com', criadoEm: '2026-06-01', ultimaAtividade: '2026-06-03' },
  { id: 'l03', nome: 'Oficina do Léo', cidade: 'Cascavel', uf: 'PR', origem: 'Porta a porta', valorMensal: 199.9, stage: 'qualificacao', responsavel: 'Ana', telefone: '(45) 99222-3344', criadoEm: '2026-05-28', ultimaAtividade: '2026-06-02', observacao: 'Tem contrato com concorrente até julho.' },
  { id: 'l04', nome: 'Escola Aprender+', cidade: 'Marechal C. Rondon', uf: 'PR', origem: 'Anúncio', valorMensal: 699, stage: 'qualificacao', responsavel: 'Bruno', criadoEm: '2026-05-26', ultimaAtividade: '2026-06-01' },
  { id: 'l05', nome: 'Farmácia Saúde Já', cidade: 'Cascavel', uf: 'PR', origem: 'Indicação', valorMensal: 299.9, stage: 'proposta', responsavel: 'Ana', telefone: '(45) 99777-8888', criadoEm: '2026-05-20', ultimaAtividade: '2026-06-04', observacao: 'Proposta enviada — 500MB com IP fixo.' },
  { id: 'l06', nome: 'Coworking Hub45', cidade: 'Toledo', uf: 'PR', origem: 'Site', valorMensal: 1500, stage: 'proposta', responsavel: 'Bruno', email: 'contato@hub45.com', criadoEm: '2026-05-18', ultimaAtividade: '2026-06-03' },
  { id: 'l07', nome: 'Transportadora RotaSul', cidade: 'Cascavel', uf: 'PR', origem: 'Indicação', valorMensal: 2200, stage: 'negociacao', responsavel: 'Bruno', telefone: '(45) 98111-2222', criadoEm: '2026-05-10', ultimaAtividade: '2026-06-04', observacao: 'Negociando SLA e desconto por fidelidade de 24 meses.' },
  { id: 'l08', nome: 'Hotel Cataratas Center', cidade: 'Foz do Iguaçu', uf: 'PR', origem: 'Evento', valorMensal: 3500, stage: 'negociacao', responsavel: 'Ana', email: 'ti@cataratascenter.com', criadoEm: '2026-04-30', ultimaAtividade: '2026-06-02' },
  { id: 'l09', nome: 'Pet Shop Amigo Fiel', cidade: 'Toledo', uf: 'PR', origem: 'Porta a porta', valorMensal: 149.9, stage: 'ganho', responsavel: 'Ana', criadoEm: '2026-04-15', ultimaAtividade: '2026-05-22', observacao: 'Fechou plano 300MB. Instalação agendada.' },
  { id: 'l10', nome: 'Imobiliária Lar Ideal', cidade: 'Cascavel', uf: 'PR', origem: 'Site', valorMensal: 399, stage: 'ganho', responsavel: 'Bruno', criadoEm: '2026-04-10', ultimaAtividade: '2026-05-18' },
  { id: 'l11', nome: 'Lanchonete do Zé', cidade: 'Toledo', uf: 'PR', origem: 'Anúncio', valorMensal: 129.9, stage: 'perdido', responsavel: 'Ana', criadoEm: '2026-04-08', ultimaAtividade: '2026-05-05', observacao: 'Perdido por preço — foi para concorrente local.' },
  { id: 'l12', nome: 'Academia Corpo&Ação', cidade: 'Cascavel', uf: 'PR', origem: 'Indicação', valorMensal: 299, stage: 'perdido', responsavel: 'Bruno', criadoEm: '2026-03-28', ultimaAtividade: '2026-04-20', observacao: 'Sem cobertura de fibra no endereço.' },
];
