// Tipos do Inbox de Comunicação (atendimento ao cliente final).
// MVP em memória; pronto para ligar na Evolution API (WhatsApp) depois.
// Distinto do Assistente de IA (que fala com a equipe): aqui a IA fala COM o assinante.

export type ConversationStatus = 'aberto' | 'aguardando' | 'resolvido';
export type ConversationCategory = 'suporte' | 'cobranca' | 'retencao' | 'comercial' | 'geral';
export type MessageDirection = 'in' | 'out';
export type MessageAuthor = 'cliente' | 'agente' | 'ia';

export interface InboxMessage {
  id: string;
  direction: MessageDirection;  // in = do cliente, out = do provedor
  autor: MessageAuthor;
  texto: string;
  hora: string;                 // ISO
}

export interface Conversation {
  id: string;
  clienteNome: string;
  telefone: string;
  clienteId?: string;           // vínculo opcional com o CRM (Customer.id)
  canal: 'whatsapp';
  assunto: string;
  categoria: ConversationCategory;
  status: ConversationStatus;
  naoLidas: number;
  ultimaMensagemEm: string;     // ISO
  mensagens: InboxMessage[];
}

export type ConversationSummary = Omit<Conversation, 'mensagens'> & { previa: string };

export interface InboxStats {
  abertas: number;
  aguardando: number;
  resolvidasHoje: number;
  naoLidasTotal: number;
}

export interface InboxOverview {
  stats: InboxStats;
  conversas: ConversationSummary[];
}

export interface AgentSuggestion {
  source: 'ai' | 'fallback';
  texto: string;
}
