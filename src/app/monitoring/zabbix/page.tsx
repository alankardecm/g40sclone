'use client';

import Sidebar from '@/components/Sidebar';
import { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Wifi,
  WifiOff,
  Clock,
  Unplug,
  Share2,
  Cpu,
  Database,
  Radio,
  Cable,
  Server,
  Eye,
  Layers,
  TrendingDown,
  HelpCircle,
  Activity,
} from 'lucide-react';

// ── tipos ────────────────────────────────────────────────────────────────────

type Problem = {
  eventid: string;
  name: string;
  severity: string;
  clock: string;
  acknowledged: string;
  hosts?: { hostid: string; name: string }[];
};

type Host = {
  hostid: string;
  host: string;
  name: string;
  available?: string;
  groups?: { groupid: string; name: string }[];
};

type Summary = {
  totalProblems: number;
  disasters: number;
  highSeverity: number;
  hostsUp: number;
  hostsDown: number;
  totalHosts: number;
};

// ── constantes ───────────────────────────────────────────────────────────────

type AlarmCategory = 'pppoe' | 'sdwan' | 'snmp' | 'memory' | 'modulation' | 'interface' | 'equipment' | 'icmp' | 'optical' | 'onu' | 'quality' | 'other';

const CATEGORY_CONFIG: Record<AlarmCategory, { label: string; Icon: React.ElementType; color: string }> = {
  pppoe:      { label: 'PPPoE',       Icon: Unplug,       color: 'text-fuchsia-400' },
  sdwan:      { label: 'SD-WAN',      Icon: Share2,       color: 'text-blue-400'    },
  snmp:       { label: 'SNMP',        Icon: Cpu,          color: 'text-amber-400'   },
  memory:     { label: 'Memória',     Icon: Database,     color: 'text-orange-400'  },
  modulation: { label: 'Modulação',   Icon: Radio,        color: 'text-sky-400'     },
  interface:  { label: 'Interface',   Icon: Cable,        color: 'text-yellow-400'  },
  equipment:  { label: 'Equipamento', Icon: Server,       color: 'text-red-400'     },
  icmp:       { label: 'Latência',    Icon: Activity,     color: 'text-green-400'   },
  optical:    { label: 'Óptica',      Icon: Eye,          color: 'text-purple-400'  },
  onu:        { label: 'ONU/GPON',    Icon: Layers,       color: 'text-teal-400'    },
  quality:    { label: 'Qualidade',   Icon: TrendingDown, color: 'text-rose-400'    },
  other:      { label: 'Outros',      Icon: HelpCircle,   color: 'text-muted-foreground'   },
};

type GroupKey = 'backbone' | 'pop' | 'rede-acesso' | 'clientes' | 'outros';

const GROUP_META: Record<GroupKey, { label: string; impactLabel: string; color: string; bg: string; border: string }> = {
  backbone:    { label: 'Backbone',       impactLabel: 'Impacto alto — afeta múltiplos POPs',   color: 'text-red-400',     bg: 'bg-red-500/8',     border: 'border-red-500/20'     },
  pop:         { label: 'POP',            impactLabel: 'Impacto médio — afeta clientes do POP', color: 'text-orange-400',  bg: 'bg-orange-500/8',  border: 'border-orange-500/20'  },
  'rede-acesso': { label: 'Rede de Acesso', impactLabel: 'Impacto localizado',                  color: 'text-amber-400',   bg: 'bg-amber-500/8',   border: 'border-amber-500/20'   },
  clientes:    { label: 'Clientes',       impactLabel: 'Impacto em clientes específicos',       color: 'text-sky-400',     bg: 'bg-sky-500/8',     border: 'border-sky-500/20'     },
  outros:      { label: 'Outros',         impactLabel: '',                                       color: 'text-muted-foreground',   bg: 'bg-stone-500/5',   border: 'border-stone-500/15'   },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function classifyProblem(name: string): AlarmCategory {
  const n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.includes('pppoe')) return 'pppoe';
  if (n.includes('sd-wan') || n.includes('sdwan')) return 'sdwan';
  if (n.includes('snmp')) return 'snmp';
  if (n.includes('memor')) return 'memory';
  if (n.includes('modula')) return 'modulation';
  if (n.includes('consumo zero') || n.includes('descarte') || n.includes('crc') || n.includes('interface')) return 'interface';
  if (n.includes('indisponivel') || n.includes('indisponiv') || n.includes('restarted') || n.includes('reiniciado')) return 'equipment';
  if (n.includes('latencia') || n.includes('icmp')) return 'icmp';
  if (n.includes('atenuacao') || n.includes('potencia') || n.includes('rxpower') || n.includes('optic') || n.includes('transceptor')) return 'optical';
  if (n.includes('onu') || n.includes('gpon')) return 'onu';
  if (n.includes('pontuacao') || n.includes('qualidade') || n.includes('pro-ativo') || n.includes('pro ativo')) return 'quality';
  return 'other';
}

function resolveGroup(host: Host, problemName = ''): GroupKey {
  const normalizeText = (v: string) =>
    v.toLowerCase().replace(/[-_]+/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  const isPppoe = normalizeText(problemName).includes('pppoe') || normalizeText(host.name).includes('pppoe');

  const names = (host.groups || []).map((g) => normalizeText(g.name));
  if (names.some((n) => n.includes('backbone')) && !isPppoe) return 'backbone';
  if (names.some((n) => n === 'pop' || n.includes('pop '))) return 'pop';
  if (names.some((n) => n.includes('rede acesso') || n.includes('rede de acesso'))) return 'rede-acesso';
  if (names.some((n) => n.includes('cliente')) || isPppoe) return 'clientes';
  return 'outros';
}

function duration(clock: string): string {
  const diff = Math.floor(Date.now() / 1000) - Number(clock);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h${Math.floor((diff % 3600) / 60).toString().padStart(2, '0')}min`;
  return `${Math.floor(diff / 86400)}d ${Math.floor((diff % 86400) / 3600)}h`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── componente principal ───────────────────────────────────────────────────

export default function ZabbixImpactPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [sumRes, probRes, hostsRes] = await Promise.all([
        fetch('/api/zabbix?view=summary'),
        fetch('/api/zabbix?view=problems&limit=200'),
        fetch('/api/zabbix?view=hosts&limit=500'),
      ]);
      const [sumData, probData, hostsData] = await Promise.all([
        sumRes.json() as Promise<{ ok: boolean; summary?: Summary; error?: string }>,
        probRes.json() as Promise<{ ok: boolean; problems?: Problem[] }>,
        hostsRes.json() as Promise<{ ok: boolean; hosts?: Host[] }>,
      ]);

      if (sumData.ok) setSummary(sumData.summary ?? null);
      if (probData.ok) setAllProblems(probData.problems ?? []);
      if (hostsData.ok) setHosts(hostsData.hosts ?? []);
      setError(sumData.ok ? '' : (sumData.error ?? 'Erro ao conectar ao Zabbix'));
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na conexão');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const timer = setInterval(() => { void fetchData(); }, 60_000);
    return () => clearInterval(timer);
  }, [fetchData]);

  // só alarmes críticos: DESASTRE (5) e ALTA (4)
  const criticalProblems = allProblems
    .filter((p) => Number(p.severity) >= 4)
    .sort((a, b) => Number(b.severity) - Number(a.severity) || Number(b.clock) - Number(a.clock));

  const disasters = criticalProblems.filter((p) => p.severity === '5');
  const high = criticalProblems.filter((p) => p.severity === '4');
  const lowerCount = allProblems.length - criticalProblems.length;

  const hostMap = Object.fromEntries(hosts.map((h) => [h.hostid, h]));

  const networkHealthy = !loading && !error && criticalProblems.length === 0;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans antialiased">
      <Sidebar />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-10 py-9 flex flex-col gap-6 max-w-5xl mx-auto">

          {/* ── HEADER STATUS ──────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground">
                Monitoramento de rede
              </p>
              <h1 className="mt-2 text-3xl font-[950] tracking-[-0.05em] uppercase">
                Alertas Críticos
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Apenas eventos de impacto operacional — DESASTRE e ALTA severidade.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {lastUpdate && (
                <span className="flex items-center gap-1.5 rounded-full border border-white/8 bg-card/[0.03] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatTime(lastUpdate)}
                </span>
              )}
              <span className="rounded-full border border-white/8 bg-card/[0.03] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Auto · 60s
              </span>
            </div>
          </div>

          {/* ── ERRO ────────────────────────────────────────────────────── */}
          {error && (
            <div className="rounded-[22px] border border-red-500/30 bg-red-500/8 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-400 mb-1">
                Erro de conexão
              </p>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* ── LOADING ─────────────────────────────────────────────────── */}
          {loading && (
            <div className="flex items-center gap-3 text-muted-foreground text-sm py-8">
              <div className="w-4 h-4 border-2 border-stone-600 border-t-neon-cyan rounded-full animate-spin" />
              Conectando ao Zabbix...
            </div>
          )}

          {/* ── REDE SAUDÁVEL ────────────────────────────────────────────── */}
          {networkHealthy && (
            <div className="rounded-[34px] border border-green-500/20 bg-green-500/6 p-10 flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-[950] tracking-[-0.04em] text-green-300 uppercase">
                  Rede Operacional
                </p>
                <p className="mt-2 text-sm text-green-400/70">
                  Nenhum evento crítico ativo no momento.
                </p>
              </div>
              <div className="flex items-center gap-6 mt-2 text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-green-400" />
                  {summary?.hostsUp ?? '—'} hosts online
                </span>
                {summary?.hostsDown ? (
                  <span className="flex items-center gap-1.5">
                    <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
                    {summary.hostsDown} offline
                  </span>
                ) : null}
                {lowerCount > 0 && (
                  <span className="text-muted-foreground">
                    {lowerCount} alarme{lowerCount > 1 ? 's' : ''} de baixa prioridade omitido{lowerCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── SUMÁRIO DE IMPACTO ──────────────────────────────────────── */}
          {!loading && criticalProblems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-[22px] border border-neon-pink/25 bg-neon-pink/6 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-neon-pink/70">Desastres</p>
                <p className="mt-3 text-4xl font-[1000] tracking-[-0.06em] text-neon-pink">{disasters.length}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">severity 5</p>
              </div>
              <div className="rounded-[22px] border border-red-500/20 bg-red-500/6 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">Alta</p>
                <p className="mt-3 text-4xl font-[1000] tracking-[-0.06em] text-red-400">{high.length}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">severity 4</p>
              </div>
              <div className="rounded-[22px] border border-green-500/15 bg-green-500/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">Hosts online</p>
                <p className="mt-3 text-4xl font-[1000] tracking-[-0.06em] text-green-400">{summary?.hostsUp ?? '—'}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">de {summary?.totalHosts ?? '?'}</p>
              </div>
              <div className={`rounded-[22px] border p-4 ${summary?.hostsDown ? 'border-red-500/20 bg-red-500/5' : 'border-white/5 bg-card/[0.02]'}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">Hosts offline</p>
                <p className={`mt-3 text-4xl font-[1000] tracking-[-0.06em] ${summary?.hostsDown ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {summary?.hostsDown ?? '—'}
                </p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">inacessíveis</p>
              </div>
            </div>
          )}

          {/* ── LISTA DE ALARMES CRÍTICOS ──────────────────────────────── */}
          {!loading && criticalProblems.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                {criticalProblems.length} evento{criticalProblems.length > 1 ? 's' : ''} crítico{criticalProblems.length > 1 ? 's' : ''} ativo{criticalProblems.length > 1 ? 's' : ''}
              </p>

              {criticalProblems.map((p) => {
                const isDisaster = p.severity === '5';
                const cat = classifyProblem(p.name);
                const catCfg = CATEGORY_CONFIG[cat];
                const CatIcon = catCfg.Icon;

                // resolve o grupo operacional pelo primeiro host encontrado
                const firstHostId = p.hosts?.[0]?.hostid;
                const hostRecord = firstHostId ? hostMap[firstHostId] : undefined;
                const group: GroupKey = hostRecord ? resolveGroup(hostRecord, p.name) : 'outros';
                const groupMeta = GROUP_META[group];

                return (
                  <div
                    key={p.eventid}
                    className={`rounded-[26px] border p-6 flex flex-col gap-4 ${
                      isDisaster
                        ? 'border-neon-pink/30 bg-neon-pink/6'
                        : 'border-red-500/20 bg-red-500/5'
                    }`}
                  >
                    {/* linha 1: badges + duração */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* severidade */}
                        <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] ${
                          isDisaster
                            ? 'border-neon-pink/40 bg-neon-pink/12 text-neon-pink'
                            : 'border-red-500/30 bg-red-500/10 text-red-400'
                        }`}>
                          {isDisaster ? 'Desastre' : 'Alta'}
                        </span>

                        {/* categoria */}
                        <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-card/[0.04] px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] ${catCfg.color}`}>
                          <CatIcon className="w-3 h-3" />
                          {catCfg.label}
                        </span>

                        {/* grupo operacional */}
                        <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] ${groupMeta.color} ${groupMeta.bg} ${groupMeta.border}`}>
                          {groupMeta.label}
                        </span>

                        {/* ack */}
                        {p.acknowledged === '1' && (
                          <span className="rounded-full border border-stone-500/20 bg-stone-500/8 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                            Reconhecido
                          </span>
                        )}
                      </div>

                      {/* duração */}
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground shrink-0">
                        <Clock className="w-3 h-3" />
                        há {duration(p.clock)}
                      </div>
                    </div>

                    {/* linha 2: nome do alarme */}
                    <div>
                      <p className="text-base font-black uppercase tracking-[0.06em] leading-snug">
                        {p.name}
                      </p>
                      {p.hosts && p.hosts.length > 0 && (
                        <p className="mt-1.5 text-xs text-muted-foreground font-mono">
                          {p.hosts.map((h) => h.name).join(' · ')}
                        </p>
                      )}
                    </div>

                    {/* linha 3: contexto de impacto */}
                    {groupMeta.impactLabel && (
                      <div className={`rounded-[16px] border px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] ${groupMeta.color} ${groupMeta.bg} ${groupMeta.border}`}>
                        {groupMeta.impactLabel}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* rodapé com alarmes omitidos */}
              {lowerCount > 0 && (
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground text-center pt-2">
                  + {lowerCount} alarme{lowerCount > 1 ? 's' : ''} de baixa prioridade omitido{lowerCount > 1 ? 's' : ''} — visíveis no Zabbix
                </p>
              )}
            </div>
          )}

          {/* ── STATUS DE MONITORAMENTO ─────────────────────────────────── */}
          {!loading && !error && (
            <div className="flex items-center justify-between gap-4 rounded-[18px] border border-white/5 bg-card/[0.02] px-5 py-3 flex-wrap">
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Wifi className="w-3 h-3 text-green-500" />
                  {summary?.hostsUp ?? '—'} online
                </span>
                <span className="flex items-center gap-1.5">
                  <WifiOff className="w-3 h-3 text-muted-foreground" />
                  {summary?.hostsDown ?? '—'} offline
                </span>
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-muted-foreground" />
                  {allProblems.length} alarme{allProblems.length !== 1 ? 's' : ''} total
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Zabbix 6.2 · Monitoramento contínuo
              </span>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
