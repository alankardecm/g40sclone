// Conversas de exemplo (seed) para o Inbox de Comunicação em modo MVP.
// Cenários típicos de provedor: suporte, cobrança, retenção e comercial.
// Alguns 'clienteId' apontam para clientes do CRM (modules/crm/seed) para demo integrada.
import type { Conversation } from '@/shared/types/inbox';

const hoje = new Date().toISOString().slice(0, 10);
const t = (h: string) => `${hoje}T${h}:00`;

export const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: 'cv01', clienteNome: 'Maria Aparecida Lima', telefone: '(45) 99876-5544', clienteId: 'c002',
    canal: 'whatsapp', assunto: 'Internet lenta à noite', categoria: 'suporte', status: 'aberto',
    naoLidas: 2, ultimaMensagemEm: t('20:41'),
    mensagens: [
      { id: 'm1', direction: 'in', autor: 'cliente', texto: 'Boa noite, de novo minha internet tá horrível depois das 20h. É a terceira vez esse mês.', hora: t('20:38') },
      { id: 'm2', direction: 'in', autor: 'cliente', texto: 'Assim não dá, vou acabar mudando de provedor.', hora: t('20:41') },
    ],
  },
  {
    id: 'cv02', clienteNome: 'Studio Bella Estética', telefone: '(45) 99700-4321', clienteId: 'c005',
    canal: 'whatsapp', assunto: 'Fatura em atraso (serviço suspenso)', categoria: 'cobranca', status: 'aguardando',
    naoLidas: 1, ultimaMensagemEm: t('14:05'),
    mensagens: [
      { id: 'm1', direction: 'out', autor: 'agente', texto: 'Olá! Identificamos 2 faturas em aberto e o serviço está suspenso. Podemos te ajudar a regularizar?', hora: t('11:00') },
      { id: 'm2', direction: 'in', autor: 'cliente', texto: 'Oi, esse mês apertou. Tem como parcelar ou dar uns dias?', hora: t('14:05') },
    ],
  },
  {
    id: 'cv03', clienteNome: 'João Pedro Nunes', telefone: '(45) 99611-2080', clienteId: 'c007',
    canal: 'whatsapp', assunto: 'Upgrade para 1GB', categoria: 'comercial', status: 'aberto',
    naoLidas: 1, ultimaMensagemEm: t('09:22'),
    mensagens: [
      { id: 'm1', direction: 'in', autor: 'cliente', texto: 'Bom dia! Quanto fica pra subir meu plano pra 1 giga?', hora: t('09:22') },
    ],
  },
  {
    id: 'cv04', clienteNome: 'Carlos Eduardo (não cliente)', telefone: '(45) 98123-7766',
    canal: 'whatsapp', assunto: 'Tem cobertura no meu endereço?', categoria: 'comercial', status: 'aberto',
    naoLidas: 1, ultimaMensagemEm: t('10:10'),
    mensagens: [
      { id: 'm1', direction: 'in', autor: 'cliente', texto: 'Oi, vocês atendem na Rua das Acácias, 120, centro de Toledo? Quero fibra.', hora: t('10:10') },
    ],
  },
  {
    id: 'cv05', clienteNome: 'Clínica Vida Plena', telefone: '(45) 98444-1212', clienteId: 'c008',
    canal: 'whatsapp', assunto: 'Quer cancelar — instabilidade no fim de semana', categoria: 'retencao', status: 'aberto',
    naoLidas: 3, ultimaMensagemEm: t('08:55'),
    mensagens: [
      { id: 'm1', direction: 'in', autor: 'cliente', texto: 'Bom dia. No fim de semana caiu de novo e atrapalhou nossos agendamentos online.', hora: t('08:50') },
      { id: 'm2', direction: 'in', autor: 'cliente', texto: 'Estamos avaliando trocar de operadora. Preciso de uma posição sobre o SLA.', hora: t('08:53') },
      { id: 'm3', direction: 'in', autor: 'cliente', texto: 'Podem me ligar hoje?', hora: t('08:55') },
    ],
  },
  {
    id: 'cv06', clienteNome: 'Auto Peças Veloz', telefone: '(45) 98812-0099', clienteId: 'c003',
    canal: 'whatsapp', assunto: '2ª via do boleto', categoria: 'cobranca', status: 'aberto',
    naoLidas: 1, ultimaMensagemEm: t('13:30'),
    mensagens: [
      { id: 'm1', direction: 'in', autor: 'cliente', texto: 'Perdi o boleto desse mês, consegue me mandar a 2ª via?', hora: t('13:30') },
    ],
  },
  {
    id: 'cv07', clienteNome: 'Mercado Central', telefone: '(45) 98800-7766', clienteId: 'c006',
    canal: 'whatsapp', assunto: 'Elogio + indicação', categoria: 'geral', status: 'resolvido',
    naoLidas: 0, ultimaMensagemEm: t('16:12'),
    mensagens: [
      { id: 'm1', direction: 'in', autor: 'cliente', texto: 'Tô muito satisfeito com a estabilidade. Indiquei dois vizinhos!', hora: t('16:00') },
      { id: 'm2', direction: 'out', autor: 'agente', texto: 'Que ótimo! Muito obrigado pela confiança e pelas indicações. 🙌', hora: t('16:12') },
    ],
  },
];
