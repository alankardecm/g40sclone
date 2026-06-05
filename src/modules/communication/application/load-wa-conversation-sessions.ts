import { getSupabaseAdmin } from '@/lib/supabase';
import { reviewWaConversationLifecycleWithAi } from '@/lib/ai';
import {
  inferWaConversationSessions,
  type WaConversationLifecycleSession,
  type WaConversationSourceMessage,
} from '@/modules/communication/application/wa-conversation-sessions';

type GroupRow = {
  id: string;
  name: string;
  whatsapp_jid?: string | null;
  is_active?: boolean | null;
};

type MessageRow = {
  id: string;
  group_id: string;
  sender_name: string | null;
  sender_jid: string | null;
  text_raw: string | null;
  msg_timestamp: number | null;
};

export type WaConversationSessionQueryInput = {
  groupId?: string | null;
  groupName?: string | null;
  days?: number;
  dateFrom?: string | null;
  dateTo?: string | null;
  sessionGapMinutes?: number;
  protocolAttachWindowMinutes?: number;
  aiReview?: boolean;
  maxAiMessages?: number;
  limit?: number;
};

export type WaConversationSessionQueryResult = {
  period: {
    days: number;
    date_from_ts: number;
    date_to_ts: number;
    date_from: string;
    date_to: string;
  };
  tuning: {
    session_gap_minutes: number;
    protocol_attach_window_minutes: number;
  };
  groups: GroupRow[];
  summary: {
    messages_analyzed: number;
    groups_analyzed: number;
    sessions_total: number;
    sessions_open: number;
    sessions_closed: number;
    sessions_with_protocol: number;
    sessions_without_protocol: number;
    sessions_without_response: number;
    avg_first_response_minutes: number | null;
    max_unanswered_minutes: number;
    total_unanswered_minutes: number;
    max_no_activity_minutes: number;
  };
  sessions: WaConversationLifecycleSession[];
  ai_review?: {
    enabled: boolean;
    reviewed_messages: number;
    missed_risks: string[];
  };
  truncated: boolean;
};

export class WaConversationSessionQueryError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function getSaoPauloDateString(date: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function timestampFromSaoPauloDate(dateStr: string, endOfDay = false) {
  const time = endOfDay ? '23:59:59' : '00:00:00';
  return Math.floor(new Date(`${dateStr}T${time}-03:00`).getTime() / 1000);
}

function toTimestamp(value: string | null | undefined, fallback: number, endOfDay = false) {
  if (!value) return fallback;
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return timestampFromSaoPauloDate(trimmed, endOfDay);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return Math.floor(parsed.getTime() / 1000);
}

function getDefaultPeriod(days: number) {
  const safeDays = Math.min(Math.max(days || 1, 1), 31);
  const todayStr = getSaoPauloDateString();
  const todayStart = timestampFromSaoPauloDate(todayStr);
  const fromDate = new Date(todayStart * 1000);
  fromDate.setDate(fromDate.getDate() - (safeDays - 1));
  const fromStr = getSaoPauloDateString(fromDate);

  return {
    days: safeDays,
    fromTs: timestampFromSaoPauloDate(fromStr),
    toTs: Math.floor(Date.now() / 1000),
  };
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, item) => sum + item, 0) / values.length).toFixed(1));
}

function max(values: number[]) {
  return values.length > 0 ? Math.max(...values) : 0;
}

function normalizeProtocol(value: string) {
  return String(value || '')
    .replace(/^#+/, '')
    .replace(/[^\da-z._-]/gi, '')
    .toUpperCase()
    .trim();
}

export async function loadWaConversationSessions(
  input: WaConversationSessionQueryInput = {}
): Promise<WaConversationSessionQueryResult> {
  const days = Math.min(Math.max(Number(input.days || 1) || 1, 1), 31);
  const defaults = getDefaultPeriod(days);
  const dateFromTs = toTimestamp(input.dateFrom, defaults.fromTs);
  const dateToTs = toTimestamp(input.dateTo, defaults.toTs, true);
  const nowTs = Math.min(Math.floor(Date.now() / 1000), dateToTs);
  const sessionGapMinutes = Math.min(Math.max(Number(input.sessionGapMinutes || 90) || 90, 15), 24 * 60);
  const protocolAttachWindowMinutes = Math.min(
    Math.max(Number(input.protocolAttachWindowMinutes || 45) || 45, 5),
    sessionGapMinutes
  );
  const maxAiMessages = Math.min(Math.max(Number(input.maxAiMessages || 40) || 40, 10), 120);
  const limit = Math.min(Math.max(Number(input.limit || 10000) || 10000, 100), 20000);
  const supabase = getSupabaseAdmin();

  let groupQuery = supabase
    .from('wa_groups')
    .select('id, name, whatsapp_jid, is_active')
    .order('name', { ascending: true });

  if (input.groupId) {
    groupQuery = groupQuery.eq('id', input.groupId).limit(1);
  } else if (input.groupName) {
    groupQuery = groupQuery.ilike('name', input.groupName).limit(10);
  } else {
    groupQuery = groupQuery.eq('is_active', true).limit(500);
  }

  const { data: groupRows, error: groupError } = await groupQuery;
  if (groupError) {
    throw new WaConversationSessionQueryError(groupError.message);
  }

  const groups = (groupRows || []) as GroupRow[];
  if (groups.length === 0) {
    throw new WaConversationSessionQueryError('Grupo nao encontrado para analise de conversas.', 404);
  }

  const groupById = new Map(groups.map((group) => [group.id, group]));
  // Busca as mensagens MAIS RECENTES da janela (desc + limit). O PostgREST
  // corta em ~1000 linhas; com ordem crescente pegaríamos as mais antigas e
  // nunca veríamos conversas abertas/aguardando resposta agora. O motor
  // (inferWaConversationSessions) reordena cronologicamente internamente.
  const { data: messageRows, error: messagesError } = await supabase
    .from('wa_messages')
    .select('id, group_id, sender_name, sender_jid, text_raw, msg_timestamp')
    .in('group_id', groups.map((group) => group.id))
    .gte('msg_timestamp', dateFromTs)
    .lte('msg_timestamp', dateToTs)
    .order('msg_timestamp', { ascending: false })
    .limit(limit);

  if (messagesError) {
    throw new WaConversationSessionQueryError(messagesError.message);
  }

  const rows = (messageRows || []) as MessageRow[];
  const messages: WaConversationSourceMessage[] = rows
    .filter((message) => typeof message.msg_timestamp === 'number')
    .map((message) => {
      const group = groupById.get(message.group_id);
      return {
        id: message.id,
        groupId: message.group_id,
        groupName: group?.name || 'Grupo',
        senderName: message.sender_name,
        senderJid: message.sender_jid,
        text: message.text_raw || '',
        timestamp: Number(message.msg_timestamp || 0),
      };
    });

  const sessions = inferWaConversationSessions(messages, {
    nowTs,
    sessionGapMinutes,
    protocolAttachWindowMinutes,
  });
  const messageById = new Map(messages.map((message) => [message.id, message]));
  const sessionByMessageId = new Map<string, WaConversationLifecycleSession>();

  sessions.forEach((session) => {
    session.message_ids.forEach((messageId) => sessionByMessageId.set(messageId, session));
  });

  let aiReview: WaConversationSessionQueryResult['ai_review'] | undefined;
  if (input.aiReview && messages.length > 0) {
    const reviewMessages = messages.slice(-maxAiMessages);
    const review = await reviewWaConversationLifecycleWithAi({
      messages: reviewMessages.map((message) => ({
        id: message.id,
        group_name: message.groupName,
        author: message.senderName || message.senderJid,
        text: message.text,
        timestamp: message.timestamp,
      })),
      sessions: sessions.slice(0, 25).map((session) => ({
        id: session.id,
        group_name: session.group_name,
        status: session.status,
        started_at: session.started_at,
        closed_at: session.closed_at,
        protocols: session.protocols,
        message_ids: session.message_ids,
      })),
    });

    (review?.protocol_mentions || []).forEach((mention) => {
      const protocol = normalizeProtocol(mention.protocol);
      if (!protocol || !mention.message_id) return;

      const session = sessionByMessageId.get(mention.message_id);
      const message = messageById.get(mention.message_id);
      if (!session || !message) return;

      if (!session.protocols.includes(protocol)) {
        session.protocols.push(protocol);
        session.protocols.sort((a, b) => a.localeCompare(b, 'pt-BR'));
      }

      session.protocol_registered = session.protocols.length > 0;
      if (session.protocol_first_seen_ts === null || message.timestamp < session.protocol_first_seen_ts) {
        session.protocol_first_seen_ts = message.timestamp;
        session.protocol_first_seen_at = new Date(message.timestamp * 1000).toISOString();
      }

      const alreadyExists = session.protocol_mentions.some(
        (item) => item.protocol === protocol && item.message_id === mention.message_id && item.source === 'ai'
      );
      if (!alreadyExists) {
        session.protocol_mentions.push({
          protocol,
          message_id: mention.message_id,
          sender: message.senderName || message.senderJid || 'Desconhecido',
          timestamp: message.timestamp,
          evidence: mention.evidence || message.text.slice(0, 240),
          source: 'ai',
          confidence: mention.confidence,
        });
      }
    });

    aiReview = {
      enabled: true,
      reviewed_messages: reviewMessages.length,
      missed_risks: review?.missed_risks || [],
    };
  }

  const firstResponseMinutes = sessions
    .map((session) => session.first_response_minutes)
    .filter((value): value is number => typeof value === 'number');
  const maxUnanswered = sessions.map((session) => session.max_unanswered_minutes);
  const maxNoActivity = sessions.map((session) => session.max_no_activity_minutes);

  return {
    period: {
      days,
      date_from_ts: dateFromTs,
      date_to_ts: dateToTs,
      date_from: new Date(dateFromTs * 1000).toISOString(),
      date_to: new Date(dateToTs * 1000).toISOString(),
    },
    tuning: {
      session_gap_minutes: sessionGapMinutes,
      protocol_attach_window_minutes: protocolAttachWindowMinutes,
    },
    groups,
    summary: {
      messages_analyzed: messages.length,
      groups_analyzed: groups.length,
      sessions_total: sessions.length,
      sessions_open: sessions.filter((session) => session.status === 'open').length,
      sessions_closed: sessions.filter((session) => session.status === 'closed').length,
      sessions_with_protocol: sessions.filter((session) => session.protocol_registered).length,
      sessions_without_protocol: sessions.filter((session) => !session.protocol_registered).length,
      sessions_without_response: sessions.filter((session) => session.first_response_minutes === null).length,
      avg_first_response_minutes: average(firstResponseMinutes),
      max_unanswered_minutes: max(maxUnanswered),
      total_unanswered_minutes: sessions.reduce((sum, session) => sum + session.total_unanswered_minutes, 0),
      max_no_activity_minutes: max(maxNoActivity),
    },
    sessions,
    ai_review: aiReview || { enabled: false, reviewed_messages: 0, missed_risks: [] },
    truncated: rows.length >= limit,
  };
}
