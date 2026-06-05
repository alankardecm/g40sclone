export type WaConversationSourceMessage = {
  id: string;
  groupId: string;
  groupName: string;
  senderName?: string | null;
  senderJid?: string | null;
  text: string;
  timestamp: number;
};

export type WaConversationCloseReason = 'explicit_close' | 'inactivity';

export type WaConversationSessionStatus = 'open' | 'closed';

export type WaConversationSessionOptions = {
  nowTs?: number;
  sessionGapMinutes?: number;
  protocolAttachWindowMinutes?: number;
};

export type WaConversationSessionMessage = {
  id: string;
  sender: string;
  timestamp: number;
  text: string;
};

export type WaConversationProtocolMention = {
  protocol: string;
  message_id: string;
  sender: string;
  timestamp: number;
  evidence: string;
  source: 'regex' | 'ai';
  confidence?: number;
};

export type WaConversationLifecycleSession = {
  id: string;
  group_id: string;
  group_name: string;
  status: WaConversationSessionStatus;
  started_ts: number;
  started_at: string;
  closed_ts: number | null;
  closed_at: string | null;
  close_reason: WaConversationCloseReason | null;
  duration_minutes: number;
  protocol_registered: boolean;
  protocols: string[];
  protocol_mentions: WaConversationProtocolMention[];
  protocol_first_seen_ts: number | null;
  protocol_first_seen_at: string | null;
  message_count: number;
  participant_count: number;
  participants: string[];
  starter: string;
  last_sender: string;
  first_text: string;
  last_text: string;
  first_response_minutes: number | null;
  unanswered_until_close_minutes: number | null;
  max_unanswered_minutes: number;
  total_unanswered_minutes: number;
  pending_unanswered_minutes: number;
  max_no_activity_minutes: number;
  total_no_activity_minutes: number;
  message_ids: string[];
  recent_messages: WaConversationSessionMessage[];
};

const DEFAULT_SESSION_GAP_MINUTES = 90;
const DEFAULT_PROTOCOL_ATTACH_WINDOW_MINUTES = 45;

const PROTOCOL_PATTERNS = [
  /#\s*protocolo\s*[:#-]?\s*([a-z0-9][a-z0-9._-]{3,})/gi,
  /#\s*prot\s*[:#-]?\s*([a-z0-9][a-z0-9._-]{3,})/gi,
  /#(?:protocolo|prot)([a-z0-9][a-z0-9._-]{3,})\b/gi,
  /\b(?:protocolo|prot|ticket|chamado|os|notificacao|notificação|ocorrencia|ocorrência)\s*(?:n(?:o|um|umero)?\.?|numero|nº|#|:|-)?\s*([a-z]{0,5}\d{4,}[a-z0-9._-]*)\b/gi,
  // Formato "Protocolo ntt#124135": palavra-chave + separador opcional + prefixo#numero
  /\b(?:protocolo|prot|ticket|chamado|os|notificacao|notificação|ocorrencia|ocorrência)\s*[:#-]?\s*([a-z]{1,10}#\d{4,}[a-z0-9._-]*)\b/gi,
  // Formato standalone "ntt#124135" sem palavra-chave — prefixo curto + # + 4+ digitos
  /\b([a-z]{2,8}#\d{4,}[a-z0-9._-]*)\b/gi,
];

const CLOSE_PATTERNS = [
  /\b(resolvido|resolvida|encerrado|encerrada|finalizado|finalizada|fechado|fechada|concluido|concluida)\b/,
  /\b(pode fechar|pode encerrar|tudo certo|sem pendencia|sem pendencias|problema resolvido)\b/,
  /\b(ok obrigado|ok obrigada|obrigado|obrigada)\b/,
];

type SessionBuilder = {
  id: string;
  groupId: string;
  groupName: string;
  status: WaConversationSessionStatus;
  startedTs: number;
  closedTs: number | null;
  closeReason: WaConversationCloseReason | null;
  protocols: Set<string>;
  protocolMentions: WaConversationProtocolMention[];
  protocolFirstSeenTs: number | null;
  messageCount: number;
  participants: Map<string, string>;
  starterKey: string;
  starterName: string;
  lastSenderKey: string;
  lastSenderName: string;
  firstText: string;
  lastText: string;
  lastTs: number;
  awaitingSenderKey: string;
  awaitingSinceTs: number;
  firstResponseMinutes: number | null;
  turnWaitMinutes: number[];
  noActivityMinutes: number[];
  messageIds: string[];
  recentMessages: WaConversationSessionMessage[];
};

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeProtocol(value: string) {
  return String(value || '')
    .replace(/^#+/, '')
    .replace(/[^\da-z._-]/gi, '')
    .toUpperCase()
    .trim();
}

function minutesBetween(startTs: number, endTs: number) {
  return Math.max(0, Math.round((endTs - startTs) / 60));
}

function toIso(ts: number | null) {
  return ts ? new Date(ts * 1000).toISOString() : null;
}

function getSenderKey(message: WaConversationSourceMessage) {
  return String(message.senderJid || message.senderName || 'desconhecido').trim() || 'desconhecido';
}

function getSenderName(message: WaConversationSourceMessage) {
  return String(message.senderName || message.senderJid || 'Desconhecido').trim() || 'Desconhecido';
}

function addParticipant(session: SessionBuilder, key: string, name: string) {
  if (!session.participants.has(key)) {
    session.participants.set(key, name);
  }
}

function addProtocols(session: SessionBuilder, protocols: string[], timestamp: number) {
  for (const protocol of protocols) {
    session.protocols.add(protocol);
  }

  if (protocols.length > 0 && session.protocolFirstSeenTs === null) {
    session.protocolFirstSeenTs = timestamp;
  }
}

function addProtocolMention(
  session: SessionBuilder,
  message: WaConversationSourceMessage,
  protocol: string,
  source: 'regex' | 'ai' = 'regex',
  confidence?: number
) {
  const normalizedProtocol = normalizeProtocol(protocol);
  if (!normalizedProtocol) return;

  session.protocols.add(normalizedProtocol);
  if (session.protocolFirstSeenTs === null || message.timestamp < session.protocolFirstSeenTs) {
    session.protocolFirstSeenTs = message.timestamp;
  }

  const alreadyExists = session.protocolMentions.some(
    (mention) => mention.protocol === normalizedProtocol && mention.message_id === message.id && mention.source === source
  );
  if (alreadyExists) return;

  session.protocolMentions.push({
    protocol: normalizedProtocol,
    message_id: message.id,
    sender: getSenderName(message),
    timestamp: message.timestamp,
    evidence: message.text.slice(0, 240),
    source,
    confidence,
  });
}

function buildSessionId(message: WaConversationSourceMessage, sequence: number, protocols: string[]) {
  const protocolPart = protocols[0] || 'sem-protocolo';
  return `${message.groupId}:${message.timestamp}:${sequence}:${protocolPart}`;
}

function createSession(message: WaConversationSourceMessage, protocols: string[], sequence: number): SessionBuilder {
  const senderKey = getSenderKey(message);
  const senderName = getSenderName(message);
  const session: SessionBuilder = {
    id: buildSessionId(message, sequence, protocols),
    groupId: message.groupId,
    groupName: message.groupName,
    status: 'open',
    startedTs: message.timestamp,
    closedTs: null,
    closeReason: null,
    protocols: new Set(protocols),
    protocolMentions: [],
    protocolFirstSeenTs: protocols.length > 0 ? message.timestamp : null,
    messageCount: 0,
    participants: new Map(),
    starterKey: senderKey,
    starterName: senderName,
    lastSenderKey: senderKey,
    lastSenderName: senderName,
    firstText: message.text,
    lastText: message.text,
    lastTs: message.timestamp,
    awaitingSenderKey: senderKey,
    awaitingSinceTs: message.timestamp,
    firstResponseMinutes: null,
    turnWaitMinutes: [],
    noActivityMinutes: [],
    messageIds: [],
    recentMessages: [],
  };

  addMessageToSession(session, message, protocols);
  return session;
}

function addMessageToSession(session: SessionBuilder, message: WaConversationSourceMessage, protocols: string[]) {
  const senderKey = getSenderKey(message);
  const senderName = getSenderName(message);

  if (session.messageCount > 0) {
    const noActivity = minutesBetween(session.lastTs, message.timestamp);
    if (noActivity > 0) {
      session.noActivityMinutes.push(noActivity);
    }

    if (senderKey !== session.awaitingSenderKey) {
      const wait = minutesBetween(session.awaitingSinceTs, message.timestamp);
      if (wait > 0) {
        session.turnWaitMinutes.push(wait);
      }

      if (session.firstResponseMinutes === null && senderKey !== session.starterKey) {
        session.firstResponseMinutes = minutesBetween(session.startedTs, message.timestamp);
      }

      session.awaitingSenderKey = senderKey;
      session.awaitingSinceTs = message.timestamp;
    }
  }

  addParticipant(session, senderKey, senderName);
  addProtocols(session, protocols, message.timestamp);
  protocols.forEach((protocol) => addProtocolMention(session, message, protocol, 'regex'));

  session.messageCount += 1;
  session.messageIds.push(message.id);
  session.lastSenderKey = senderKey;
  session.lastSenderName = senderName;
  session.lastText = message.text;
  session.lastTs = message.timestamp;
  session.recentMessages.push({
    id: message.id,
    sender: senderName,
    timestamp: message.timestamp,
    text: message.text,
  });
  session.recentMessages = session.recentMessages.slice(-8);
}

function closeSession(session: SessionBuilder, closedTs: number, reason: WaConversationCloseReason) {
  if (session.status === 'closed') return;
  const closureGap = reason === 'inactivity' ? minutesBetween(session.lastTs, closedTs) : 0;
  if (closureGap > 0) {
    session.noActivityMinutes.push(closureGap);
  }
  session.status = 'closed';
  session.closedTs = closedTs;
  session.closeReason = reason;
}

function buildLifecycleSession(session: SessionBuilder, nowTs: number): WaConversationLifecycleSession {
  const endTs = session.closedTs || nowTs;
  const unansweredUntilClose =
    session.firstResponseMinutes === null ? minutesBetween(session.startedTs, endTs) : null;
  const pendingUnanswered =
    session.status === 'open' ? minutesBetween(session.awaitingSinceTs, nowTs) : 0;
  const totalTurnWait = session.turnWaitMinutes.reduce((sum, item) => sum + item, 0);
  const maxTurnWait = Math.max(0, ...session.turnWaitMinutes);
  const totalNoActivity = session.noActivityMinutes.reduce((sum, item) => sum + item, 0);
  const maxNoActivity = Math.max(0, ...session.noActivityMinutes);
  const protocols = [...session.protocols].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return {
    id: session.id,
    group_id: session.groupId,
    group_name: session.groupName,
    status: session.status,
    started_ts: session.startedTs,
    started_at: toIso(session.startedTs) || '',
    closed_ts: session.closedTs,
    closed_at: toIso(session.closedTs),
    close_reason: session.closeReason,
    duration_minutes: minutesBetween(session.startedTs, endTs),
    protocol_registered: protocols.length > 0,
    protocols,
    protocol_mentions: session.protocolMentions.sort((a, b) => a.timestamp - b.timestamp),
    protocol_first_seen_ts: session.protocolFirstSeenTs,
    protocol_first_seen_at: toIso(session.protocolFirstSeenTs),
    message_count: session.messageCount,
    participant_count: session.participants.size,
    participants: [...session.participants.values()],
    starter: session.starterName,
    last_sender: session.lastSenderName,
    first_text: session.firstText,
    last_text: session.lastText,
    first_response_minutes: session.firstResponseMinutes,
    unanswered_until_close_minutes: unansweredUntilClose,
    max_unanswered_minutes: Math.max(maxTurnWait, unansweredUntilClose || 0, pendingUnanswered),
    total_unanswered_minutes: totalTurnWait + (unansweredUntilClose || 0),
    pending_unanswered_minutes: pendingUnanswered,
    max_no_activity_minutes: maxNoActivity,
    total_no_activity_minutes: totalNoActivity,
    message_ids: session.messageIds,
    recent_messages: session.recentMessages,
  };
}

function chooseLatest(sessions: SessionBuilder[]) {
  return sessions.sort((a, b) => b.lastTs - a.lastTs)[0] || null;
}

function hasProtocolOverlap(session: SessionBuilder, protocols: string[]) {
  return protocols.some((protocol) => session.protocols.has(protocol));
}

export function extractProtocols(text: string) {
  const protocols = new Set<string>();
  for (const pattern of PROTOCOL_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match) {
      const protocol = normalizeProtocol(match[1] || '');
      if (protocol.length >= 4) {
        protocols.add(protocol);
      }
      match = pattern.exec(text);
    }
  }
  return [...protocols];
}

export function isConversationCloseText(text: string) {
  const normalized = normalizeText(text);
  return CLOSE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function inferWaConversationSessions(
  messages: WaConversationSourceMessage[],
  options: WaConversationSessionOptions = {}
) {
  const nowTs = options.nowTs || Math.floor(Date.now() / 1000);
  const sessionGapSeconds = Math.max(15, options.sessionGapMinutes || DEFAULT_SESSION_GAP_MINUTES) * 60;
  const protocolAttachSeconds =
    Math.max(5, options.protocolAttachWindowMinutes || DEFAULT_PROTOCOL_ATTACH_WINDOW_MINUTES) * 60;
  const sessions: SessionBuilder[] = [];
  const activeByGroup = new Map<string, SessionBuilder[]>();
  let sequence = 0;

  const orderedMessages = [...messages]
    .filter((message) => message.timestamp > 0 && String(message.text || '').trim())
    .sort((a, b) => a.groupId.localeCompare(b.groupId) || a.timestamp - b.timestamp);

  for (const message of orderedMessages) {
    const active = activeByGroup.get(message.groupId) || [];
    const stillActive: SessionBuilder[] = [];

    for (const session of active) {
      if (message.timestamp - session.lastTs > sessionGapSeconds) {
        closeSession(session, session.lastTs + sessionGapSeconds, 'inactivity');
      } else {
        stillActive.push(session);
      }
    }

    activeByGroup.set(message.groupId, stillActive);
    const protocols = extractProtocols(message.text);
    const closeText = isConversationCloseText(message.text);
    let target: SessionBuilder | null = null;

    if (protocols.length > 0) {
      target = chooseLatest(stillActive.filter((session) => hasProtocolOverlap(session, protocols)));
      if (!target) {
        target = chooseLatest(
          stillActive.filter(
            (session) => session.protocols.size === 0 && message.timestamp - session.lastTs <= protocolAttachSeconds
          )
        );
      }
    } else if (closeText && stillActive.length === 1) {
      target = stillActive[0];
    } else if (stillActive.length === 1 && message.timestamp - stillActive[0].lastTs <= sessionGapSeconds) {
      target = stillActive[0];
    } else {
      target = chooseLatest(
        stillActive.filter(
          (session) => session.protocols.size === 0 && message.timestamp - session.lastTs <= sessionGapSeconds
        )
      );
    }

    if (!target) {
      sequence += 1;
      target = createSession(message, protocols, sequence);
      sessions.push(target);
      stillActive.push(target);
    } else {
      addMessageToSession(target, message, protocols);
    }

    if (closeText) {
      closeSession(target, message.timestamp, 'explicit_close');
      activeByGroup.set(
        message.groupId,
        stillActive.filter((session) => session.id !== target.id)
      );
    }
  }

  for (const active of activeByGroup.values()) {
    for (const session of active) {
      if (nowTs - session.lastTs >= sessionGapSeconds) {
        closeSession(session, session.lastTs + sessionGapSeconds, 'inactivity');
      }
    }
  }

  return sessions
    .map((session) => buildLifecycleSession(session, nowTs))
    .sort((a, b) => b.started_ts - a.started_ts);
}
