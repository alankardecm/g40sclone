import { getSupabaseAdmin } from '@/lib/supabase';
import { classifySentimentWithGroq } from '@/lib/ai';
import {
  loadWaConversationSessions,
  WaConversationSessionQueryError,
  type WaConversationSessionQueryInput,
  type WaConversationSessionQueryResult,
} from '@/modules/communication/application/load-wa-conversation-sessions';
import type { WaConversationLifecycleSession } from '@/modules/communication/application/wa-conversation-sessions';

export type CockpitSlaLevel = 'red' | 'yellow' | 'ok';

export type CockpitSentiment = {
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
  rationale?: string;
} | null;

export type CockpitConversation = WaConversationLifecycleSession & {
  sla_level: CockpitSlaLevel;
  sentiment: CockpitSentiment;
};

export type CockpitQueryInput = WaConversationSessionQueryInput & {
  /** Minutos de espera para faixa amarela (default 5). */
  slaYellowMinutes?: number;
  /** Minutos de espera para faixa vermelha (default 10). */
  slaRedMinutes?: number;
  /** Habilita classificação de sentimento via LLM (default true). */
  withSentiment?: boolean;
  /** Teto de classificações LLM novas por requisição (default 12). */
  sentimentBudget?: number;
};

export type CockpitResult = Omit<WaConversationSessionQueryResult, 'sessions'> & {
  sla: { yellow_minutes: number; red_minutes: number };
  cockpit_summary: {
    waiting_total: number;
    waiting_red: number;
    waiting_yellow: number;
    open_total: number;
  };
  conversations: CockpitConversation[];
};

export { WaConversationSessionQueryError };

function sessionKey(session: WaConversationLifecycleSession) {
  return `${session.group_id}:${session.started_ts}`;
}

function resolveSlaLevel(
  session: WaConversationLifecycleSession,
  yellowMinutes: number,
  redMinutes: number
): CockpitSlaLevel {
  if (session.status !== 'open') return 'ok';
  const waiting = session.pending_unanswered_minutes;
  if (waiting >= redMinutes) return 'red';
  if (waiting >= yellowMinutes) return 'yellow';
  return 'ok';
}

type SentimentCacheRow = {
  session_key: string;
  sentiment: string | null;
  score: number | null;
  rationale: string | null;
  message_count: number | null;
};

/**
 * Classifica sentimento por conversa, com cache em wa_session_sentiment.
 * Tudo dentro de try/catch: se a tabela não existir ou o LLM falhar,
 * o cockpit continua funcionando com sentiment = null.
 */
async function attachSentiment(
  sessions: WaConversationLifecycleSession[],
  budget: number
): Promise<Map<string, CockpitSentiment>> {
  const result = new Map<string, CockpitSentiment>();
  // Só vale a pena classificar conversas com troca real de mensagens.
  const eligible = sessions.filter((s) => s.message_count >= 2);
  if (eligible.length === 0) return result;

  const supabase = getSupabaseAdmin();
  const keys = eligible.map(sessionKey);

  let cache = new Map<string, SentimentCacheRow>();
  try {
    const { data } = await supabase
      .from('wa_session_sentiment')
      .select('session_key, sentiment, score, rationale, message_count')
      .in('session_key', keys);
    cache = new Map((data || []).map((row) => [row.session_key, row as SentimentCacheRow]));
  } catch (err) {
    console.error('[cockpit] cache de sentimento indisponível:', err);
    return result; // sem cache e sem como persistir → não classifica
  }

  const toCompute: WaConversationLifecycleSession[] = [];
  for (const session of eligible) {
    const key = sessionKey(session);
    const cached = cache.get(key);
    // Reusa cache se já existe e a conversa não cresceu desde então.
    if (cached && (cached.message_count ?? 0) >= session.message_count && cached.sentiment) {
      result.set(key, {
        sentiment: cached.sentiment as 'positive' | 'neutral' | 'negative',
        score: Number(cached.score ?? 0),
        rationale: cached.rationale ?? undefined,
      });
    } else {
      toCompute.push(session);
    }
  }

  // Prioriza as conversas abertas e mais recentes dentro do orçamento.
  toCompute.sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || b.last_text.length - a.last_text.length);
  const batch = toCompute.slice(0, Math.max(0, budget));

  await Promise.all(
    batch.map(async (session) => {
      const key = sessionKey(session);
      const transcript = session.recent_messages
        .map((m) => `${m.sender}: ${m.text}`)
        .join('\n')
        .slice(0, 2000);
      if (!transcript.trim()) return;

      try {
        const classified = await classifySentimentWithGroq(transcript);
        if (!classified) return;
        const sentiment: CockpitSentiment = {
          sentiment: classified.sentiment,
          score: classified.score,
          rationale: classified.rationale,
        };
        result.set(key, sentiment);

        await supabase.from('wa_session_sentiment').upsert(
          {
            session_key: key,
            group_id: session.group_id,
            sentiment: classified.sentiment,
            score: classified.score,
            rationale: classified.rationale ?? null,
            message_count: session.message_count,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_key' }
        );
      } catch (err) {
        console.error('[cockpit] falha ao classificar sentimento da conversa:', err);
      }
    })
  );

  return result;
}

export async function loadConversationCockpit(input: CockpitQueryInput = {}): Promise<CockpitResult> {
  const yellowMinutes = Math.max(1, Number(input.slaYellowMinutes ?? 5));
  const redMinutes = Math.max(yellowMinutes + 1, Number(input.slaRedMinutes ?? 10));
  const withSentiment = input.withSentiment !== false;
  const sentimentBudget = Math.min(Math.max(Number(input.sentimentBudget ?? 12), 0), 40);

  const base = await loadWaConversationSessions(input);
  const { sessions, ...rest } = base;

  const sentimentByKey = withSentiment
    ? await attachSentiment(sessions, sentimentBudget)
    : new Map<string, CockpitSentiment>();

  const conversations: CockpitConversation[] = sessions.map((session) => ({
    ...session,
    sla_level: resolveSlaLevel(session, yellowMinutes, redMinutes),
    sentiment: sentimentByKey.get(sessionKey(session)) ?? null,
  }));

  // Ordena: vermelho → amarelo → resto; dentro de cada faixa, maior espera primeiro.
  const order: Record<CockpitSlaLevel, number> = { red: 0, yellow: 1, ok: 2 };
  conversations.sort((a, b) => {
    if (order[a.sla_level] !== order[b.sla_level]) return order[a.sla_level] - order[b.sla_level];
    return b.pending_unanswered_minutes - a.pending_unanswered_minutes;
  });

  const open = conversations.filter((c) => c.status === 'open');
  const waitingRed = conversations.filter((c) => c.sla_level === 'red').length;
  const waitingYellow = conversations.filter((c) => c.sla_level === 'yellow').length;

  return {
    ...rest,
    sla: { yellow_minutes: yellowMinutes, red_minutes: redMinutes },
    cockpit_summary: {
      waiting_total: waitingRed + waitingYellow,
      waiting_red: waitingRed,
      waiting_yellow: waitingYellow,
      open_total: open.length,
    },
    conversations,
  };
}
