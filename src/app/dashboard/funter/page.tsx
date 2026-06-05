'use client';

import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { motion } from 'framer-motion';
import { Building2, ArrowUpRight, FileSpreadsheet } from 'lucide-react';

export default function FunterDashboard() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans antialiased">
      <Sidebar />

      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-screen">
        <div className="px-12 py-10 flex flex-col gap-8">
          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.35em] text-stone-500">
                <span>Dashs</span>
                <span className="text-stone-700">/</span>
                <span className="text-neon-cyan">FUNTER</span>
              </div>
              <h1 className="text-4xl font-[1000] tracking-[-0.08em] uppercase leading-none">
                Dashboard FUNTER integrada ao hub
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-stone-400">
                O painel standalone foi preservado como base visual e agora vive dentro do novo hub,
                pronto para ser evoluido para dados vindos do DataLake.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-[11px] font-black uppercase tracking-[0.25em] transition-colors hover:bg-white/[0.06]"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Command Center
              </Link>
              <a
                href="/dashboards/funter/index.html"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-neon-cyan px-5 py-3 text-[11px] font-black uppercase tracking-[0.25em] text-black shadow-lg shadow-neon-cyan/20 transition-transform hover:scale-[1.02]"
              >
                Abrir tela cheia
                <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </motion.header>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-[34px] border border-white/5 bg-card shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-4">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-neon-cyan" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-500">
                  Conteudo original preservado
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-600">
                CSV {'->'} DataLake {'->'} HTML
              </span>
            </div>

            <div className="h-[calc(100vh-260px)] min-h-[720px]">
              <iframe
                src="/dashboards/funter/index.html"
                title="FUNTER Dashboard"
                className="h-full w-full border-0 bg-[#eef2f1]"
              />
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
