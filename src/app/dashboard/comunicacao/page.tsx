'use client';

import Sidebar from '@/components/Sidebar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  BadgeInfo,
  Bot,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  Mail,
  MessageSquareText,
  Mic,
  RefreshCw,
  Sparkles,
  Square,
  TriangleAlert,
  Volume2,
} from 'lucide-react';

// ── Constantes ────────────────────────────────────────────────────────────────

const GROUP_SELECTION_STORAGE_KEY = 'netturbo-wa-selected-groups';

const RESOLVED_WORDS = [
  'obrigado', 'obrigada', 'resolvido', 'encerrado', 'perfeito', 'ótimo', 'otimo',
  'ate mais', 'até mais', 'tchau', 'finalizado', 'foi resolvido', 'problema resolvido',
  'ok, obrigado', 'ok! obrigado', 'tudo certo', 'pode fechar',
];

// ── Tipos ─────────────────────────────────────────────────────────────────────

type MsgItem = {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  urgency?: string;
  keywords?: string[];
};

type ConversationItem = {
  group_id?: string;
  group_name?: string;
  count?: number;
  last_text?: string;
  last_at?: string;
  last_ts?: number;
  negative_count?: number;
  recent_messages?: MsgItem[];
};

type LiveGroupItem = {
  id?: string;
  name?: string;
  group_name?: string;
  is_active?: boolean;
  today_messages?: {
    count?: number;
    first_msg_timestamp?: number | null;
    last_msg_timestamp?: number | null;
  };
  latest_message?: { msg_timestamp?: number | null; created_at?: string } | null;
};

type GroupBriefPayload = {
  group?: { id?: string; name?: string };
  period?: { days?: number; date_from?: string; date_to?: string };
  metrics?: {
    messages?: number;
    participants?: number;
    urgent_count?: number;
    sentiment_breakdown?: { positive?: number; neutral?: number; negative?: number };
    top_keywords?: Array<{ term?: string; count?: number }>;
  };
  brief?: {
    sentiment?: 'positive' | 'neutral' | 'negative';
    score?: number;
    title?: string;
    summary?: string;
    highlights?: string[];
    risks?: string[];
    next_steps?: string[];
    keywords?: string[];
    audio_script?: string;
    model_used?: string;
  };
};

type StoredInsightItem = {
  id?: string;
  group_name?: string;
  group?: string;
  executive_summary?: string;
  sentiment_label?: 'positive' | 'neutral' | 'negative';
  primary_keyword?: string;
  urgency_label?: string;
  date?: string;
  total_messages?: number;
};

type LiveInsightsPayload = {
  summary?: {
    messages_7d?: number;
    groups_active?: number;
    sentiment_average?: number;
    positive?: number;
    neutral?: number;
    negative?: number;
    urgent?: number;
  };
  top_keywords?: Array<{ term?: string; count?: number }>;
  conversations?: ConversationItem[];
  stored_insights?: StoredInsightItem[];
};

type ConversationSessionItem = {
  id?: string;
  group_name?: string;
  status?: 'open' | 'closed';
  protocol_registered?: boolean;
  protocols?: string[];
  protocol_mentions?: Array<{
    protocol?: string;
    message_id?: string;
    sender?: string;
    timestamp?: number;
    evidence?: string;
    source?: 'regex' | 'ai';
    confidence?: number;
  }>;
  started_at?: string;
  closed_at?: string | null;
  duration_minutes?: number;
  first_response_minutes?: number | null;
  max_unanswered_minutes?: number;
  pending_unanswered_minutes?: number;
  message_count?: number;
  starter?: string;
  last_sender?: string;
};

type ConversationSessionsPayload = {
  summary?: {
    sessions_total?: number;
    sessions_open?: number;
    sessions_closed?: number;
    sessions_with_protocol?: number;
    sessions_without_protocol?: number;
    sessions_without_response?: number;
    avg_first_response_minutes?: number | null;
    max_unanswered_minutes?: number;
  };
  sessions?: ConversationSessionItem[];
  ai_review?: {
    enabled?: boolean;
    reviewed_messages?: number;
    missed_risks?: string[];
  };
};

type OutlookStatusPayload = {
  ok?: boolean;
  configured?: boolean;
  connected?: boolean;
  account?: { name?: string | null; email?: string | null } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeGroup(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function formatTime(ts: number): string {
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(ms));
}

function minutesSince(ts: number | string | undefined): number {
  if (!ts) return 0;
  const ms = typeof ts === 'number' ? (ts > 1e12 ? ts : ts * 1000) : new Date(ts).getTime();
  return Math.floor((Date.now() - ms) / 60_000);
}

function isBusinessHoursSP(): boolean {
  const now = new Date();
  const h = parseInt(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(now));
  const day = now.getDay();
  return day >= 1 && day <= 5 && h >= 8 && h < 18;
}

function detectUnanswered(conv: ConversationItem): { flagged: boolean; minutesAgo: number } {
  const ref = conv.last_ts || (conv.last_at ? Math.floor(new Date(conv.last_at).getTime() / 1000) : 0);
  if (!ref) return { flagged: false, minutesAgo: 0 };

  const minutesAgo = minutesSince(ref);
  if (minutesAgo < 45) return { flagged: false, minutesAgo };
  if (!isBusinessHoursSP()) return { flagged: false, minutesAgo };

  const lastText = (conv.last_text || '').toLowerCase();
  if (RESOLVED_WORDS.some((w) => lastText.includes(w))) return { flagged: false, minutesAgo };

  return { flagged: true, minutesAgo };
}

const sentimentStyle: Record<string, string> = {
  positive: 'text-green-400 bg-green-500/10 border-green-500/20',
  neutral: 'text-muted-foreground bg-card/5 border-white/10',
  negative: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const sentimentDot: Record<string, string> = {
  positive: 'bg-green-400',
  neutral: 'bg-stone-400',
  negative: 'bg-red-400',
};

const urgencyStyle: Record<string, string> = {
  critica: 'text-red-400',
  alta: 'text-orange-400',
  media: 'text-yellow-400',
  baixa: 'text-muted-foreground',
};

// ── Componente MsgBubble ──────────────────────────────────────────────────────

function MsgBubble({ msg }: { msg: MsgItem }) {
  const sent = msg.sentiment || 'neutral';
  return (
    <div className="flex gap-2.5 items-start">
      <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${sentimentDot[sent] || 'bg-stone-500'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#364642] truncate max-w-[180px]">
            {msg.sender}
          </span>
          <span className="text-[10px] font-semibold text-foreground">{formatTime(msg.timestamp)}</span>
          {msg.urgency && msg.urgency !== 'baixa' && (
            <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${urgencyStyle[msg.urgency] || 'text-muted-foreground'}`}>
              {msg.urgency}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] text-foreground leading-relaxed break-words">{msg.text}</p>
      </div>
    </div>
  );
}

// ── Componente ConversationCard ───────────────────────────────────────────────

function ConversationCard({ conv, onBrief, briefLoading }: {
  conv: ConversationItem;
  onBrief: (name: string) => void;
  briefLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const name = conv.group_name || 'Grupo interno';
  const msgs = conv.recent_messages || [];
  const hasNeg = (conv.negative_count || 0) > 0;
  const { flagged: unanswered, minutesAgo } = detectUnanswered(conv);

  return (
    <div className={`rounded-[28px] border overflow-hidden transition-all ${
      hasNeg ? 'border-red-300 bg-red-50/90' : unanswered ? 'border-yellow-300 bg-yellow-50/90' : 'border-[#d8e9e6] bg-card/90'
    }`}>
      {/* Header */}
      <div className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-[#f3faf8] transition-colors">
        <button
          type="button"
          className="flex flex-1 items-center gap-3 min-w-0 text-left"
          onClick={() => setExpanded((e) => !e)}
        >
          <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${hasNeg ? 'bg-red-400 animate-pulse' : unanswered ? 'bg-yellow-400 animate-pulse' : (conv.count || 0) > 0 ? 'bg-green-400' : 'bg-stone-600'}`} />
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-[0.12em] text-[#243b38] leading-tight truncate">{name}</p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] font-medium text-foreground">
              <span>{conv.count || 0} msgs</span>
              {conv.last_ts ? <span>· última às {formatTime(conv.last_ts)}</span> : null}
              {hasNeg ? (
                <span className="text-red-400 font-black">{conv.negative_count} negativas</span>
              ) : null}
              {unanswered ? (
                <span className="text-yellow-700 font-black">⚠ sem atividade há {minutesAgo}min</span>
              ) : null}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onBrief(name); }}
            disabled={briefLoading}
            className="inline-flex items-center gap-1 rounded-full border border-[#b7d8d4] bg-[#eef8f7] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#1f7f78] hover:bg-[#dff1ef] transition disabled:opacity-50"
          >
            {briefLoading ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Mic className="h-3 w-3" />}
            Brief
          </button>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="rounded-full p-1 hover:bg-[#e8f4f2] transition"
            aria-label={expanded ? 'Recolher conversa' : 'Expandir conversa'}
          >
            {expanded ? <ChevronUp className="h-4 w-4 text-foreground" /> : <ChevronDown className="h-4 w-4 text-foreground" />}
          </button>
        </div>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {expanded && msgs.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-3 border-t border-[#e1eeeb] bg-card/70 pt-3 max-h-[320px] overflow-y-auto custom-scrollbar">
              {msgs.map((msg) => (
                <MsgBubble key={msg.id} msg={msg} />
              ))}
              {unanswered && (
                <div className="flex items-center gap-2 rounded-[16px] border border-yellow-300 bg-yellow-50 px-4 py-2.5">
                  <AlertCircle className="h-3.5 w-3.5 text-yellow-700 shrink-0" />
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-yellow-700">
                    Atenção: sem atividade há {minutesAgo}min
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
        {expanded && msgs.length === 0 && (
          <div className="px-5 pb-4 pt-3 border-t border-[#e1eeeb] text-[11px] text-foreground">
            Sem mensagens no período selecionado.
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ComunicacaoDashboard() {
  const [liveData, setLiveData] = useState<LiveInsightsPayload | null>(null);
  const [sessionData, setSessionData] = useState<ConversationSessionsPayload | null>(null);
  const [liveGroups, setLiveGroups] = useState<LiveGroupItem[]>([]);
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<string[]>([]);
  const [groupSelectionHydrated, setGroupSelectionHydrated] = useState(false);
  const [hasStoredGroupSelection, setHasStoredGroupSelection] = useState(false);
  const [insightDays, setInsightDays] = useState<1 | 7 | 30>(1);
  const [exportDays, setExportDays] = useState<7 | 15 | 30>(7);
  const [aiLifecycleReview, setAiLifecycleReview] = useState(false);
  const [aiLifecycleLoading, setAiLifecycleLoading] = useState(false);
  const [aiLifecycleError, setAiLifecycleError] = useState('');

  const [audioError, setAudioError] = useState('');
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [audioMode, setAudioMode] = useState<'server' | 'browser'>('browser');
  const [groupBriefLoadingKey, setGroupBriefLoadingKey] = useState<string | null>(null);
  const [groupBriefError, setGroupBriefError] = useState('');
  const [selectedGroupBrief, setSelectedGroupBrief] = useState<GroupBriefPayload | null>(null);

  const [outlookStatus, setOutlookStatus] = useState<OutlookStatusPayload | null>(null);
  const [outlookSyncing, setOutlookSyncing] = useState(false);
  const [outlookSwitching, setOutlookSwitching] = useState(false);
  const [outlookMessage, setOutlookMessage] = useState('');
  const [outlookError, setOutlookError] = useState('');

  const [showExport, setShowExport] = useState(false);
  const [showOutlook, setShowOutlook] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);

  const serverAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastLiveTsRef = useRef<number>(Math.floor(Date.now() / 1000) - 60);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [insightsRes, groupsRes, sessionsRes, outlookRes] = await Promise.all([
          fetch(`/api/wa-monitor/insights?days=${insightDays}`),
          fetch('/api/wa-monitor/groups'),
          fetch(`/api/wa-monitor/conversation-sessions?days=${insightDays}&limit=5000`),
          fetch('/api/communications/outlook/status'),
        ]);
        const insightsData = await insightsRes.json();
        const groupsData = await groupsRes.json();
        const sessionsData = await sessionsRes.json();
        const outlookData = await outlookRes.json();
        if (alive && insightsData?.ok) setLiveData(insightsData);
        if (alive && groupsData?.ok) setLiveGroups(groupsData.groups || []);
        if (alive && sessionsData?.ok) setSessionData(sessionsData);
        if (alive && outlookData?.ok) setOutlookStatus(outlookData);
      } catch { /* silencioso */ }
    }
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, [insightDays]);

  // ── Hidratação de seleção de grupos ──────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(GROUP_SELECTION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSelectedGroupKeys(parsed.map((i) => normalizeGroup(String(i))).filter(Boolean));
          setHasStoredGroupSelection(true);
        }
      }
    } catch { window.localStorage.removeItem(GROUP_SELECTION_STORAGE_KEY); }
    finally { setGroupSelectionHydrated(true); }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('outlook_connected') === '1') setOutlookMessage('Conta Outlook conectada.');
    if (params.get('outlook_error')) setOutlookError(decodeURIComponent(params.get('outlook_error')!));
  }, []);

  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  // ── SSE ao vivo ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      es = new EventSource(`/api/wa-monitor/live?since_ts=${lastLiveTsRef.current}`);

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type: string; count?: number; last_ts?: number;
          };
          if (data.type === 'connected' || data.type === 'heartbeat') {
            setLiveConnected(true);
          } else if (data.type === 'messages' && (data.count ?? 0) > 0) {
            setLiveConnected(true);
            setNewMsgCount((c) => c + (data.count ?? 0));
            if (data.last_ts) lastLiveTsRef.current = data.last_ts;
          } else if (data.type === 'error') {
            setLiveConnected(false);
          }
        } catch { /* silencioso */ }
      };

      es.onerror = () => {
        setLiveConnected(false);
        es?.close();
        retryTimer = setTimeout(connect, 15_000);
      };
    }

    connect();
    return () => {
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
      setLiveConnected(false);
    };
  }, []);

  // ── Grupos ────────────────────────────────────────────────────────────────────

  const allGroups = useMemo(() => {
    const map = new Map<string, { key: string; id: string; name: string; todayCount: number }>();
    liveGroups.forEach((g) => {
      const name = g?.name || g?.group_name || '';
      const key = normalizeGroup(name);
      if (!key) return;
      map.set(key, { key, id: g.id || '', name, todayCount: Number(g.today_messages?.count || 0) });
    });
    return [...map.values()].sort((a, b) => b.todayCount - a.todayCount || a.name.localeCompare(b.name, 'pt-BR'));
  }, [liveGroups]);

  useEffect(() => {
    if (!groupSelectionHydrated) return;
    const available = allGroups.map((g) => g.key);
    if (!available.length) return;
    setSelectedGroupKeys((cur) => (!hasStoredGroupSelection ? available : cur.filter((k) => available.includes(k))));
  }, [allGroups, groupSelectionHydrated, hasStoredGroupSelection]);

  useEffect(() => {
    if (!groupSelectionHydrated || typeof window === 'undefined') return;
    window.localStorage.setItem(GROUP_SELECTION_STORAGE_KEY, JSON.stringify(selectedGroupKeys));
  }, [selectedGroupKeys, groupSelectionHydrated]);

  const selectedKeySet = useMemo(() => new Set(selectedGroupKeys), [selectedGroupKeys]);

  function toggleGroup(k: string) {
    setHasStoredGroupSelection(true);
    setSelectedGroupKeys((c) => c.includes(k) ? c.filter((x) => x !== k) : [...c, k]);
  }

  // ── Conversas filtradas ────────────────────────────────────────────────────

  const filteredConversations = useMemo(() => {
    const convs = Array.isArray(liveData?.conversations) ? liveData.conversations : [];
    return convs.filter((c) => selectedKeySet.has(normalizeGroup(c.group_name || '')));
  }, [liveData, selectedKeySet]);

  const negativeConversations = useMemo(() =>
    filteredConversations.filter((c) => (c.negative_count || 0) > 0).sort((a, b) => (b.negative_count || 0) - (a.negative_count || 0)),
    [filteredConversations]
  );

  // ── Sentimento ────────────────────────────────────────────────────────────────

  const summary = liveData?.summary;
  const sessionSummary = sessionData?.summary;
  const visibleSessions = useMemo(
    () => (sessionData?.sessions || []).slice(0, 5),
    [sessionData]
  );
  const protocolMentions = useMemo(() => {
    return (sessionData?.sessions || [])
      .flatMap((session) => {
        const mentions = session.protocol_mentions || [];
        if (mentions.length > 0) {
          return mentions.map((mention) => ({ session, mention }));
        }

        return (session.protocols || []).map((protocol) => ({
          session,
          mention: {
            protocol,
            source: 'regex' as const,
            evidence: session.group_name || '',
          },
        }));
      })
      .filter((item) => item.mention.protocol)
      .slice(0, 8);
  }, [sessionData]);
  const pos = summary?.positive ?? 0;
  const neu = summary?.neutral ?? 0;
  const neg = summary?.negative ?? 0;
  const total = pos + neu + neg || 1;

  // ── Audio ─────────────────────────────────────────────────────────────────────

  function stopAudio() {
    window.speechSynthesis?.cancel();
    if (serverAudioRef.current) { serverAudioRef.current.pause(); serverAudioRef.current = null; }
    setSpeakingKey(null);
  }

  function speakText(text: string, key: string) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text.trim());
    const voices = window.speechSynthesis.getVoices();
    utt.voice = voices.find((v) => v.lang?.startsWith('pt')) || null;
    utt.lang = 'pt-BR';
    utt.onend = () => setSpeakingKey(null);
    utt.onerror = () => { setSpeakingKey(null); setAudioError('Falha no audio do navegador.'); };
    setSpeakingKey(key);
    window.speechSynthesis.speak(utt);
  }

  async function playServerAudio(text: string, title: string, key: string) {
    const res = await fetch('/api/wa-monitor/group-brief/audio', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, title }),
    });
    if (!res.ok) throw new Error('Falha ao gerar audio no servidor.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    serverAudioRef.current = audio;
    audio.onended = () => { URL.revokeObjectURL(url); serverAudioRef.current = null; setSpeakingKey(null); };
    setSpeakingKey(key); setAudioMode('server');
    await audio.play();
  }

  async function speakBrief(text: string, title: string, key: string) {
    if (!text.trim()) return;
    setAudioError('');
    try { await playServerAudio(text, title, key); }
    catch { setAudioMode('browser'); speakText(text, key); }
  }

  async function loadGroupBrief(groupName: string) {
    setGroupBriefLoadingKey(groupName); setGroupBriefError('');
    try {
      const res = await fetch(`/api/wa-monitor/group-brief?group_name=${encodeURIComponent(groupName)}&days=${exportDays}`);
      const data = (await res.json()) as GroupBriefPayload & { ok?: boolean; error?: string };
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Falha ao gerar resumo.');
      setSelectedGroupBrief(data);
    } catch (e) {
      setGroupBriefError(e instanceof Error ? e.message : 'Falha ao gerar resumo.');
    } finally { setGroupBriefLoadingKey(null); }
  }

  async function reviewLifecycleWithAi() {
    setAiLifecycleLoading(true);
    setAiLifecycleError('');
    try {
      const res = await fetch(`/api/wa-monitor/conversation-sessions?days=${insightDays}&limit=5000&ai=1&max_ai_messages=40`);
      const data = (await res.json()) as ConversationSessionsPayload & { ok?: boolean; error?: string };
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Falha ao revisar com IA.');
      setSessionData(data);
      setAiLifecycleReview(Boolean(data.ai_review?.enabled));
      if (!data.ai_review?.enabled) {
        setAiLifecycleError('IA indisponivel ou sem cota agora.');
      }
    } catch (e) {
      setAiLifecycleError(e instanceof Error ? e.message : 'Falha ao revisar com IA.');
      setAiLifecycleReview(false);
    } finally {
      setAiLifecycleLoading(false);
    }
  }

  function connectOutlook() { window.location.href = '/api/communications/outlook/auth/start?prompt=select_account'; }

  async function switchOutlookAccount() {
    setOutlookSwitching(true); setOutlookError(''); setOutlookMessage('');
    try {
      await fetch('/api/communications/outlook/disconnect', { method: 'POST' });
      window.location.href = '/api/communications/outlook/auth/start?prompt=select_account';
    } catch (e) { setOutlookError(e instanceof Error ? e.message : 'Falha.'); setOutlookSwitching(false); }
  }

  async function syncOutlookEmails() {
    setOutlookSyncing(true); setOutlookError(''); setOutlookMessage('');
    try {
      const res = await fetch('/api/communications/outlook/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ top: 15 }) });
      const data = (await res.json()) as { ok?: boolean; error?: string; pulled?: number; ingested?: Array<{ ok?: boolean; duplicate?: boolean }> };
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Falha ao sincronizar.');
      const ins = (data.ingested || []).filter((i) => i.ok && !i.duplicate).length;
      setOutlookMessage(`${data.pulled || 0} lidos, ${ins} novos.`);
    } catch (e) { setOutlookError(e instanceof Error ? e.message : 'Falha.'); }
    finally { setOutlookSyncing(false); }
  }

  const buildExportHref = (g: string, sheet: 'messages' | 'summary' | 'keywords' | 'sessions') =>
    `/api/wa-monitor/export?${new URLSearchParams({ sheet, days: String(exportDays), group_name: g })}`;

  const selectedBrief = selectedGroupBrief?.brief;
  const selectedBriefGroupName = selectedGroupBrief?.group?.name || '';
  const selectedBriefAudio = String(selectedBrief?.audio_script || '').trim();

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans antialiased">
      <Sidebar />
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-6 py-6 lg:px-10 flex flex-col gap-6 pb-16">

          {/* ── HEADER COMPACTO ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-white/5 bg-card px-8 py-6 shadow-xl"
          >
            {/* Tags + Seletor */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">IA Comunicacao</span>
                </div>
                <span className="rounded-full border border-[#379890]/25 bg-[#379890]/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-[#379890]">NOC</span>
                <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-red-400">Suporte</span>
                <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-orange-400">CS</span>
              </div>
              {/* Indicador ao vivo + seletor de período */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setNewMsgCount(0)}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-card/[0.03] px-3 py-1.5 transition hover:bg-card/[0.06]"
                  title="Atualizar feed"
                >
                  <div className={`h-1.5 w-1.5 rounded-full ${liveConnected ? 'bg-green-400 animate-pulse' : 'bg-stone-600'}`} />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    {liveConnected ? 'ao vivo' : 'offline'}
                  </span>
                  {newMsgCount > 0 && (
                    <span className="rounded-full bg-[#379890] px-1.5 py-0.5 text-[9px] font-black text-white">
                      +{newMsgCount}
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-1 rounded-[20px] border border-white/10 bg-card/[0.03] p-1">
                  {([1, 7, 30] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setInsightDays(d)}
                      className={`rounded-[16px] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                        insightDays === d ? 'bg-[#379890] text-white shadow-md' : 'text-muted-foreground hover:text-white'
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
              {[
                {
                  label: 'Mensagens',
                  value: summary?.messages_7d ?? '—',
                  sub: insightDays === 1 ? 'hoje' : `últimos ${insightDays}d`,
                  color: 'text-white',
                },
                {
                  label: 'Sentimento médio',
                  value: Number(summary?.sentiment_average || 0).toFixed(2),
                  sub: neg > 0 ? `${neg} negativas` : 'sem alertas',
                  color: neg > 0 ? 'text-red-400' : 'text-green-400',
                },
                {
                  label: 'Urgências',
                  value: summary?.urgent ?? 0,
                  sub: 'termos críticos',
                  color: (summary?.urgent || 0) > 0 ? 'text-orange-400' : 'text-muted-foreground',
                },
                {
                  label: 'Grupos monitorados',
                  value: selectedGroupKeys.length,
                  sub: `${allGroups.length} disponíveis`,
                  color: 'text-[#379890]',
                },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-[22px] border border-white/5 bg-card/[0.03] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{kpi.label}</p>
                  <p className={`mt-2 text-2xl font-[1000] tracking-[-0.05em] ${kpi.color}`}>{kpi.value}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground uppercase tracking-[0.18em]">{kpi.sub}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] border border-[#b7d8d4] bg-card/80 p-6 shadow-lg"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#379890]">Ciclo de conversas</p>
                <p className="mt-1 text-xs text-foreground">
                  Inicio, fechamento, protocolo e tempo sem resposta por conversa detectada.
                </p>
              </div>
              <a
                href={`/api/wa-monitor/conversation-sessions?days=${insightDays}${aiLifecycleReview ? '&ai=1' : ''}`}
                className="rounded-full border border-[#379890]/35 bg-[#e5f3f1] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#1f7f78] hover:bg-[#d9eeeb] transition"
              >
                API
              </a>
              <button
                onClick={reviewLifecycleWithAi}
                disabled={aiLifecycleLoading}
                className={`rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition ${
                  aiLifecycleReview
                    ? 'border-orange-500/35 bg-orange-500/10 text-orange-600'
                    : 'border-[#379890]/35 bg-card px-4 text-[#1f7f78] hover:bg-[#eef8f7]'
                }`}
              >
                {aiLifecycleLoading ? 'IA revisando' : aiLifecycleReview ? 'IA revisou' : 'Revisar com IA'}
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                { label: 'Abertas', value: sessionSummary?.sessions_open ?? 0, sub: 'em andamento', color: 'text-yellow-400' },
                { label: 'Fechadas', value: sessionSummary?.sessions_closed ?? 0, sub: 'no periodo', color: 'text-green-400' },
                { label: 'Com protocolo', value: sessionSummary?.sessions_with_protocol ?? 0, sub: 'registradas', color: 'text-[#379890]' },
                { label: 'Sem resposta', value: sessionSummary?.sessions_without_response ?? 0, sub: 'sem retorno', color: 'text-red-400' },
                { label: 'Maior espera', value: `${sessionSummary?.max_unanswered_minutes ?? 0}m`, sub: 'sem resposta', color: 'text-orange-400' },
              ].map((item) => (
                <div key={item.label} className="rounded-[20px] border border-[#d8e9e6] bg-card/90 p-4 shadow-sm">
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-foreground">{item.label}</p>
                  <p className={`mt-2 text-2xl font-[1000] tracking-[-0.04em] ${item.color}`}>{item.value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-foreground">{item.sub}</p>
                </div>
              ))}
            </div>

            {visibleSessions.length > 0 && (
              <div className="mt-5 grid gap-2">
                {visibleSessions.map((session) => (
                  <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#d8e9e6] bg-card/95 px-4 py-3 shadow-sm">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-black uppercase tracking-[0.14em] text-[#243b38]">
                        {session.group_name || 'Grupo'} · {session.status === 'open' ? 'Aberta' : 'Fechada'}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-foreground">
                        {session.protocol_registered ? `Protocolo ${session.protocols?.join(', ') || ''}` : 'Sem protocolo'} · {session.message_count || 0} msgs
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.12em]">
                      <span className="rounded-full border border-[#d8e9e6] bg-[#f5faf9] px-3 py-1 text-foreground">
                        1a resposta: {typeof session.first_response_minutes === 'number' ? `${session.first_response_minutes}m` : 'sem resposta'}
                      </span>
                      <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-orange-400">
                        espera max: {session.max_unanswered_minutes || 0}m
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 rounded-[22px] border border-[#d8e9e6] bg-card/95 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#1f7f78]">Protocolos detectados</p>
                  <p className="mt-1 text-xs text-foreground">
                    {protocolMentions.length} protocolo{protocolMentions.length !== 1 ? 's' : ''} vinculado{protocolMentions.length !== 1 ? 's' : ''} a conversas neste recorte.
                  </p>
                </div>
                {sessionData?.ai_review?.enabled && (
                  <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-orange-600">
                    IA revisou {sessionData.ai_review.reviewed_messages || 0} msgs
                  </span>
                )}
                {aiLifecycleError && (
                  <span className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-red-600">
                    {aiLifecycleError}
                  </span>
                )}
              </div>

              {protocolMentions.length > 0 ? (
                <div className="mt-4 grid gap-2">
                  {protocolMentions.map(({ session, mention }, index) => (
                    <div key={`${session.id}-${mention.protocol}-${mention.message_id || 'sem-msg'}-${mention.source || 'fonte'}-${index}`} className="grid gap-3 rounded-[16px] border border-[#e2efed] bg-[#f8fbfa] px-4 py-3 lg:grid-cols-[180px_1fr_140px]">
                      <div>
                        <p className="text-sm font-[1000] uppercase tracking-[0.08em] text-[#243b38]">{mention.protocol}</p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                          {mention.source === 'ai' ? 'IA' : 'Regra'}{typeof mention.confidence === 'number' ? ` · ${Math.round(mention.confidence * 100)}%` : ''}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-black uppercase tracking-[0.14em] text-[#1f7f78]">
                          {session.group_name || 'Grupo'} · {session.status === 'open' ? 'Aberta' : 'Fechada'}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground">
                          {mention.evidence || 'Sem evidência textual capturada.'}
                        </p>
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground lg:text-right">
                        {typeof mention.timestamp === 'number' ? formatTime(mention.timestamp) : 'sem hora'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[16px] border border-dashed border-[#d8e9e6] bg-[#f8fbfa] px-4 py-3 text-sm text-foreground">
                  Nenhum protocolo apareceu nas conversas exibidas. Acione a revisão com IA para procurar padrões menos óbvios.
                </div>
              )}
            </div>
          </motion.div>

          {/* ── ALERTAS OPERACIONAIS (só aparece se houver negativos) ── */}
          {negativeConversations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[24px] border border-red-500/25 bg-red-500/8 px-6 py-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <TriangleAlert className="h-4 w-4 text-red-400 shrink-0 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-400">
                  {negativeConversations.length} grupo{negativeConversations.length !== 1 ? 's' : ''} com pressão negativa
                </span>
                <div className="flex flex-wrap gap-2 ml-2">
                  {negativeConversations.map((c) => (
                    <span key={c.group_id} className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-0.5 text-[10px] font-black text-red-400">
                      {c.group_name} · {c.negative_count} neg
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── MAIN: Grupos + Conversas ── */}
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">

            {/* ─ Seletor de grupos (sidebar) ─ */}
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-[28px] border border-white/5 bg-card p-5 shadow-lg flex flex-col gap-4 self-start"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Grupos</p>
                <p className="mt-1 text-xs text-muted-foreground">{selectedGroupKeys.length} de {allGroups.length} selecionados</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setHasStoredGroupSelection(true); setSelectedGroupKeys(allGroups.map((g) => g.key)); }}
                  className="flex-1 rounded-[18px] border border-white/10 bg-card/[0.03] py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-white transition"
                >
                  Todos
                </button>
                <button
                  onClick={() => { setHasStoredGroupSelection(true); setSelectedGroupKeys([]); }}
                  className="flex-1 rounded-[18px] border border-white/10 bg-card/[0.03] py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-white transition"
                >
                  Limpar
                </button>
              </div>
              <div className="space-y-1.5 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                {allGroups.map((g) => {
                  const selected = selectedKeySet.has(g.key);
                  const conv = (liveData?.conversations || []).find((c) => normalizeGroup(c.group_name || '') === g.key);
                  const hasNeg = (conv?.negative_count || 0) > 0;
                  const { flagged: unans } = detectUnanswered(conv || {});
                  return (
                    <button
                      key={g.key}
                      onClick={() => toggleGroup(g.key)}
                      className={`w-full flex items-center justify-between gap-2 rounded-[16px] border px-3 py-2.5 text-left transition-all ${
                        selected
                          ? hasNeg
                            ? 'border-red-500/30 bg-red-500/10 text-red-300'
                            : 'border-[#379890]/25 bg-[#379890]/10 text-[#379890]'
                          : 'border-white/5 bg-card/[0.02] text-muted-foreground hover:text-stone-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${hasNeg ? 'bg-red-400' : unans ? 'bg-yellow-400' : g.todayCount > 0 ? 'bg-green-400' : 'bg-stone-600'}`} />
                        <span className="text-[10px] font-black uppercase tracking-[0.12em] truncate">{g.name}</span>
                      </div>
                      {g.todayCount > 0 && (
                        <span className="text-[9px] font-black text-muted-foreground shrink-0">{g.todayCount}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Sentimento compacto */}
              {(pos + neu + neg) > 0 && (
                <div className="mt-2 pt-4 border-t border-white/5 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Sentimento</p>
                  {[
                    { label: 'Positivo', value: Math.round((pos / total) * 100), color: 'bg-green-400' },
                    { label: 'Neutro', value: Math.round((neu / total) * 100), color: 'bg-stone-500' },
                    { label: 'Negativo', value: Math.round((neg / total) * 100), color: 'bg-red-400' },
                  ].map((b) => (
                    <div key={b.label}>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>{b.label}</span><span>{b.value}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-card/5 overflow-hidden">
                        <div className={`h-full rounded-full ${b.color}`} style={{ width: `${b.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* ─ Feed de conversas ─ */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
            >
              {filteredConversations.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-white/10 bg-card/[0.02] flex items-center justify-center py-20">
                  <div className="text-center">
                    <MessageSquareText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhuma conversa no período selecionado.</p>
                    <p className="text-xs text-muted-foreground mt-1">Selecione grupos ao lado ou mude a janela de tempo.</p>
                  </div>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <ConversationCard
                    key={conv.group_id || conv.group_name}
                    conv={conv}
                    onBrief={loadGroupBrief}
                    briefLoading={groupBriefLoadingKey === (conv.group_name || '')}
                  />
                ))
              )}
              {groupBriefError && (
                <p className="text-sm text-red-400 px-2">{groupBriefError}</p>
              )}
            </motion.div>
          </div>

          {/* ── BRIEF PANEL (aparece quando gerado) ── */}
          {selectedBrief && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[28px] border border-white/5 bg-card p-6 shadow-xl"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Brief — {selectedBriefGroupName}</p>
                  <h3 className="mt-2 text-xl font-[950] tracking-[-0.04em] uppercase">{selectedBrief.title || 'Resumo do período'}</h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${sentimentStyle[selectedBrief.sentiment || 'neutral']}`}>
                  {selectedBrief.sentiment || 'neutro'}
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-stone-300">{selectedBrief.summary}</p>
              {(selectedBrief.highlights?.length || 0) > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  {selectedBrief.highlights!.slice(0, 3).map((h) => (
                    <div key={h} className="rounded-[16px] border border-white/5 bg-card/[0.03] px-4 py-2.5 text-sm text-stone-300">{h}</div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                {speakingKey === 'brief' ? (
                  <button onClick={stopAudio} className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-[10px] font-black uppercase text-red-400 hover:bg-red-500/15 transition">
                    <Square className="h-3.5 w-3.5" /> Parar
                  </button>
                ) : (
                  <button
                    onClick={() => speakBrief(selectedBriefAudio, selectedBrief.title || selectedBriefGroupName, 'brief')}
                    disabled={!selectedBriefAudio}
                    className="inline-flex items-center gap-2 rounded-full border border-[#379890]/20 bg-[#379890]/10 px-4 py-2 text-[10px] font-black uppercase text-[#379890] hover:bg-[#379890]/15 transition disabled:opacity-50"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    {audioMode === 'server' ? 'Ouvir (servidor)' : 'Ouvir'}
                  </button>
                )}
                {audioError && <p className="text-xs text-red-400 self-center">{audioError}</p>}
              </div>
            </motion.div>
          )}

          {/* ── EXPORTAR (colapsável) ── */}
          <div className="rounded-[28px] border border-white/5 bg-card overflow-hidden">
            <button
              onClick={() => setShowExport((v) => !v)}
              className="w-full flex items-center justify-between px-8 py-5 hover:bg-card/[0.02] transition"
            >
              <div className="flex items-center gap-3">
                <Download className="h-4 w-4 text-muted-foreground" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Exportar dados por grupo</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1 rounded-[18px] border border-white/10 bg-card/[0.03] p-0.5">
                  {([7, 15, 30] as const).map((d) => (
                    <span key={d} role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setExportDays(d); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setExportDays(d); } }}
                      className={`rounded-[14px] px-3 py-1 text-[9px] font-black transition cursor-pointer ${exportDays === d ? 'bg-[#379890] text-white' : 'text-muted-foreground hover:text-white'}`}>
                      {d}d
                    </span>
                  ))}
                </div>
                {showExport ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            <AnimatePresence>
              {showExport && (
                <motion.div
                  initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-8 pb-6 pt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 border-t border-white/5">
                    {allGroups
                      .filter((g) => selectedKeySet.has(g.key))
                      .map((g) => (
                        <div key={g.name} className="rounded-[24px] border border-white/5 bg-card/[0.02] p-5 flex flex-col gap-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white truncate">{g.name}</p>
                          <div className="flex flex-col gap-2">
                            {(
                              [
                                { sheet: 'messages' as const, label: 'Mensagens', color: 'text-[#379890]', border: 'border-[#379890]/20 bg-[#379890]/8' },
                                { sheet: 'summary' as const, label: 'Resumo diário', color: 'text-green-400', border: 'border-green-500/20 bg-green-500/8' },
                                { sheet: 'keywords' as const, label: 'Palavras-chave', color: 'text-orange-400', border: 'border-orange-500/20 bg-orange-500/8' },
                                { sheet: 'sessions' as const, label: 'Conversas', color: 'text-yellow-400', border: 'border-yellow-500/20 bg-yellow-500/8' },
                              ] as const
                            ).map((row) => (
                              <a key={row.sheet} href={buildExportHref(g.name, row.sheet)}
                                className={`flex items-center gap-2 rounded-[16px] border px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] transition hover:opacity-80 ${row.border} ${row.color}`}>
                                <FileText className="h-3 w-3 shrink-0" />
                                {row.label} ({exportDays}d)
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── OUTLOOK (colapsável) ── */}
          <div className="rounded-[28px] border border-white/5 bg-card overflow-hidden">
            <button
              onClick={() => setShowOutlook((v) => !v)}
              className="w-full flex items-center justify-between px-8 py-5 hover:bg-card/[0.02] transition"
            >
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Outlook corporativo</span>
                {outlookStatus?.connected && (
                  <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[9px] font-black text-green-400">Conectado</span>
                )}
              </div>
              {showOutlook ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            <AnimatePresence>
              {showOutlook && (
                <motion.div
                  initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-8 pb-6 pt-4 border-t border-white/5 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {outlookStatus?.connected
                        ? `Conta: ${outlookStatus.account?.name || 'desconhecida'} (${outlookStatus.account?.email || ''})`
                        : outlookStatus?.configured
                        ? 'App configurado. Clique em Conectar para autenticar.'
                        : 'Configure MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET e MS_REDIRECT_URI no ambiente.'}
                    </p>
                    {outlookMessage && <p className="text-sm text-green-400">{outlookMessage}</p>}
                    {outlookError && <p className="text-sm text-red-400">{outlookError}</p>}
                    <div className="flex flex-wrap gap-3">
                      <button onClick={connectOutlook} disabled={!outlookStatus?.configured}
                        className="inline-flex items-center gap-2 rounded-full border border-[#379890]/20 bg-[#379890]/10 px-5 py-2.5 text-[10px] font-black uppercase text-[#379890] hover:bg-[#379890]/15 transition disabled:opacity-40">
                        <ExternalLink className="h-3.5 w-3.5" /> Conectar
                      </button>
                      <button onClick={switchOutlookAccount} disabled={!outlookStatus?.connected || outlookSwitching}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-card/[0.03] px-5 py-2.5 text-[10px] font-black uppercase text-muted-foreground hover:text-white transition disabled:opacity-40">
                        {outlookSwitching ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Trocar conta
                      </button>
                      <button onClick={syncOutlookEmails} disabled={!outlookStatus?.connected || outlookSyncing}
                        className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-5 py-2.5 text-[10px] font-black uppercase text-red-400 hover:bg-red-500/15 transition disabled:opacity-40">
                        {outlookSyncing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Sincronizar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── RESUMOS DIÁRIOS (compacto, para CS/Suporte) ── */}
          {(liveData?.stored_insights?.length || 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[28px] border border-white/5 bg-card p-6 shadow-lg"
            >
              <div className="flex items-center gap-3 mb-5">
                <BadgeInfo className="h-4 w-4 text-muted-foreground" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Resumos diários</p>
                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[9px] font-black text-red-400">Suporte</span>
                <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[9px] font-black text-orange-400">CS</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(liveData?.stored_insights || [])
                  .filter((i) => selectedKeySet.has(normalizeGroup(i.group_name || i.group || '')))
                  .slice(0, 9)
                  .map((item, idx) => (
                    <div key={item.id || idx} className="rounded-[20px] border border-white/5 bg-card/[0.03] p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white truncate">
                          {item.group_name || item.group || 'Grupo'}
                        </p>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${sentimentStyle[item.sentiment_label || 'neutral']}`}>
                          {item.sentiment_label || 'neutro'}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                        {item.executive_summary || 'Sem resumo.'}
                      </p>
                      {item.primary_keyword && (
                        <p className="mt-2 text-[10px] text-muted-foreground uppercase tracking-[0.15em]">
                          Palavra: {item.primary_keyword} · Urgência: {item.urgency_label || 'baixa'}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </motion.div>
          )}

          {/* ── PALAVRAS-CHAVE (compacto, bottom) ── */}
          {(liveData?.top_keywords?.length || 0) > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-[28px] border border-white/5 bg-card px-6 py-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Termos recorrentes</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(liveData?.top_keywords || []).map((kw) => (
                  <span
                    key={kw.term}
                    className="rounded-full border border-white/10 bg-card/[0.03] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-stone-300"
                    title={`${kw.count} ocorrências`}
                  >
                    {kw.term}
                    <span className="ml-1.5 text-muted-foreground">{kw.count}</span>
                  </span>
                ))}
              </div>
            </motion.div>
          )}

        </div>
      </main>
    </div>
  );
}
