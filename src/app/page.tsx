'use client';

import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Activity, Bell, Bot, CheckCircle2,
  Database, MessageSquare, Settings,
  TriangleAlert, XCircle, RefreshCw,
  ArrowRight, Zap,
} from 'lucide-react';

type HealthStatus = 'loading' | 'ok' | 'degraded' | 'error';

type ServiceHealth = {
  label: string;
  status: 'ok' | 'error' | 'unknown';
};

const QUICK_LINKS = [
  { label: 'Monitoramento', href: '/dashboard/noc',        icon: Activity,      desc: 'NOC e saúde dos serviços' },
  { label: 'Zabbix',        href: '/monitoring/zabbix',    icon: Bell,          desc: 'Alarmes em tempo real' },
  { label: 'IA Comunicação',href: '/dashboard/comunicacao',icon: Bot,           desc: 'WhatsApp e sentimento' },
  { label: 'DataLake',      href: '/datalake',             icon: Database,      desc: 'Dados e dashboards' },
  { label: 'Chat',          href: '/chat',                 icon: MessageSquare, desc: 'Assistente interno com IA' },
  { label: 'Diagnóstico',   href: '/settings',             icon: Settings,      desc: 'Status das conexões' },
];

function StatusBadge({ status }: { status: HealthStatus }) {
  if (status === 'loading') return (
    <span className="flex items-center gap-1.5 text-gray-400 text-[11px] font-bold">
      <RefreshCw className="h-3 w-3 animate-spin" /> Verificando...
    </span>
  );
  if (status === 'ok') return (
    <span className="flex items-center gap-1.5 text-emerald-600 text-[11px] font-black uppercase tracking-[0.15em]">
      <CheckCircle2 className="h-3.5 w-3.5" /> Tudo operacional
    </span>
  );
  if (status === 'degraded') return (
    <span className="flex items-center gap-1.5 text-amber-500 text-[11px] font-black uppercase tracking-[0.15em]">
      <TriangleAlert className="h-3.5 w-3.5" /> Degradado
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-red-500 text-[11px] font-black uppercase tracking-[0.15em]">
      <XCircle className="h-3.5 w-3.5" /> Falha detectada
    </span>
  );
}

export default function HubHomePage() {
  const { data: session } = useSession()
  const firstName = (session?.user?.name?.split(' ')[0] ?? process.env.NEXT_PUBLIC_APP_DEFAULT_USER) || 'Membro'
  const [health, setHealth] = useState<HealthStatus>('loading');
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [healthy, setHealthy] = useState(0);
  const [total, setTotal] = useState(0);
  const [hora, setHora] = useState('');

  useEffect(() => {
    setHora(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

    fetch('/api/health/full')
      .then((r) => r.json())
      .then((d) => {
        const svcs: ServiceHealth[] = Object.entries(d?.services ?? {}).map(([key, val]) => ({
          label: key.charAt(0).toUpperCase() + key.slice(1),
          status: (val as { status: string }).status === 'ok' ? 'ok' : 'error',
        }));
        const okCount = svcs.filter((s) => s.status === 'ok').length;
        setServices(svcs);
        setHealthy(okCount);
        setTotal(svcs.length);
        setHealth(okCount === svcs.length ? 'ok' : okCount > 0 ? 'degraded' : 'error');
      })
      .catch(() => setHealth('error'));
  }, []);

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Bom dia' :
    now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans">
      <Sidebar />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-5xl px-8 py-10 flex flex-col gap-8">

          {/* ── HERO ── */}
          <div className="rounded-[36px] border border-gray-200 bg-white p-10 shadow-[0_8px_40px_rgba(64,64,64,0.07)] relative overflow-hidden">
            <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-[#8DC63F]/8 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-[#8DC63F]/5 blur-2xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-[#8DC63F]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
                    {process.env.NEXT_PUBLIC_APP_NAME || "G4OS"} {process.env.NEXT_PUBLIC_APP_SUBTITLE || "Hub Operacional"}
                  </span>
                </div>
                <h1 className="text-4xl font-[1000] tracking-[-0.05em] text-[#404040] lg:text-5xl">
                  {greeting},<br />
                  <span className="text-[#8DC63F]">{firstName}.</span>
                </h1>
                <p className="mt-3 text-sm text-gray-400 leading-relaxed max-w-md">
                  Central de inteligência e automação da empresa. Acesse monitoramento, comunicação, dados e IA em um só lugar.
                </p>
              </div>

              {/* Status summary */}
              <div className="flex flex-col items-start lg:items-end gap-3">
                <StatusBadge status={health} />
                {total > 0 && (
                  <div className="flex gap-2">
                    {services.map((svc) => (
                      <div
                        key={svc.label}
                        title={svc.label}
                        className={`h-2 w-8 rounded-full ${svc.status === 'ok' ? 'bg-[#8DC63F]' : 'bg-red-400'}`}
                      />
                    ))}
                  </div>
                )}
                {total > 0 && (
                  <p className="text-[10px] text-gray-400 font-bold">
                    {healthy}/{total} serviços operacionais
                  </p>
                )}
                {hora && (
                  <p className="text-[10px] text-gray-300 font-bold uppercase tracking-[0.2em]">
                    Verificado às {hora}
                  </p>
                )}
              </div>
            </div>

            <div className="relative mt-8 flex gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-[#8DC63F] px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_8px_24px_-8px_rgba(141,198,63,0.5)] transition-all hover:-translate-y-0.5 hover:bg-[#7ab030]"
              >
                Abrir Workspace
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 transition-all hover:-translate-y-0.5 hover:border-[#8DC63F]/40 hover:text-[#8DC63F]"
              >
                <Settings className="h-3.5 w-3.5" />
                Ver Diagnóstico
              </Link>
            </div>
          </div>

          {/* ── ACESSO RÁPIDO ── */}
          <div>
            <p className="mb-4 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 px-1">
              Acesso rápido
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center gap-4 rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_2px_12px_rgba(64,64,64,0.05)] transition-all hover:-translate-y-0.5 hover:border-[#8DC63F]/30 hover:shadow-[0_8px_24px_rgba(141,198,63,0.10)]"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[#8DC63F]/10 transition-colors group-hover:bg-[#8DC63F]/20">
                    <link.icon className="h-4.5 w-4.5 text-[#8DC63F]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black uppercase tracking-[0.04em] text-[#404040]">{link.label}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400 truncate">{link.desc}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-300 opacity-0 transition-all group-hover:text-[#8DC63F] group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </div>

          {/* ── STATUS COMPACTO ── */}
          {services.length > 0 && (
            <div className="rounded-[28px] border border-gray-200 bg-white p-6 shadow-[0_2px_12px_rgba(64,64,64,0.05)]">
              <div className="flex items-center justify-between mb-5">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
                  Status das conexões
                </p>
                <Link
                  href="/settings"
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8DC63F] hover:underline"
                >
                  Ver detalhes →
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {services.map((svc) => (
                  <div
                    key={svc.label}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                      svc.status === 'ok'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                        : 'border-red-200 bg-red-50 text-red-500'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${svc.status === 'ok' ? 'bg-emerald-500' : 'bg-red-400 animate-pulse'}`} />
                    {svc.label}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
