// Store do Inbox de Comunicação — MVP em memória (singleton no globalThis para
// sobreviver ao hot-reload). Mesma interface que uma futura implementação ligada
// à Evolution API (WhatsApp) deve expor.
import type {
  Conversation, ConversationSummary, InboxOverview, InboxStats, MessageAuthor,
} from '@/shared/types/inbox';
import { SEED_CONVERSATIONS } from '@/modules/communication/application/inbox-seed';

const clone = <T>(x: T): T =>
  (typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

const g = globalThis as unknown as { __inboxStore?: { conversas: Conversation[] } };
function db(): { conversas: Conversation[] } {
  if (!g.__inboxStore) g.__inboxStore = { conversas: clone(SEED_CONVERSATIONS) };
  return g.__inboxStore;
}

function stats(conversas: Conversation[]): InboxStats {
  return {
    abertas: conversas.filter((c) => c.status === 'aberto').length,
    aguardando: conversas.filter((c) => c.status === 'aguardando').length,
    resolvidasHoje: conversas.filter((c) => c.status === 'resolvido').length,
    naoLidasTotal: conversas.reduce((s, c) => s + c.naoLidas, 0),
  };
}

function toSummary(c: Conversation): ConversationSummary {
  const { mensagens, ...rest } = c;
  const ultima = mensagens[mensagens.length - 1];
  return { ...rest, previa: ultima ? ultima.texto : '' };
}

export function getInbox(): InboxOverview {
  const conversas = [...db().conversas].sort((a, b) => b.ultimaMensagemEm.localeCompare(a.ultimaMensagemEm));
  return { stats: stats(db().conversas), conversas: conversas.map(toSummary) };
}

export function getConversation(id: string): Conversation | null {
  return db().conversas.find((c) => c.id === id) ?? null;
}

export function markRead(id: string): void {
  const c = db().conversas.find((x) => x.id === id);
  if (c) c.naoLidas = 0;
}

export function reply(id: string, texto: string, autor: MessageAuthor = 'agente'): Conversation | null {
  const c = db().conversas.find((x) => x.id === id);
  if (!c) return null;
  const hora = new Date().toISOString();
  c.mensagens.push({ id: `m${Date.now()}`, direction: 'out', autor, texto, hora });
  c.ultimaMensagemEm = hora;
  c.naoLidas = 0;
  if (c.status === 'aberto') c.status = 'aguardando';
  return c;
}

export function resolve(id: string): Conversation | null {
  const c = db().conversas.find((x) => x.id === id);
  if (!c) return null;
  c.status = 'resolvido';
  c.naoLidas = 0;
  return c;
}
