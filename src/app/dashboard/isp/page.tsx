'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, RefreshCw, Sparkles, Activity, UserMinus, Smile,
  AlertTriangle, ServerCrash, CheckCircle2,
} from 'lucide-react';
import type { IspCockpit, ServiceState } from '@/shared/types/isp';

const BRAND = '#379890';
const INK = '#143230';

function StateBadge({ state }: { state: ServiceState }) {
  if (state === 'ok') return null;
  const label = state === 'unconfigured' ? 'Não configurado' : 'Erro de conexão';
  const cls = state === 'unconfigured' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';
  return <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>;
}

function Kpi({ label, value, hint, accent }: { label: string; value: string | number; hint?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black" style={{ color: accent || INK }}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function IspCockpitPage() {
  const [data, setData] = useState<IspCockpit | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchCockpit = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/isp/cockpit', { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Falha ao carregar o cockpit.');
      setData(json.cockpit as IspCockpit);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCockpit(); }, [fetchCockpit]);

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/" className="flex items-center text-sm text-muted-foreground hover:text-[#379890] transition-colors">
              <ArrowLeft size={16} className="mr-1" /> Voltar para Home
            </Link>
            <h1 className="mt-2 text-3xl font-black uppercase" style={{ color: INK }}>Cockpit ISP</h1>
            <p className="text-muted-foreground text-sm">Rede, retenção e satisfação num só lugar — com o que priorizar hoje.</p>
          </div>
          <button
            onClick={fetchCockpit}
            disabled={loading}
            className="flex items-center rounded-full bg-card px-4 py-2 text-sm font-bold border border-border shadow-sm hover:bg-background disabled:opacity-50 transition-all"
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </header>

        {err && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{err}</div>
        )}

        {loading && !data ? (
          <div className="space-y-4">
            <div className="h-40 rounded-2xl bg-muted animate-pulse" />
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-44 rounded-2xl bg-muted animate-pulse" />)}
            </div>
          </div>
        ) : data && (
          <>
            {/* Copilot */}
            <section className="mb-6 rounded-2xl border border-border p-6 shadow-sm" style={{ background: 'linear-gradient(135deg, #0f3d3a 0%, #143230 100%)' }}>
              <div className="flex items-center gap-2 text-white/90">
                <Sparkles size={18} style={{ color: '#7ee0d3' }} />
                <h2 className="text-sm font-bold uppercase tracking-wide">Copiloto · o que priorizar</h2>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-white/50">
                  {data.copilot.source === 'ai' ? 'IA' : 'regra'}
                </span>
              </div>
              <p className="mt-3 text-white/90">{data.copilot.resumo}</p>
              <ol className="mt-4 space-y-2">
                {data.copilot.prioridades.map((p, i) => (
                  <li key={i} className="flex gap-3 text-sm text-white/95">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold" style={{ color: '#7ee0d3' }}>{i + 1}</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ol>
            </section>

            <div className="grid gap-4 md:grid-cols-3">
              {/* NOC */}
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center text-sm font-bold" style={{ color: INK }}>
                  <Activity size={18} className="mr-2" style={{ color: BRAND }} /> NOC / Rede
                  <StateBadge state={data.noc.state} />
                </div>
                {data.noc.state === 'ok' ? (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Kpi label="Problemas ativos" value={data.noc.totalProblems} />
                    <Kpi label="Desastres" value={data.noc.disasters} accent={data.noc.disasters > 0 ? '#e11d48' : INK} />
                    <Kpi label="Hosts fora" value={data.noc.hostsDown} accent={data.noc.hostsDown > 0 ? '#e11d48' : INK} />
                    <Kpi label="Hosts no ar" value={`${data.noc.hostsUp}/${data.noc.totalHosts}`} />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">{data.noc.error || 'Configure ZABBIX_URL e ZABBIX_API_TOKEN no .env.'}</p>
                )}
              </section>

              {/* Churn */}
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center text-sm font-bold" style={{ color: INK }}>
                  <UserMinus size={18} className="mr-2" style={{ color: BRAND }} /> Retenção / Churn
                  <StateBadge state={data.churn.state} />
                </div>
                {data.churn.state === 'ok' ? (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Kpi label="Baixas (clientes)" value={data.churn.churnClientes} accent="#e11d48" />
                    <Kpi label="Pedidos cancel." value={data.churn.demandaClientes} />
                    <Kpi label="Retidos (save)" value={data.churn.retidosClientes} accent={BRAND} />
                    <Kpi label="Taxa de save" value={`${data.churn.taxaRetencao}%`} />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">{data.churn.error || 'MySQL não configurado.'}</p>
                )}
              </section>

              {/* CSAT */}
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center text-sm font-bold" style={{ color: INK }}>
                  <Smile size={18} className="mr-2" style={{ color: BRAND }} /> CSAT
                  <StateBadge state={data.csat.state} />
                </div>
                {data.csat.state === 'ok' ? (
                  data.csat.areas.length ? (
                    <ul className="mt-3 space-y-2">
                      {data.csat.areas.map((a) => (
                        <li key={a.area} className="flex items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-2">
                          <span className="text-sm capitalize">{a.area}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-lg font-black" style={{ color: a.value >= 80 ? BRAND : '#e11d48' }}>{a.value}%</span>
                            <span className="text-[11px] text-muted-foreground">{a.detratores} detr · {a.base} resp</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">Sem pesquisas no período.</p>
                  )
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">{data.csat.error || 'MySQL não configurado.'}</p>
                )}
              </section>
            </div>

            {/* Top problemas NOC */}
            {data.noc.state === 'ok' && data.noc.topProblems.length > 0 && (
              <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h3 className="flex items-center text-sm font-bold" style={{ color: INK }}>
                  <AlertTriangle size={16} className="mr-2 text-amber-500" /> Principais problemas de rede
                </h3>
                <ul className="mt-3 divide-y divide-border">
                  {data.noc.topProblems.map((p, i) => (
                    <li key={i} className="flex items-center gap-3 py-2 text-sm">
                      <ServerCrash size={15} className="shrink-0 text-rose-500" />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{p.severityLabel}</span>
                      <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">{p.host}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <footer className="mt-6 flex items-center gap-2 text-center text-xs text-muted-foreground">
              <CheckCircle2 size={13} style={{ color: BRAND }} />
              Período {data.periodo.from} a {data.periodo.to} · atualizado {new Date(data.generatedAt).toLocaleString('pt-BR')}
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
