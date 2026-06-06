'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Database,
  HardDrive,
  Mail,
  RefreshCcw,
  Server,
  ShieldCheck,
  Wifi,
  XCircle,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';

type ConnectionRow = {
  usuario?: string;
  mac?: string;
  cidade?: string;
  ativo?: string;
};

type ZabbixSummary = {
  totalProblems: number;
  disasters: number;
  highSeverity: number;
  hostsUp: number;
  hostsDown: number;
  hostsUnknown: number;
  totalHosts: number;
};

type ZabbixHost = {
  hostid: string;
  name: string;
  host: string;
  available?: string;
  groups?: { groupid: string; name: string }[];
  interfaces?: { ip: string; main: string }[];
};

type ZabbixProblem = {
  eventid: string;
  name: string;
  severity: string;
  clock: string;
  hosts?: { hostid: string; name: string }[];
};

type DatalakeTable = {
  name: string;
  rows: number | null;
  updatedAt: string | null;
  engine: string | null;
};

type DatalakeOverview = {
  ok: boolean;
  status: 'connected' | 'disconnected' | 'error';
  database: string | null;
  host: string | null;
  port: number | null;
  tableCount: number;
  tables: DatalakeTable[];
  message?: string;
};

type OutlookStatus = {
  ok: boolean;
  configured: boolean;
  connected: boolean;
  account: { name: string | null; email: string | null } | null;
};

type SupportService = {
  label: string;
  status: 'healthy' | 'warning' | 'down';
  detail: string;
  meta: string;
};

const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    : null;

function formatTimestamp(value?: string | null) {
  if (!value) return 'Sem registro recente';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem registro recente';
  return date.toLocaleString('pt-BR');
}

function formatCompactNumber(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function getSeverityLabel(severity: string) {
  if (severity === '5') return 'Desastre';
  if (severity === '4') return 'Alta';
  if (severity === '3') return 'Media';
  if (severity === '2') return 'Aviso';
  if (severity === '1') return 'Informacao';
  return 'Nao classificado';
}

function getSeverityClass(severity: string) {
  if (severity === '5') return 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300';
  if (severity === '4') return 'border-red-500/30 bg-red-500/10 text-red-300';
  if (severity === '3') return 'border-orange-500/30 bg-orange-500/10 text-orange-300';
  if (severity === '2') return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300';
  return 'border-stone-500/20 bg-stone-500/10 text-stone-300';
}

function getHostStatusLabel(available?: string) {
  if (available === '1') return 'UP';
  if (available === '2') return 'DOWN';
  return 'UNKNOWN';
}

function getHostStatusClass(available?: string) {
  if (available === '1') return 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10';
  if (available === '2') return 'text-red-300 border-red-500/20 bg-red-500/10';
  return 'text-stone-300 border-stone-500/20 bg-stone-500/10';
}

function getServiceTone(status: SupportService['status']) {
  if (status === 'healthy') return 'border-emerald-500/20 bg-emerald-500/8 text-emerald-300';
  if (status === 'warning') return 'border-yellow-500/20 bg-yellow-500/8 text-yellow-300';
  return 'border-red-500/20 bg-red-500/8 text-red-300';
}

export default function InfraDashboard() {
  const [refreshing, setRefreshing] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [zabbixSummary, setZabbixSummary] = useState<ZabbixSummary | null>(null);
  const [hosts, setHosts] = useState<ZabbixHost[]>([]);
  const [problems, setProblems] = useState<ZabbixProblem[]>([]);
  const [datalake, setDatalake] = useState<DatalakeOverview | null>(null);
  const [outlook, setOutlook] = useState<OutlookStatus | null>(null);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [sinkHealthy, setSinkHealthy] = useState<boolean>(false);
  const [errors, setErrors] = useState<string[]>([]);

  const loadSinkConnections = useCallback(async () => {
    if (!supabase) {
      return {
        healthy: false,
        connections: [] as ConnectionRow[],
        error: 'Supabase nao configurado no front do HUB.',
      };
    }

    const { data, error } = await supabase
      .from('connections')
      .select('usuario,mac,cidade,ativo')
      .limit(8);

    return {
      healthy: !error,
      connections: (data as ConnectionRow[]) || [],
      error: error?.message || null,
    };
  }, []);

  const loadInfra = useCallback(async () => {
    setRefreshing(true);
    const nextErrors: string[] = [];

    const [summaryRes, hostsRes, problemsRes, datalakeRes, outlookRes, sinkRes] = await Promise.allSettled([
      fetch('/api/zabbix?view=summary', { cache: 'no-store' }),
      fetch('/api/zabbix?view=hosts&limit=12', { cache: 'no-store' }),
      fetch('/api/zabbix?view=problems&limit=8', { cache: 'no-store' }),
      fetch('/api/datalake/schema', { cache: 'no-store' }),
      fetch('/api/communications/outlook/status', { cache: 'no-store' }),
      loadSinkConnections(),
    ]);

    if (summaryRes.status === 'fulfilled') {
      const payload = await summaryRes.value.json();
      if (payload.ok) {
        setZabbixSummary(payload.summary as ZabbixSummary);
      } else {
        nextErrors.push(payload.error || 'Falha ao ler resumo do Zabbix.');
        setZabbixSummary(null);
      }
    } else {
      nextErrors.push('Falha ao consultar resumo do Zabbix.');
      setZabbixSummary(null);
    }

    if (hostsRes.status === 'fulfilled') {
      const payload = await hostsRes.value.json();
      if (payload.ok) {
        setHosts((payload.hosts as ZabbixHost[]) || []);
      } else {
        nextErrors.push(payload.error || 'Falha ao ler hosts do Zabbix.');
        setHosts([]);
      }
    } else {
      nextErrors.push('Falha ao consultar hosts do Zabbix.');
      setHosts([]);
    }

    if (problemsRes.status === 'fulfilled') {
      const payload = await problemsRes.value.json();
      if (payload.ok) {
        setProblems((payload.problems as ZabbixProblem[]) || []);
      } else {
        nextErrors.push(payload.error || 'Falha ao ler problemas ativos.');
        setProblems([]);
      }
    } else {
      nextErrors.push('Falha ao consultar problemas ativos do Zabbix.');
      setProblems([]);
    }

    if (datalakeRes.status === 'fulfilled') {
      const payload = (await datalakeRes.value.json()) as DatalakeOverview;
      setDatalake(payload);
      if (!payload.ok) {
        nextErrors.push(payload.message || 'Data Lake indisponivel.');
      }
    } else {
      nextErrors.push('Falha ao consultar saude do Data Lake.');
      setDatalake(null);
    }

    if (outlookRes.status === 'fulfilled') {
      const payload = (await outlookRes.value.json()) as OutlookStatus;
      setOutlook(payload);
    } else {
      nextErrors.push('Falha ao consultar status do Outlook corporativo.');
      setOutlook(null);
    }

    if (sinkRes.status === 'fulfilled') {
      setConnections(sinkRes.value.connections);
      setSinkHealthy(sinkRes.value.healthy);
      if (sinkRes.value.error) {
        nextErrors.push(sinkRes.value.error);
      }
    } else {
      setConnections([]);
      setSinkHealthy(false);
      nextErrors.push('Falha ao consultar sink operacional do HUB.');
    }

    setErrors(nextErrors);
    setLastSync(new Date().toISOString());
    setRefreshing(false);
  }, [loadSinkConnections]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInfra();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadInfra]);

  const criticalProblems = useMemo(
    () => problems.filter((problem) => Number(problem.severity || '0') >= 4),
    [problems]
  );

  const infraCoverage = useMemo(() => {
    const checks = [
      Boolean(zabbixSummary),
      Boolean(datalake?.ok),
      Boolean(outlook?.configured),
      Boolean(sinkHealthy),
    ];
    return {
      healthy: checks.filter(Boolean).length,
      total: checks.length,
    };
  }, [datalake?.ok, outlook?.configured, sinkHealthy, zabbixSummary]);

  const services = useMemo<SupportService[]>(() => {
    const list: SupportService[] = [];

    list.push(
      zabbixSummary
        ? {
            label: 'Zabbix Monitor',
            status: zabbixSummary.hostsDown > 0 || zabbixSummary.totalProblems > 0 ? 'warning' : 'healthy',
            detail: `${zabbixSummary.totalHosts} hosts monitorados · ${zabbixSummary.totalProblems} problemas ativos`,
            meta: `${zabbixSummary.hostsDown} host(s) down · ${zabbixSummary.hostsUnknown} unknown`,
          }
        : {
            label: 'Zabbix Monitor',
            status: 'down',
            detail: 'Nao foi possivel consultar o endpoint do Zabbix',
            meta: 'Revisar token, host groups e conectividade',
          }
    );

    list.push(
      datalake?.ok
        ? {
            label: 'Data Lake MySQL',
            status: 'healthy',
            detail: `${datalake.database || 'base'} em ${datalake.host || 'host nao informado'}`,
            meta: `${datalake.tableCount} tabelas visiveis · porta ${datalake.port || '-'}`,
          }
        : {
            label: 'Data Lake MySQL',
            status: datalake?.status === 'disconnected' ? 'warning' : 'down',
            detail: datalake?.message || 'Nao foi possivel validar a conexao com o Data Lake',
            meta: datalake?.host || 'Sem host configurado',
          }
    );

    list.push(
      outlook?.configured
        ? {
            label: 'Outlook Corporativo',
            status: outlook.connected ? 'healthy' : 'warning',
            detail: outlook.connected
              ? `Conta ativa: ${outlook.account?.email || 'conta autenticada'}`
              : 'Configurado, mas sem conta conectada agora',
            meta: 'Microsoft Graph liberado para o HUB',
          }
        : {
            label: 'Outlook Corporativo',
            status: 'down',
            detail: 'Configuracao do Outlook nao encontrada no ambiente',
            meta: 'Revisar tenant, client id e secret',
          }
    );

    list.push(
      sinkHealthy
        ? {
            label: 'Sink Operacional do HUB',
            status: 'healthy',
            detail: `${connections.length} conexoes recentes acessiveis via Supabase`,
            meta: 'Usado como trilha operacional do ecossistema',
          }
        : {
            label: 'Sink Operacional do HUB',
            status: 'warning',
            detail: 'Nao foi possivel validar a leitura das conexoes recentes',
            meta: 'Supabase ou tabela connections precisa de revisao',
          }
    );

    return list;
  }, [connections.length, datalake, outlook, sinkHealthy, zabbixSummary]);

  const topTables = useMemo(() => {
    const tables = datalake?.tables || [];
    return [...tables]
      .sort((a, b) => (b.rows || 0) - (a.rows || 0))
      .slice(0, 6);
  }, [datalake?.tables]);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground">
      <Sidebar />

      <main className="custom-scrollbar flex flex-1 flex-col overflow-y-auto px-10 py-10">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.32em] text-muted-foreground">
              <span>Infraestrutura</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-[#379890]">Infra</span>
            </div>
            <h1 className="mt-4 text-4xl font-[950] uppercase tracking-[-0.07em] text-[#143230]">
              Monitoramento de Infra do HUB
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Esta tela saiu do NOC generico e agora acompanha a sustentacao real do HUB:
              Zabbix, Data Lake, Outlook corporativo e o sink operacional que alimenta as trilhas do sistema.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-[24px] border border-[#143230]/8 bg-card px-5 py-4 text-right shadow-[0_18px_40px_-34px_rgba(20,50,48,0.28)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">Ultimo sync</p>
              <p className="mt-1 text-xs font-semibold text-[#143230]">
                {refreshing ? 'Atualizando...' : formatTimestamp(lastSync)}
              </p>
            </div>

            <button
              onClick={() => void loadInfra()}
              className="inline-flex items-center gap-2 rounded-pill border border-[#379890]/25 bg-[#379890] px-5 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-[0_20px_40px_-28px_rgba(55,152,144,0.5)] transition-all hover:brightness-105"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[30px] border border-[#143230]/8 bg-card p-6 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-muted-foreground">Hosts monitorados</p>
            <div className="mt-4 flex items-end justify-between">
              <h2 className="text-3xl font-[950] text-[#143230]">{zabbixSummary?.totalHosts ?? '-'}</h2>
              <Server className="h-6 w-6 text-[#379890]" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {zabbixSummary
                ? `${zabbixSummary.hostsUp} up · ${zabbixSummary.hostsDown} down · ${zabbixSummary.hostsUnknown} unknown`
                : 'Resumo do Zabbix indisponivel no momento'}
            </p>
          </div>

          <div className="rounded-[30px] border border-[#143230]/8 bg-card p-6 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-muted-foreground">Problemas criticos</p>
            <div className="mt-4 flex items-end justify-between">
              <h2 className="text-3xl font-[950] text-[#143230]">{criticalProblems.length}</h2>
              <AlertTriangle className="h-6 w-6 text-[#f59e0b]" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {zabbixSummary
                ? `${zabbixSummary.disasters} desastre(s) e ${zabbixSummary.highSeverity} alta(s) no Zabbix`
                : 'Sem leitura consolidada de severidade'}
            </p>
          </div>

          <div className="rounded-[30px] border border-[#143230]/8 bg-card p-6 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-muted-foreground">Data Lake</p>
            <div className="mt-4 flex items-end justify-between">
              <h2 className="text-3xl font-[950] text-[#143230]">{datalake?.tableCount ?? '-'}</h2>
              <Database className="h-6 w-6 text-[#379890]" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {datalake?.ok
                ? `${datalake.database || 'base'} em ${datalake.host || 'host nao informado'}`
                : datalake?.message || 'Sem validacao do MySQL agora'}
            </p>
          </div>

          <div className="rounded-[30px] border border-[#143230]/8 bg-card p-6 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-muted-foreground">Cobertura infra</p>
            <div className="mt-4 flex items-end justify-between">
              <h2 className="text-3xl font-[950] text-[#143230]">
                {infraCoverage.healthy}/{infraCoverage.total}
              </h2>
              <ShieldCheck className="h-6 w-6 text-[#7ce5dc]" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Componentes-base validados no momento de leitura do dashboard
            </p>
          </div>
        </section>

        <section className="mb-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[34px] border border-[#143230]/8 bg-card p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-muted-foreground">Servicos-base</p>
                <h3 className="mt-2 text-xl font-[900] uppercase tracking-[-0.04em]">
                  Camada de sustentacao do HUB
                </h3>
              </div>
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {services.map((service) => (
                <article
                  key={service.label}
                  className={`rounded-[24px] border p-5 ${getServiceTone(service.status)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em]">{service.label}</p>
                      <p className="mt-4 text-sm font-semibold leading-relaxed">{service.detail}</p>
                    </div>
                    {service.status === 'healthy' ? (
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                    ) : service.status === 'warning' ? (
                      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 flex-shrink-0" />
                    )}
                  </div>
                  <p className="mt-4 text-xs text-white/70">{service.meta}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[34px] border border-[#143230]/8 bg-card p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-muted-foreground">Alertas</p>
                <h3 className="mt-2 text-xl font-[900] uppercase tracking-[-0.04em]">
                  Incidentes que merecem atencao
                </h3>
              </div>
              <AlertTriangle className="h-5 w-5 text-[#f59e0b]" />
            </div>

            <div className="space-y-3">
              {problems.length === 0 ? (
                <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-5 text-sm text-emerald-700">
                  Nenhum problema ativo retornou do Zabbix no recorte atual.
                </div>
              ) : (
                problems.map((problem) => (
                  <div key={problem.eventid} className="rounded-[24px] border border-[#143230]/8 bg-card/[0.55] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#143230]">{problem.name}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {(problem.hosts || []).map((host) => host.name).join(', ') || 'Host nao informado'}
                        </p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Desde {formatTimestamp(problem.clock ? new Date(Number(problem.clock) * 1000).toISOString() : null)}
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${getSeverityClass(problem.severity)}`}>
                        {getSeverityLabel(problem.severity)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-[34px] border border-[#143230]/8 bg-card p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-muted-foreground">Inventario</p>
                <h3 className="mt-2 text-xl font-[900] uppercase tracking-[-0.04em]">
                  Hosts acompanhados pelo Zabbix
                </h3>
              </div>
              <Server className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {hosts.length === 0 ? (
                <div className="rounded-[24px] border border-[#143230]/8 bg-card/[0.55] p-5 text-sm text-muted-foreground">
                  Nenhum host foi carregado do Zabbix. Se isso nao era esperado, revisar grupos liberados e conectividade.
                </div>
              ) : (
                hosts.map((host) => (
                  <div key={host.hostid} className="flex items-center justify-between rounded-[24px] border border-[#143230]/8 bg-card/[0.55] p-4">
                    <div>
                      <p className="text-sm font-semibold text-[#143230]">{host.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {host.interfaces?.find((item) => item.main === '1')?.ip || host.host}
                      </p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {(host.groups || []).map((group) => group.name).join(' · ') || 'Sem grupo informado'}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${getHostStatusClass(host.available)}`}>
                      {getHostStatusLabel(host.available)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[34px] border border-[#143230]/8 bg-card p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-muted-foreground">Data Lake</p>
                <h3 className="mt-2 text-xl font-[900] uppercase tracking-[-0.04em]">
                  Tabelas mais relevantes agora
                </h3>
              </div>
              <HardDrive className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {topTables.length === 0 ? (
                <div className="rounded-[24px] border border-[#143230]/8 bg-card/[0.55] p-5 text-sm text-muted-foreground">
                  O overview do Data Lake nao retornou tabelas visiveis neste momento.
                </div>
              ) : (
                topTables.map((table) => (
                  <div key={table.name} className="rounded-[24px] border border-[#143230]/8 bg-card/[0.55] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#143230]">{table.name}</p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Engine: {table.engine || '-'} · Atualizacao: {formatTimestamp(table.updatedAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-[900] text-[#7ce5dc]">{formatCompactNumber(table.rows)}</p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">linhas</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="mb-12 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[34px] border border-[#143230]/8 bg-card p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-muted-foreground">Sink operacional</p>
                <h3 className="mt-2 text-xl font-[900] uppercase tracking-[-0.04em]">
                  Trilhas recentes do ambiente
                </h3>
              </div>
              <Wifi className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {connections.length === 0 ? (
                <div className="rounded-[24px] border border-[#143230]/8 bg-card/[0.55] p-5 text-sm text-muted-foreground">
                  Nenhuma conexao recente apareceu aqui. Isso pode significar sink vazio ou leitura indisponivel.
                </div>
              ) : (
                connections.map((connection, index) => (
                  <div key={`${connection.mac || 'conn'}-${index}`} className="flex items-center justify-between rounded-[24px] border border-[#143230]/8 bg-card/[0.55] p-4">
                    <div>
                      <p className="text-sm font-semibold text-[#143230]">{connection.usuario || 'Usuario nao identificado'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{connection.mac || 'MAC indisponivel'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-stone-300">{connection.cidade || '-'}</p>
                      <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${connection.ativo === 'Sim' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-stone-500/20 bg-stone-500/10 text-stone-300'}`}>
                        {connection.ativo === 'Sim' ? 'Conectado' : 'Offline'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[34px] border border-[#143230]/8 bg-card p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-muted-foreground">Leitura executiva</p>
                <h3 className="mt-2 text-xl font-[900] uppercase tracking-[-0.04em]">
                  O que acompanhar nesta camada
                </h3>
              </div>
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <div className="rounded-[24px] border border-[#143230]/8 bg-card/[0.55] p-5">
                Zabbix entra aqui como fonte primaria de saude da infraestrutura. Se host down, problema critico ou permissao falhar, o dashboard precisa acusar isso sem maquiagem.
              </div>
              <div className="rounded-[24px] border border-[#143230]/8 bg-card/[0.55] p-5">
                Data Lake entra como base operacional do analytics. Se a conexao MySQL cair, a cadeia de dashboards e consultas perde sustentacao.
              </div>
              <div className="rounded-[24px] border border-[#143230]/8 bg-card/[0.55] p-5">
                Outlook e sink operacional nao sao “servidores” no sentido classico, mas sao componentes de sustentacao do HUB e precisam ser vistos na mesma camada de Infra.
              </div>

              {errors.length > 0 && (
                <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-5 text-red-700">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Pendencias detectadas</p>
                  <ul className="mt-4 space-y-2">
                    {errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
