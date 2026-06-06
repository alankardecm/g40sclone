'use client';

import Sidebar from '@/components/Sidebar';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Bot,
  CheckCircle2,
  Database,
  ExternalLink,
  HardDrive,
  Mail,
  MessageSquareText,
  Mic,
  RefreshCw,
  Server,
  ShieldCheck,
  TriangleAlert,
  Wallet,
  XCircle,
  FileSpreadsheet,
  BarChart2,
  FileText,
  LayoutGrid,
  Zap,
} from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────────────────────

type ServiceStatus = 'ok' | 'error' | 'unknown' | 'loading';

type ServiceCard = {
  key: string;
  label: string;
  detail: string;
  status: ServiceStatus;
  meta?: string;
  icon: React.ElementType;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ServiceStatus }) {
  if (status === 'loading') return <div className="h-2.5 w-2.5 rounded-full bg-stone-600 animate-pulse" />;
  if (status === 'ok')      return <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />;
  if (status === 'error')   return <div className="h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.5)] animate-pulse" />;
  return <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />;
}

function statusLabel(s: ServiceStatus) {
  if (s === 'loading') return 'Verificando...';
  if (s === 'ok')      return 'Conectado';
  if (s === 'error')   return 'Erro';
  return 'Desconhecido';
}

function statusStyle(s: ServiceStatus) {
  if (s === 'ok')    return 'border-emerald-500/20 bg-emerald-500/8 text-emerald-400';
  if (s === 'error') return 'border-red-500/20 bg-red-500/8 text-red-400';
  return 'border-white/10 bg-card/[0.03] text-muted-foreground';
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [services, setServices] = useState<ServiceCard[]>([
    { key: 'supabase',  label: 'Supabase',       detail: 'Banco operacional (PostgreSQL)',     status: 'loading', icon: Database },
    { key: 'mysql',     label: 'MySQL DataLake',  detail: 'Data Lake interno',                 status: 'loading', icon: HardDrive },
    { key: 'openai',    label: 'OpenAI',          detail: 'Chat · TTS · Embeddings',           status: 'loading', icon: Bot },
    { key: 'outlook',   label: 'Outlook',         detail: 'Microsoft 365 corporativo',         status: 'loading', icon: Mail },
    { key: 'zabbix',    label: 'Zabbix',          detail: 'Monitoramento de rede',             status: 'loading', icon: ShieldCheck },
    { key: 'whatsapp',  label: 'WhatsApp Bridge', detail: 'Bridge local de mensagens',         status: 'loading', icon: MessageSquareText },
    { key: 'groq',      label: 'Groq',            detail: 'LLM · IA Comunicação',             status: 'unknown', icon: Zap, meta: 'Validado indiretamente' },
    { key: 'pinecone',  label: 'Pinecone',        detail: 'Banco vetorial do RAG',             status: 'unknown', icon: FileText, meta: 'Validado indiretamente' },
  ]);

  const updateService = useCallback((key: string, status: ServiceStatus, meta?: string) => {
    setServices((prev) =>
      prev.map((s) => s.key === key ? { ...s, status, ...(meta ? { meta } : {}) } : s)
    );
  }, []);

  const runChecks = useCallback(async () => {
    setLoading(true);
    // Reset serviços verificáveis para "loading"
    setServices((prev) =>
      prev.map((s) => ['supabase', 'mysql', 'openai', 'outlook', 'zabbix', 'whatsapp'].includes(s.key)
        ? { ...s, status: 'loading' as ServiceStatus }
        : s
      )
    );

    await Promise.allSettled([
      // 1. Health geral (Supabase + MySQL + OpenAI)
      fetch('/api/health/full').then(async (r) => {
        const d = await r.json();
        updateService('supabase', d?.services?.supabase?.status === 'ok' ? 'ok' : 'error',
          d?.services?.supabase?.message || undefined);
        updateService('mysql', d?.services?.mysql?.status === 'ok' ? 'ok' : 'error',
          d?.services?.mysql?.message || undefined);
        updateService('openai', d?.services?.openai?.status === 'ok' ? 'ok' : 'error',
          d?.services?.openai?.message || undefined);
      }).catch(() => {
        updateService('supabase', 'error', 'Falha ao atingir /api/health/full');
        updateService('mysql', 'error');
        updateService('openai', 'error');
      }),

      // 2. Outlook
      fetch('/api/communications/outlook/status').then(async (r) => {
        const d = await r.json();
        const s = d?.connected ? 'ok' : d?.configured ? 'unknown' : 'error';
        const meta = d?.connected
          ? `${d.account?.name || ''} (${d.account?.email || ''})`.trim()
          : d?.configured ? 'Configurado, não autenticado' : 'Não configurado';
        updateService('outlook', s, meta);
      }).catch(() => updateService('outlook', 'error')),

      // 3. Zabbix
      fetch('/api/zabbix?view=summary').then(async (r) => {
        const d = await r.json();
        if (d?.ok) {
          const meta = `${d.summary?.totalHosts ?? 0} hosts · ${d.summary?.totalProblems ?? 0} problemas`;
          updateService('zabbix', 'ok', meta);
        } else {
          updateService('zabbix', 'error', d?.error || 'Falha na conexão');
        }
      }).catch(() => updateService('zabbix', 'error')),

      // 4. WhatsApp Bridge (via grupos ativos)
      fetch('/api/wa-monitor/groups').then(async (r) => {
        const d = await r.json();
        if (d?.ok) {
          const count = d.groups?.length ?? 0;
          updateService('whatsapp', 'ok', `${count} grupo${count !== 1 ? 's' : ''} registrado${count !== 1 ? 's' : ''}`);
        } else {
          updateService('whatsapp', 'error', 'Bridge sem resposta');
        }
      }).catch(() => updateService('whatsapp', 'error', 'Bridge offline')),
    ]);

    setLastChecked(new Date().toLocaleString('pt-BR'));
    setLoading(false);
  }, [updateService]);

  useEffect(() => { runChecks(); }, [runChecks]);

  // Agrupamentos
  const healthyCount = services.filter((s) => s.status === 'ok').length;
  const errorCount   = services.filter((s) => s.status === 'error').length;
  const unknownCount = services.filter((s) => s.status === 'unknown' || s.status === 'loading').length;

  const modules = [
    { label: 'Workspace',       href: '/dashboard',             icon: LayoutGrid },
    { label: 'Monitoramento',   href: '/dashboard/noc',         icon: Activity },
    { label: 'Zabbix',          href: '/monitoring/zabbix',     icon: ShieldCheck },
    { label: 'IA Comunicação',  href: '/dashboard/comunicacao', icon: MessageSquareText },
    { label: 'Alertas',         href: '/dashboard/alertas',     icon: TriangleAlert },
    { label: 'Custos',          href: '/dashboard/custos',      icon: Wallet },
    { label: 'NetMeet',         href: '/dashboard/netmeet',     icon: Mic },
    { label: 'DataLake',        href: '/datalake',              icon: Database },
    { label: 'RAG',             href: '/rag',                   icon: FileText },
    { label: 'Dashboards',      href: '/dashboards',            icon: BarChart2 },
  ];

  const configFiles = [
    { label: 'CUSTOS_HUB_TEMPLATE.csv',    path: 'docs/CUSTOS_HUB_TEMPLATE.csv',   desc: 'Base de custos operacionais' },
    { label: 'TOKEN_COSTS_PROJETOS.csv',   path: 'docs/TOKEN_COSTS_PROJETOS.csv',  desc: 'Custos reais de tokens por projeto' },
    { label: 'CUSTOS_HUB_CENARIOS.md',     path: 'docs/CUSTOS_HUB_CENARIOS.md',    desc: 'Cenários e projeções de custo' },
    { label: 'groups.whitelist.js',        path: '08 - IA COMUNICACAO/bridge/config/groups.whitelist.js', desc: 'Whitelist de grupos WA' },
  ];

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans antialiased">
      <Sidebar />
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-6 py-6 lg:px-10 flex flex-col gap-6 pb-16">

          {/* ── HEADER ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-white/5 bg-card px-8 py-6 shadow-xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Hub Operacional</p>
                <h1 className="mt-1 text-2xl font-[950] uppercase tracking-[-0.03em]">Diagnóstico & Status</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  Saúde de todas as conexões do Hub em tempo real.
                  {lastChecked && <span className="ml-2 text-muted-foreground">Última verificação: {lastChecked}</span>}
                </p>
              </div>
              <button
                onClick={runChecks}
                disabled={loading}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-card/[0.03] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground hover:text-white transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Verificar tudo
              </button>
            </div>

            {/* KPIs de saúde */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { label: 'Saudáveis',     value: healthyCount, color: 'text-emerald-400' },
                { label: 'Com falha',     value: errorCount,   color: errorCount > 0 ? 'text-red-400' : 'text-muted-foreground' },
                { label: 'Indefinidos',   value: unknownCount, color: 'text-muted-foreground' },
              ].map((k) => (
                <div key={k.label} className="rounded-[22px] border border-white/5 bg-card/[0.03] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{k.label}</p>
                  <p className={`mt-2 text-2xl font-[1000] tracking-[-0.05em] ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── SERVIÇOS ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-3 px-1">
              Serviços & Integrações
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {services.map((svc) => (
                <div
                  key={svc.key}
                  className={`rounded-[26px] border p-5 transition-all ${statusStyle(svc.status)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card/[0.04]">
                      <svc.icon className="h-5 w-5" />
                    </div>
                    <StatusDot status={svc.status} />
                  </div>
                  <p className="mt-4 text-sm font-black uppercase tracking-[-0.01em]">{svc.label}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{svc.detail}</p>
                  {svc.meta && (
                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] opacity-70 truncate">
                      {svc.meta}
                    </p>
                  )}
                  <div className="mt-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${statusStyle(svc.status)}`}>
                      {svc.status === 'loading'
                        ? <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                        : svc.status === 'ok'
                        ? <CheckCircle2 className="h-2.5 w-2.5" />
                        : svc.status === 'error'
                        ? <XCircle className="h-2.5 w-2.5" />
                        : <TriangleAlert className="h-2.5 w-2.5" />
                      }
                      {statusLabel(svc.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── AMBIENTE ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[28px] border border-white/5 bg-card px-6 py-5"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-4">
              Ambiente & Build
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Ambiente',    value: 'Paralelo',     note: 'Hub Reestruturado' },
                { label: 'Porta',       value: '4200',         note: 'Validação em paralelo' },
                { label: 'Framework',   value: 'Next.js',      note: 'App Router · TypeScript' },
                { label: 'Módulos',     value: `${modules.length}`,  note: 'Páginas ativas no Hub' },
              ].map((item) => (
                <div key={item.label} className="rounded-[20px] border border-white/5 bg-card/[0.03] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                  <p className="mt-1.5 text-base font-black tracking-[-0.02em]">{item.value}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{item.note}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── MÓDULOS DO HUB ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-[28px] border border-white/5 bg-card px-6 py-5"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-4">
              Mapa de Módulos
            </p>
            <div className="flex flex-wrap gap-2">
              {modules.map((mod) => (
                <a
                  key={mod.href}
                  href={mod.href}
                  className="group flex items-center gap-2 rounded-full border border-white/10 bg-card/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground hover:border-[#379890]/30 hover:bg-[#379890]/8 hover:text-[#379890] transition-all"
                >
                  <mod.icon className="h-3.5 w-3.5" />
                  {mod.label}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </motion.div>

          {/* ── ARQUIVOS DE CONFIGURAÇÃO ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-[28px] border border-white/5 bg-card px-6 py-5"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-4">
              Arquivos de Configuração
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {configFiles.map((f) => (
                <div
                  key={f.path}
                  className="flex items-center gap-3 rounded-[18px] border border-white/5 bg-card/[0.03] px-4 py-3"
                >
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-stone-200 truncate">
                      {f.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</p>
                    <p className="text-[9px] text-foreground font-mono mt-0.5 truncate">{f.path}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── APIs DO HUB ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-[28px] border border-white/5 bg-card px-6 py-5"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-4">
              APIs Internas
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                '/api/health/full',
                '/api/zabbix',
                '/api/wa-monitor/insights',
                '/api/wa-monitor/alerts',
                '/api/wa-monitor/groups',
                '/api/wa-monitor/live',
                '/api/wa-monitor/export',
                '/api/wa-monitor/group-brief',
                '/api/communications/outlook/status',
                '/api/communications/outlook/sync',
                '/api/datalake/schema',
                '/api/datalake/preview',
                '/api/datalake/query',
                '/api/netmeet/meetings',
                '/api/dashboards',
                '/api/chat',
              ].map((route) => (
                <span
                  key={route}
                  className="rounded-full border border-white/8 bg-card/[0.02] px-2.5 py-1 font-mono text-[10px] text-muted-foreground"
                >
                  {route}
                </span>
              ))}
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
