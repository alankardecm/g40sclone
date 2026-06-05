'use client';

import Sidebar from '@/components/Sidebar';
import { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  WifiOff,
  Clock,
  Star,
  Activity,
  RefreshCw,
} from 'lucide-react';

type Problem = {
  eventid: string;
  name: string;
  severity: string;
  clock: string;
  hosts?: { hostid: string; name: string }[];
};

type TopClient = {
  hostid: string;
  name: string;
  host: string;
  available: string;
  problems: Problem[];
  maxSeverity: number;
  riskScore: number;
};

type Stats = {
  total: number;
  withAlarms: number;
  offline: number;
  withDisaster: number;
};

const SEV_LABEL: Record<string, string> = {
  '5': 'Desastre',
  '4': 'Alta',
  '3': 'Média',
  '2': 'Aviso',
  '1': 'Info',
};

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

function availLabel(avail: string) {
  if (avail === '1') return { label: 'Online', cls: 'text-green-400 border-green-500/30 bg-green-500/8' };
  if (avail === '2') return { label: 'Offline', cls: 'text-red-400 border-red-500/30 bg-red-500/8' };
  return { label: 'Desconhecido', cls: 'text-stone-400 border-stone-500/20 bg-stone-500/6' };
}

function severityBadgeClass(sev: string) {
  if (sev === '5') return 'text-neon-pink border-neon-pink/40 bg-neon-pink/10';
  if (sev === '4') return 'text-red-400 border-red-500/30 bg-red-500/8';
  if (sev === '3') return 'text-orange-400 border-orange-500/30 bg-orange-500/8';
  return 'text-yellow-400 border-yellow-500/20 bg-yellow-500/6';
}

function clientBorderClass(client: TopClient) {
  if (client.available === '2' && client.maxSeverity >= 5) return 'border-neon-pink/35 bg-neon-pink/5';
  if (client.maxSeverity >= 5) return 'border-neon-pink/25 bg-neon-pink/4';
  if (client.available === '2') return 'border-red-500/30 bg-red-500/5';
  if (client.maxSeverity >= 4) return 'border-red-500/20 bg-red-500/4';
  if (client.problems.length > 0) return 'border-orange-500/20 bg-orange-500/4';
  return 'border-white/6 bg-white/[0.02]';
}

export default function TopClientesPage() {
  const [clients, setClients] = useState<TopClient[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/zabbix?view=top-clients');
      const data = (await res.json()) as {
        ok: boolean;
        clients?: TopClient[];
        stats?: Stats;
        error?: string;
      };

      if (data.ok) {
        setClients(data.clients ?? []);
        setStats(data.stats ?? null);
        setError('');
      } else {
        setError(data.error ?? 'Erro ao carregar dados');
      }
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

  const allClean = !loading && !error && clients.length > 0 && stats?.withAlarms === 0;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans antialiased">
      <Sidebar />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-10 py-9 flex flex-col gap-6 max-w-5xl mx-auto">

          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-stone-500">
                Monitoramento · Clientes
              </p>
              <h1 className="mt-2 text-3xl font-[950] tracking-[-0.05em] uppercase flex items-center gap-3">
                <Star className="w-7 h-7 text-amber-400" fill="currentColor" />
                TOP Corporativo
              </h1>
              <p className="mt-1 text-sm text-stone-400">
                Clientes CLIENTE-TOP-CORPORATIVO — status e alarmes em tempo real.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {lastUpdate && (
                <span className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">
                  <Clock className="w-3 h-3" />
                  {formatTime(lastUpdate)}
                </span>
              )}
              <span className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">
                <RefreshCw className="w-3 h-3" />
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
            <div className="flex items-center gap-3 text-stone-500 text-sm py-8">
              <div className="w-4 h-4 border-2 border-stone-600 border-t-neon-cyan rounded-full animate-spin" />
              Consultando Zabbix...
            </div>
          )}

          {/* ── SUMMARY CARDS ───────────────────────────────────────────── */}
          {!loading && stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-[22px] border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-400/80">Monitorados</p>
                <p className="mt-3 text-4xl font-[1000] tracking-[-0.06em] text-amber-400">{stats.total}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-stone-500">TOP corp</p>
              </div>
              <div className={`rounded-[22px] border p-4 ${stats.withAlarms > 0 ? 'border-orange-500/25 bg-orange-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-stone-400">Com alarmes</p>
                <p className={`mt-3 text-4xl font-[1000] tracking-[-0.06em] ${stats.withAlarms > 0 ? 'text-orange-400' : 'text-stone-600'}`}>
                  {stats.withAlarms}
                </p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-stone-500">ativos</p>
              </div>
              <div className={`rounded-[22px] border p-4 ${stats.offline > 0 ? 'border-red-500/20 bg-red-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-stone-400">Offline</p>
                <p className={`mt-3 text-4xl font-[1000] tracking-[-0.06em] ${stats.offline > 0 ? 'text-red-400' : 'text-stone-600'}`}>
                  {stats.offline}
                </p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-stone-500">inacessíveis</p>
              </div>
              <div className={`rounded-[22px] border p-4 ${stats.withDisaster > 0 ? 'border-neon-pink/25 bg-neon-pink/5' : 'border-white/5 bg-white/[0.02]'}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-stone-400">Desastres</p>
                <p className={`mt-3 text-4xl font-[1000] tracking-[-0.06em] ${stats.withDisaster > 0 ? 'text-neon-pink' : 'text-stone-600'}`}>
                  {stats.withDisaster}
                </p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-stone-500">severity 5</p>
              </div>
            </div>
          )}

          {/* ── TODOS OPERACIONAIS ──────────────────────────────────────── */}
          {allClean && (
            <div className="rounded-[34px] border border-green-500/20 bg-green-500/6 p-10 flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-[950] tracking-[-0.04em] text-green-300 uppercase">
                  Todos Operacionais
                </p>
                <p className="mt-2 text-sm text-green-400/70">
                  Nenhum alarme ativo nos {stats?.total} clientes TOP Corporativo.
                </p>
              </div>
            </div>
          )}

          {/* ── LISTA DE CLIENTES ────────────────────────────────────────── */}
          {!loading && clients.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-500">
                {clients.length} cliente{clients.length !== 1 ? 's' : ''} · ordenado por risco
              </p>

              {clients.map((client) => {
                const avail = availLabel(client.available);
                const disasters = client.problems.filter((p) => p.severity === '5');
                const highs = client.problems.filter((p) => p.severity === '4');
                const others = client.problems.filter((p) => Number(p.severity) <= 3);

                return (
                  <div
                    key={client.hostid}
                    className={`rounded-[26px] border p-6 flex flex-col gap-4 ${clientBorderClass(client)}`}
                  >
                    {/* linha 1: nome + badges de status */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-base font-black uppercase tracking-[0.05em]">
                          {client.name}
                        </p>
                        <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] ${avail.cls}`}>
                          {avail.label}
                        </span>
                        {client.problems.length > 0 && (
                          <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-stone-400">
                            {client.problems.length} alarme{client.problems.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* severity badges resumidos */}
                      <div className="flex items-center gap-2 shrink-0">
                        {disasters.length > 0 && (
                          <span className="rounded-full border border-neon-pink/40 bg-neon-pink/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-neon-pink">
                            {disasters.length}× Desastre
                          </span>
                        )}
                        {highs.length > 0 && (
                          <span className="rounded-full border border-red-500/30 bg-red-500/8 px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-red-400">
                            {highs.length}× Alta
                          </span>
                        )}
                        {others.length > 0 && (
                          <span className="rounded-full border border-orange-500/20 bg-orange-500/6 px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-orange-400">
                            {others.length}× Média/Aviso
                          </span>
                        )}
                      </div>
                    </div>

                    {/* linha 2: sem alarmes */}
                    {client.problems.length === 0 && (
                      <div className="flex items-center gap-2 text-green-400/70">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">
                          Operacional — sem alarmes ativos
                        </span>
                      </div>
                    )}

                    {/* linha 2: lista de alarmes */}
                    {client.problems.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {client.problems.map((p) => (
                          <div
                            key={p.eventid}
                            className="flex items-center justify-between gap-3 rounded-[14px] border border-white/6 bg-black/15 px-4 py-2.5"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.2em] ${severityBadgeClass(p.severity)}`}>
                                {SEV_LABEL[p.severity] ?? p.severity}
                              </span>
                              <span className="text-[11px] font-semibold text-stone-300 truncate">
                                {p.name}
                              </span>
                            </div>
                            <span className="shrink-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.15em] text-stone-500">
                              <Clock className="w-3 h-3" />
                              {duration(p.clock)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* linha 3: host técnico */}
                    <p className="text-[10px] font-mono text-stone-600">
                      {client.host}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── FOOTER ──────────────────────────────────────────────────── */}
          {!loading && !error && stats && (
            <div className="flex items-center justify-between gap-4 rounded-[18px] border border-white/5 bg-white/[0.02] px-5 py-3 flex-wrap">
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-stone-600">
                <span className="flex items-center gap-1.5">
                  <Star className="w-3 h-3 text-amber-500" fill="currentColor" />
                  {stats.total} TOP Corp monitorados
                </span>
                {stats.offline > 0 && (
                  <span className="flex items-center gap-1.5 text-red-500">
                    <WifiOff className="w-3 h-3" />
                    {stats.offline} offline
                  </span>
                )}
                {stats.withAlarms > 0 && (
                  <span className="flex items-center gap-1.5 text-orange-500">
                    <AlertTriangle className="w-3 h-3" />
                    {stats.withAlarms} com alarme
                  </span>
                )}
                {stats.withDisaster > 0 && (
                  <span className="flex items-center gap-1.5 text-neon-pink">
                    <ShieldAlert className="w-3 h-3" />
                    {stats.withDisaster} desastre
                  </span>
                )}
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-600 flex items-center gap-1.5">
                <Activity className="w-3 h-3" />
                Zabbix · Monitoramento contínuo
              </span>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
