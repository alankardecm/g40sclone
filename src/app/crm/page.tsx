'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, RefreshCw, Users, Wallet, AlertTriangle, Filter,
  ChevronLeft, ChevronRight, MapPin,
} from 'lucide-react';
import { PIPELINE_STAGES, type CrmOverview, type ChurnRisk, type PipelineStage } from '@/shared/types/crm';

const BRAND = '#379890';
const INK = '#143230';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const riskStyle: Record<ChurnRisk, string> = {
  alto: 'bg-rose-100 text-rose-700',
  medio: 'bg-amber-100 text-amber-700',
  baixo: 'bg-emerald-100 text-emerald-700',
};

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className="mt-2 text-2xl font-black" style={{ color: accent || INK }}>{value}</p>
    </div>
  );
}

export default function CrmPage() {
  const [data, setData] = useState<CrmOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/crm/overview', { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Falha ao carregar o CRM.');
      setData(json.overview as CrmOverview);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const move = async (id: string, dir: -1 | 1, current: PipelineStage) => {
    const order = PIPELINE_STAGES.map((s) => s.id);
    const idx = order.indexOf(current);
    const next = order[idx + dir];
    if (!next) return;
    await fetch(`/api/crm/leads/${id}/move`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: next }),
    });
    load();
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/" className="flex items-center text-sm text-muted-foreground hover:text-[#379890] transition-colors">
              <ArrowLeft size={16} className="mr-1" /> Voltar para Home
            </Link>
            <h1 className="mt-2 text-3xl font-black uppercase" style={{ color: INK }}>CRM</h1>
            <p className="text-muted-foreground text-sm">Carteira de clientes (360) e funil de vendas do provedor.</p>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center rounded-full bg-card px-4 py-2 text-sm font-bold border border-border shadow-sm hover:bg-background disabled:opacity-50 transition-all">
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </header>

        {err && <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{err}</div>}

        {loading && !data ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>
            <div className="h-72 rounded-2xl bg-muted animate-pulse" />
          </div>
        ) : data && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Kpi icon={<Users size={15} />} label="Clientes ativos" value={`${data.kpis.clientesAtivos}/${data.kpis.totalClientes}`} />
              <Kpi icon={<Wallet size={15} />} label="MRR da carteira" value={brl(data.kpis.mrrTotal)} accent={BRAND} />
              <Kpi icon={<AlertTriangle size={15} />} label="Clientes em risco alto" value={String(data.kpis.emRiscoAlto)} accent="#e11d48" />
              <Kpi icon={<Filter size={15} />} label="Funil aberto" value={`${data.kpis.leadsAbertos} · ${brl(data.kpis.valorFunilAberto)}`} />
            </div>

            {/* Funil */}
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide" style={{ color: INK }}>Funil de vendas</h2>
              <div className="flex gap-3 overflow-x-auto pb-3">
                {data.pipeline.map((col) => {
                  const total = col.leads.reduce((s, l) => s + l.valorMensal, 0);
                  const isWon = col.stage === 'ganho'; const isLost = col.stage === 'perdido';
                  return (
                    <div key={col.stage} className="w-64 shrink-0">
                      <div className="mb-2 flex items-center justify-between px-1">
                        <span className="text-xs font-bold" style={{ color: isWon ? BRAND : isLost ? '#e11d48' : INK }}>{col.label}</span>
                        <span className="text-[11px] text-muted-foreground">{col.leads.length} · {brl(total)}</span>
                      </div>
                      <div className="space-y-2">
                        {col.leads.map((l) => {
                          const idx = PIPELINE_STAGES.findIndex((s) => s.id === l.stage);
                          return (
                            <div key={l.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                              <p className="text-sm font-semibold leading-snug" style={{ color: INK }}>{l.nome}</p>
                              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin size={11} /> {l.cidade}/{l.uf} · {l.origem}</p>
                              <p className="mt-1 text-sm font-bold" style={{ color: BRAND }}>{brl(l.valorMensal)}<span className="text-[10px] font-normal text-muted-foreground">/mês</span></p>
                              {l.observacao && <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{l.observacao}</p>}
                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">{l.responsavel}</span>
                                <span className="flex gap-1">
                                  <button onClick={() => move(l.id, -1, l.stage)} disabled={idx <= 0}
                                    className="rounded-md border border-border p-1 hover:bg-background disabled:opacity-30" title="Etapa anterior">
                                    <ChevronLeft size={13} />
                                  </button>
                                  <button onClick={() => move(l.id, 1, l.stage)} disabled={idx >= PIPELINE_STAGES.length - 1}
                                    className="rounded-md border border-border p-1 hover:bg-background disabled:opacity-30" title="Avançar etapa">
                                    <ChevronRight size={13} />
                                  </button>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {col.leads.length === 0 && <div className="rounded-xl border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">—</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Carteira */}
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide" style={{ color: INK }}>Carteira de clientes</h2>
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background/60 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">Cliente</th>
                      <th className="px-4 py-3 font-semibold">Cidade</th>
                      <th className="px-4 py-3 font-semibold">Plano</th>
                      <th className="px-4 py-3 font-semibold text-right">MRR</th>
                      <th className="px-4 py-3 font-semibold text-center">CSAT</th>
                      <th className="px-4 py-3 font-semibold text-center">Risco</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-background/50">
                        <td className="px-4 py-3">
                          <Link href={`/crm/clientes/${c.id}`} className="font-semibold hover:underline" style={{ color: INK }}>{c.nome}</Link>
                          <div className="text-[11px] text-muted-foreground">{c.contrato.status}{c.protocolosAbertos > 0 ? ` · ${c.protocolosAbertos} protocolo(s)` : ''}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{c.cidade}/{c.uf}</td>
                        <td className="px-4 py-3">{c.contrato.plano}</td>
                        <td className="px-4 py-3 text-right font-semibold">{brl(c.contrato.mrr)}</td>
                        <td className="px-4 py-3 text-center">{c.csat != null ? `${c.csat}%` : '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${riskStyle[c.churnRisk]}`}>{c.churnRisk}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <footer className="mt-6 text-center text-xs text-muted-foreground">
              MVP com dados de exemplo · pronto para plugar Supabase ou o ERP (IXC/SGP).
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
