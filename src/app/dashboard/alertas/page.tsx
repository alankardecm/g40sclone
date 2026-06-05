'use client';

import Sidebar from '@/components/Sidebar';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  RefreshCw,
  Clock,
  MessageSquare,
  Search,
  Hash,
  Smile,
  Meh,
  Frown,
  CircleDot,
  CheckCircle2,
} from 'lucide-react';

type SlaLevel = 'red' | 'yellow' | 'ok';

type Sentiment = {
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
  rationale?: string;
} | null;

type RecentMessage = { id: string; sender: string; timestamp: number; text: string };

type Conversation = {
  id: string;
  group_id: string;
  group_name: string;
  status: 'open' | 'closed';
  started_ts: number;
  started_at: string;
  protocols: string[];
  protocol_registered: boolean;
  message_count: number;
  participant_count: number;
  participants: string[];
  starter: string;
  last_sender: string;
  first_text: string;
  last_text: string;
  first_response_minutes: number | null;
  pending_unanswered_minutes: number;
  max_unanswered_minutes: number;
  duration_minutes: number;
  recent_messages: RecentMessage[];
  sla_level: SlaLevel;
  sentiment: Sentiment;
};

type GroupRow = { id: string; name: string };

type CockpitPayload = {
  ok?: boolean;
  error?: string;
  sla?: { yellow_minutes: number; red_minutes: number };
  cockpit_summary?: {
    waiting_total: number;
    waiting_red: number;
    waiting_yellow: number;
    open_total: number;
  };
  groups?: GroupRow[];
  conversations?: Conversation[];
};

function formatClock(ts: number): string {
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(ms));
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

const slaStyle: Record<SlaLevel, { dot: string; text: string; label: string }> = {
  red: { dot: 'bg-red-500', text: 'text-red-600', label: 'Crítico' },
  yellow: { dot: 'bg-yellow-400', text: 'text-yellow-700', label: 'Atenção' },
  ok: { dot: 'bg-stone-600', text: 'text-stone-600', label: 'Ok' },
};

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  if (!sentiment) {
    return <span className="text-[10px] text-stone-600">—</span>;
  }
  const map = {
    positive: { Icon: Smile, cls: 'text-emerald-600 border-emerald-500/20 bg-emerald-500/8', label: 'Positivo' },
    neutral: { Icon: Meh, cls: 'text-stone-700 border-black/10 bg-white/5', label: 'Neutro' },
    negative: { Icon: Frown, cls: 'text-red-600 border-red-500/20 bg-red-500/8', label: 'Negativo' },
  }[sentiment.sentiment];
  const { Icon } = map;
  return (
    <span
      title={sentiment.rationale || ''}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${map.cls}`}
    >
      <Icon className="h-3 w-3" />
      {map.label}
    </span>
  );
}

export default function CockpitConversas() {
  const [data, setData] = useState<CockpitPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<1 | 7 | 30>(1);
  const [groupId, setGroupId] = useState<string>('todos');
  const [query, setQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function load(days: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/wa-monitor/cockpit?days=${days}`);
      const json = (await res.json()) as CockpitPayload;
      if (json?.ok) {
        setData(json);
        setLastUpdated(new Date());
      }
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(period);
    const t = setInterval(() => load(period), 30_000);
    return () => clearInterval(t);
  }, [period]);

  const conversations = data?.conversations ?? [];
  const groups = data?.groups ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (groupId !== 'todos' && c.group_id !== groupId) return false;
      if (!q) return true;
      const haystack = [
        c.group_name,
        c.last_text,
        c.first_text,
        c.starter,
        c.last_sender,
        c.protocols.join(' '),
        c.participants.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [conversations, groupId, query]);

  const summary = data?.cockpit_summary;
  const sla = data?.sla;

  const kpis = [
    {
      label: 'Aguardando resposta',
      value: summary?.waiting_total ?? 0,
      color: (summary?.waiting_total ?? 0) > 0 ? 'text-red-600' : 'text-stone-600',
    },
    { label: 'Crítico (sem resposta)', value: summary?.waiting_red ?? 0, color: 'text-red-600' },
    { label: 'Em atenção', value: summary?.waiting_yellow ?? 0, color: 'text-yellow-700' },
    { label: 'Conversas abertas', value: summary?.open_total ?? 0, color: 'text-stone-700' },
  ];

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans antialiased">
      <Sidebar />
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-6 py-6 lg:px-10 flex flex-col gap-6 pb-16">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-black/5 bg-card px-8 py-6 shadow-xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-[#8DC63F]" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-600">
                    Hub Operacional
                  </p>
                  <h1 className="mt-0.5 text-xl font-[950] uppercase tracking-[-0.03em]">
                    Cockpit de Conversas
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => load(period)}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-stone-600 hover:text-stone-900 transition disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
                <div className="flex items-center gap-1 rounded-[20px] border border-black/10 bg-black/[0.03] p-1">
                  {([1, 7, 30] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setPeriod(d)}
                      className={`rounded-[16px] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                        period === d ? 'bg-[#8DC63F] text-black shadow-md' : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {d === 1 ? 'Hoje' : `${d}d`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="rounded-[22px] border border-black/5 bg-black/[0.03] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-600">{kpi.label}</p>
                  <p className={`mt-2 text-2xl font-[1000] tracking-[-0.05em] ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {sla && (
              <p className="mt-3 text-[10px] text-stone-600">
                SLA de resposta: <span className="text-yellow-700 font-black">atenção &gt; {sla.yellow_minutes} min</span>
                {' · '}
                <span className="text-red-600 font-black">crítico &gt; {sla.red_minutes} min</span> sem resposta
              </p>
            )}
          </motion.div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1.5 flex-1 min-w-[220px]">
              <Search className="h-3.5 w-3.5 text-stone-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por cliente, protocolo, grupo, participante..."
                className="bg-transparent text-[12px] text-stone-800 placeholder:text-stone-600 outline-none flex-1"
              />
            </div>
            {groups.length > 0 && (
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="rounded-full border border-black/10 bg-black/[0.03] px-4 py-1.5 text-[11px] font-bold text-stone-700 outline-none"
              >
                <option value="todos">Todos os grupos</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Lista */}
          {loading && !data ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 text-stone-600 mx-auto mb-3 animate-spin" />
                <p className="text-sm text-stone-600">Carregando conversas...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-[28px] border border-dashed border-black/10 bg-black/[0.02] flex items-center justify-center py-20"
            >
              <div className="text-center">
                <AlertCircle className="h-8 w-8 text-stone-600 mx-auto mb-3" />
                <p className="text-sm text-stone-600">Nenhuma conversa no período / filtro.</p>
                <p className="text-xs text-stone-600 mt-1">
                  {period === 1 ? 'Tente expandir para 7 ou 30 dias.' : 'Tudo tranquilo por aqui.'}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-3"
            >
              {filtered.map((c) => {
                const style = slaStyle[c.sla_level];
                const lastActivityTs = c.recent_messages.length
                  ? c.recent_messages[c.recent_messages.length - 1].timestamp
                  : c.started_ts;
                return (
                  <div
                    key={c.id}
                    className={`rounded-[24px] border px-5 py-4 ${
                      c.sla_level === 'red'
                        ? 'border-red-500/30 bg-red-500/[0.06]'
                        : c.sla_level === 'yellow'
                        ? 'border-yellow-500/25 bg-yellow-500/[0.05]'
                        : 'border-black/10 bg-black/[0.03]'
                    }`}
                  >
                    {/* Linha 1: grupo, status, tempo */}
                    <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] ${style.text}`}>
                          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                        <span className="text-[10px] font-black text-stone-800 uppercase tracking-[0.12em]">
                          {c.group_name}
                        </span>
                        {c.status === 'open' ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-600">
                            <CircleDot className="h-3 w-3" /> aberta
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.14em] text-stone-600">
                            <CheckCircle2 className="h-3 w-3" /> encerrada
                          </span>
                        )}
                        {c.protocols.map((p) => (
                          <span
                            key={p}
                            className="inline-flex items-center gap-1 rounded-full border border-[#8DC63F]/25 bg-[#8DC63F]/8 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#8DC63F]"
                          >
                            <Hash className="h-2.5 w-2.5" />
                            {p}
                          </span>
                        ))}
                      </div>
                      <SentimentBadge sentiment={c.sentiment} />
                    </div>

                    {/* Linha 2: tempo sem resposta em destaque */}
                    {c.status === 'open' && c.pending_unanswered_minutes > 0 && (
                      <div className={`flex items-center gap-1.5 mb-2 text-[11px] font-black ${style.text}`}>
                        <Clock className="h-3.5 w-3.5" />
                        Sem resposta há {formatDuration(c.pending_unanswered_minutes)}
                      </div>
                    )}

                    {/* Última mensagem */}
                    <p className="text-sm text-stone-700 leading-relaxed line-clamp-3">
                      <span className="text-stone-600">{c.last_sender}: </span>
                      {c.last_text}
                    </p>

                    {/* Rodapé */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-stone-600">
                      <span>{c.message_count} msgs · {c.participant_count} pessoas</span>
                      <span>início {formatClock(c.started_ts)}</span>
                      <span>última {formatClock(lastActivityTs)}</span>
                      {c.first_response_minutes !== null && (
                        <span>1ª resposta em {formatDuration(c.first_response_minutes)}</span>
                      )}
                      {c.max_unanswered_minutes > 0 && (
                        <span>maior silêncio {formatDuration(c.max_unanswered_minutes)}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {lastUpdated && (
                <p className="text-center text-[10px] text-stone-600 pt-2">
                  Última atualização: {lastUpdated.toLocaleTimeString('pt-BR')} · {filtered.length} conversas
                </p>
              )}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
