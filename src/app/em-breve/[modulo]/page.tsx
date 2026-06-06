import Link from 'next/link';
import { ArrowLeft, Hammer, Sparkles } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { moduleById } from '@/lib/modules';
import { brand } from '@/lib/brand';

export default async function EmBrevePage({
  params,
}: {
  params: Promise<{ modulo: string }>;
}) {
  const { modulo } = await params;
  const mod = moduleById(modulo);
  const Icon = mod?.icon ?? Hammer;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans">
      <Sidebar />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-6 py-16 text-center animate-fade-in">

          <div className="relative mb-8">
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-primary/15 blur-3xl" />
            <div className="flex h-20 w-20 items-center justify-center rounded-[28px] brand-gradient text-white shadow-[0_18px_44px_-18px_rgba(79,70,229,0.7)]">
              <Icon className="h-9 w-9" />
            </div>
          </div>

          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-accent">
            <Sparkles className="h-3.5 w-3.5" /> Em construção
          </span>

          <h1 className="text-3xl lg:text-4xl font-[900] tracking-[-0.03em] text-foreground">
            {mod?.label ?? 'Novo módulo'}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            {mod?.desc ?? 'Este módulo faz parte do roadmap do ' + brand.name + '.'} Estamos construindo esta área para fazer parte do seu {brand.subtitle}.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-[12px] font-extrabold text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40">
              <ArrowLeft className="h-4 w-4" /> Voltar ao início
            </Link>
            <Link href="/chat" className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-[12px] font-extrabold">
              <Sparkles className="h-4 w-4" /> Falar com a IA
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}
