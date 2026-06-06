'use client';

import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useSession } from 'next-auth/react';
import {
  ArrowRight, ArrowUpRight, Sparkles, TrendingUp,
  Users2, Wallet, Target,
} from 'lucide-react';
import { brand } from '@/lib/brand';
import { modules } from '@/lib/modules';

const KPIS = [
  { label: 'Receita (mês)',     value: 'R$ 184,2k', delta: '+12,4%', up: true,  icon: Wallet,     tint: 'text-primary',  soft: 'bg-primary-soft' },
  { label: 'Novos clientes',    value: '38',        delta: '+9',     up: true,  icon: Users2,     tint: 'text-info',     soft: 'bg-info-soft' },
  { label: 'Metas no prazo',    value: '82%',       delta: '+5 p.p.',up: true,  icon: Target,     tint: 'text-success',  soft: 'bg-success-soft' },
  { label: 'Ticket médio',      value: 'R$ 4,85k',  delta: '-2,1%',  up: false, icon: TrendingUp, tint: 'text-accent',   soft: 'bg-accent-soft' },
];

export default function HomePage() {
  const { data: session } = useSession();
  const firstName = (session?.user?.name?.split(' ')[0] ?? brand.defaultUser) || brand.defaultUser;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const gridModules = modules.filter((m) => m.id !== 'inicio' && m.id !== 'config');

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans">
      <Sidebar />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-6xl px-6 py-9 lg:px-10 flex flex-col gap-7 animate-fade-in">

          {/* ── HERO ── */}
          <section className="relative overflow-hidden rounded-3xl brand-gradient p-8 lg:p-10 text-white shadow-[0_24px_60px_-30px_rgba(79,70,229,0.7)]">
            <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-10 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em]">{brand.name} · {brand.subtitle}</span>
                </div>
                <h1 className="text-3xl lg:text-[2.7rem] font-[900] leading-[1.05] tracking-[-0.03em]">
                  {greeting}, {firstName}.
                </h1>
                <p className="mt-3 max-w-md text-sm text-white/80 leading-relaxed">
                  {brand.tagline} Acompanhe indicadores, clientes, metas e comunicação — tudo em um só lugar.
                </p>
              </div>
              <div className="flex gap-3">
                <Link href="/chat" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[12px] font-extrabold text-primary shadow-lg transition-all hover:-translate-y-0.5">
                  <Sparkles className="h-4 w-4" /> Perguntar à IA
                </Link>
                <Link href="/dashboards" className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-[12px] font-extrabold text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/20">
                  Ver indicadores <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>

          {/* ── KPIs (demonstração) ── */}
          <section>
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Resumo do negócio</p>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">dados de demonstração</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {KPIS.map((k) => (
                <div key={k.label} className="surface surface-hover p-5">
                  <div className="flex items-center justify-between">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${k.soft}`}>
                      <k.icon className={`h-4.5 w-4.5 ${k.tint}`} />
                    </div>
                    <span className={`inline-flex items-center gap-0.5 text-[11px] font-extrabold ${k.up ? 'text-success' : 'text-danger'}`}>
                      {k.delta}
                      <ArrowUpRight className={`h-3 w-3 ${k.up ? '' : 'rotate-90'}`} />
                    </span>
                  </div>
                  <p className="mt-4 text-2xl font-[900] tracking-[-0.02em] text-foreground">{k.value}</p>
                  <p className="mt-0.5 text-[12px] font-semibold text-muted-foreground">{k.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── MÓDULOS ── */}
          <section>
            <p className="mb-3 px-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Seus módulos</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gridModules.map((m) => (
                <Link key={m.id} href={m.href} className="surface surface-hover group flex items-start gap-4 p-5">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <m.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-extrabold tracking-[-0.01em] text-foreground">{m.label}</p>
                      {m.status === 'soon' && (
                        <span className="rounded-full bg-accent-soft px-1.5 py-px text-[8px] font-black uppercase tracking-[0.12em] text-accent">Em breve</span>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{m.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-300 opacity-0 transition-all group-hover:text-primary group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </section>

          {/* ── DESTAQUE IA ── */}
          <section className="surface relative overflow-hidden p-7 lg:p-8">
            <div className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl brand-gradient text-white">
                  <Sparkles className="h-5.5 w-5.5" />
                </div>
                <div>
                  <h2 className="text-lg font-[900] tracking-[-0.02em] text-foreground">Inteligência nativa</h2>
                  <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
                    O assistente do {brand.name} lê seus indicadores, resume o que importa e responde em linguagem natural — o diferencial do seu OS.
                  </p>
                </div>
              </div>
              <Link href="/chat" className="btn-primary inline-flex flex-shrink-0 items-center gap-2 px-5 py-3 text-[12px] font-extrabold">
                Abrir assistente <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
