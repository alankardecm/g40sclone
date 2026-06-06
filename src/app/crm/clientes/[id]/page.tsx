'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Phone, Mail, MapPin, Wallet, Gauge, Smile, FileWarning,
  MessageSquare, PhoneCall, CalendarClock, StickyNote, Truck,
} from 'lucide-react';
import type { Customer, ChurnRisk, InteractionType } from '@/shared/types/crm';

const BRAND = '#379890';
const INK = '#143230';
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

const riskStyle: Record<ChurnRisk, string> = {
  alto: 'bg-rose-100 text-rose-700',
  medio: 'bg-amber-100 text-amber-700',
  baixo: 'bg-emerald-100 text-emerald-700',
};
const riskColor: Record<ChurnRisk, string> = { alto: '#e11d48', medio: '#d97706', baixo: '#059669' };

const interIcon: Record<InteractionType, React.ReactNode> = {
  whatsapp: <MessageSquare size={14} />,
  ligacao: <PhoneCall size={14} />,
  email: <Mail size={14} />,
  visita: <Truck size={14} />,
  nota: <StickyNote size={14} />,
};

function Signal({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className="mt-1 text-xl font-black" style={{ color: accent || INK }}>{value}</p>
    </div>
  );
}

export default function ClienteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [c, setC] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/crm/customers/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Falha ao carregar.');
      setC(json.customer as Customer);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/crm" className="flex items-center text-sm text-muted-foreground hover:text-[#379890] transition-colors">
          <ArrowLeft size={16} className="mr-1" /> Voltar para o CRM
        </Link>

        {err && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{err}</div>}

        {loading && !c ? (
          <div className="mt-4 space-y-4">
            <div className="h-28 rounded-2xl bg-muted animate-pulse" />
            <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>
          </div>
        ) : c && (
          <>
            <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-black" style={{ color: INK }}>{c.nome}</h1>
                <p className="text-sm text-muted-foreground">{c.documento} · cliente desde {fmtDate(c.desde)}</p>
                <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin size={14} /> {c.cidade}/{c.uf}</span>
                  {c.telefone && <span className="flex items-center gap-1"><Phone size={14} /> {c.telefone}</span>}
                  {c.email && <span className="flex items-center gap-1"><Mail size={14} /> {c.email}</span>}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${riskStyle[c.churnRisk]}`}>Risco {c.churnRisk}</span>
            </header>

            {/* Sinais */}
            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <Signal icon={<Wallet size={15} />} label="MRR" value={brl(c.contrato.mrr)} accent={BRAND} />
              <Signal icon={<Smile size={15} />} label="CSAT" value={c.csat != null ? `${c.csat}%` : '—'} accent={c.csat != null && c.csat < 80 ? '#e11d48' : INK} />
              <Signal icon={<FileWarning size={15} />} label="Protocolos abertos" value={String(c.protocolosAbertos)} accent={c.protocolosAbertos > 0 ? '#e11d48' : INK} />
              <Signal icon={<Gauge size={15} />} label="Churn score" value={`${c.churnScore}/100`} accent={riskColor[c.churnRisk]} />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {/* Contrato */}
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: INK }}>Contrato</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Plano</dt><dd className="font-semibold">{c.contrato.plano}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Velocidade</dt><dd className="font-semibold">{c.contrato.velocidadeMbps} Mbps</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Tecnologia</dt><dd className="font-semibold capitalize">{c.contrato.tecnologia}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd className="font-semibold capitalize">{c.contrato.status}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Início</dt><dd className="font-semibold">{fmtDate(c.contrato.inicio)}</dd></div>
                </dl>
                {c.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {c.tags.map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{t}</span>)}
                  </div>
                )}
              </section>

              {/* Timeline */}
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide" style={{ color: INK }}>
                  <CalendarClock size={15} style={{ color: BRAND }} /> Interações
                </h2>
                {c.interacoes.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">Sem interações registradas.</p>
                ) : (
                  <ol className="mt-3 space-y-3">
                    {c.interacoes.map((it) => (
                      <li key={it.id} className="flex gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground" style={{ color: BRAND }}>
                          {interIcon[it.tipo]}
                        </span>
                        <div>
                          <p className="text-sm">{it.resumo}</p>
                          <p className="text-[11px] text-muted-foreground">{fmtDate(it.data)} · {it.autor} · {it.tipo}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
