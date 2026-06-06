'use client';

import Sidebar from '@/components/Sidebar';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart2, Plus, Trash2, ChevronRight, RefreshCcw,
  LayoutGrid, Clock, ExternalLink, AlertCircle, Database,
} from 'lucide-react';
import type { DashboardLayout } from '@/shared/types/dashboard';

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  if (h < 24) return `há ${h}h`;
  if (d === 1) return 'ontem';
  return `há ${d} dias`;
}

export default function DashboardsListPage() {
  const router = useRouter();
  const [dashboards, setDashboards] = useState<DashboardLayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function loadDashboards() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/dashboards');
      const data = (await res.json()) as { ok: boolean; dashboards?: DashboardLayout[]; error?: string };
      if (data.ok) setDashboards(data.dashboards ?? []);
      else setError(data.error ?? 'Erro ao carregar dashboards.');
    } catch {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  }

  async function createDashboard() {
    setCreating(true);
    try {
      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Dashboard sem título' }),
      });
      const data = (await res.json()) as { ok: boolean; dashboard?: DashboardLayout };
      if (data.ok && data.dashboard) {
        router.push(`/dashboards/${data.dashboard.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  async function deleteDashboard(id: string) {
    if (!confirm('Excluir este dashboard? A ação não pode ser desfeita.')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/dashboards/${id}`, { method: 'DELETE' });
      setDashboards((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    void loadDashboards();
  }, []);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans antialiased">
      <Sidebar />
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-4 py-6 sm:px-8 sm:py-8 lg:px-10 flex min-h-full flex-col gap-8">

          {/* Header */}
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">
                <span>Data Lake</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-[#379890] italic">Dashboards</span>
              </div>
              <h1 className="mt-4 text-2xl sm:text-4xl font-black tracking-[-0.05em] text-[#143230]">
                Seus Dashboards
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Crie painéis personalizados sobre as tabelas do Data Lake. Cada um salvo e acessível de qualquer máquina.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={() => router.push('/datalake')}
                className="h-10 rounded-2xl border border-[#143230]/10 bg-card px-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:border-[#379890]/20 transition-all inline-flex items-center gap-2"
              >
                <Database className="w-3.5 h-3.5" />
                Explorar tabelas
              </button>
              <button
                onClick={() => router.push('/dashboards/avancado')}
                className="h-10 rounded-2xl border border-[#379890]/30 bg-[#379890]/8 px-4 text-[9px] font-black uppercase tracking-widest text-[#379890] hover:bg-[#379890]/15 transition-all inline-flex items-center gap-2"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Dashboard Avançado
              </button>
              <button
                onClick={() => void loadDashboards()}
                disabled={loading}
                className="h-10 rounded-2xl border border-[#143230]/10 bg-card px-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:border-[#379890]/20 transition-all"
              >
                <RefreshCcw className={`w-3.5 h-3.5 inline-block mr-1 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
              <button
                onClick={() => void createDashboard()}
                disabled={creating}
                className="h-10 rounded-2xl bg-[#379890] px-6 text-[9px] font-black uppercase tracking-widest text-white shadow-[0_18px_38px_-18px_rgba(55,152,144,0.45)] transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
              >
                {creating ? (
                  <span className="inline-flex items-center gap-2">
                    <RefreshCcw className="w-4 h-4 animate-spin" /> Criando...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Novo Dashboard
                  </span>
                )}
              </button>
            </div>
          </header>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
              <RefreshCcw className="w-6 h-6 animate-spin text-[#379890]" />
              <p className="text-sm text-muted-foreground">Carregando dashboards...</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && dashboards.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 flex-col items-center justify-center gap-6 rounded-[36px] border border-[#379890]/10 bg-card/75 py-24"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#379890]/12 shadow-[0_24px_40px_-24px_rgba(55,152,144,0.45)]">
                <BarChart2 className="h-9 w-9 text-[#379890]" />
              </div>
              <div className="text-center">
                <h2 className="mb-2 text-2xl font-black text-[#143230]">Nenhum dashboard ainda</h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Crie um painel em branco ou explore o Data Lake para descobrir as tabelas disponíveis.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => router.push('/datalake')}
                  className="h-11 rounded-2xl border border-[#143230]/15 bg-card px-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:border-[#379890]/30 transition-all shadow-sm inline-flex items-center gap-2"
                >
                  <Database className="w-4 h-4 text-[#379890]" /> Explorar tabelas
                </button>
                <button
                  onClick={() => void createDashboard()}
                  disabled={creating}
                  className="h-11 rounded-2xl bg-[#379890] px-8 text-[10px] font-black uppercase tracking-widest text-white shadow-[0_18px_38px_-18px_rgba(55,152,144,0.45)] transition-all hover:scale-105 active:scale-95"
                >
                  <span className="inline-flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Criar em branco
                  </span>
                </button>
              </div>
            </motion.div>
          )}

          {/* Dashboard cards */}
          {!loading && dashboards.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {dashboards.length} dashboard{dashboards.length !== 1 ? 's' : ''} salvos
                </span>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 pb-12">
                <AnimatePresence mode="popLayout">
                  {dashboards.map((dashboard, i) => (
                    <motion.div
                      key={dashboard.id}
                      layout
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.04 }}
                      className="group flex flex-col overflow-hidden rounded-[28px] border border-[#143230]/8 bg-card shadow-[0_20px_50px_-34px_rgba(20,50,48,0.18)] transition-shadow hover:shadow-[0_24px_60px_-30px_rgba(20,50,48,0.24)]"
                    >
                      {/* Card header accent */}
                      <div className="h-1.5 w-full bg-gradient-to-r from-[#379890] to-[#5b90c7]" />

                      <div className="flex flex-1 flex-col gap-4 p-6">
                        {/* Name */}
                        <div className="flex items-start justify-between gap-3">
                          <h2 className="text-lg font-black leading-tight text-[#143230] line-clamp-2">
                            {dashboard.name}
                          </h2>
                          <button
                            onClick={() => deleteDashboard(dashboard.id)}
                            disabled={deletingId === dashboard.id}
                            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100"
                            title="Excluir dashboard"
                          >
                            {deletingId === dashboard.id ? (
                              <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Description */}
                        {dashboard.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {dashboard.description}
                          </p>
                        )}

                        {/* Stats */}
                        <div className="flex items-center gap-4 mt-auto">
                          <div className="flex items-center gap-1.5 rounded-2xl border border-[#143230]/8 bg-[#f7f8f4] px-3 py-2">
                            <BarChart2 className="w-3.5 h-3.5 text-[#379890]" />
                            <span className="text-[10px] font-black text-muted-foreground">
                              {dashboard.widgets.length} widget{dashboard.widgets.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatRelative(dashboard.updatedAt)}
                          </div>
                        </div>
                      </div>

                      {/* Footer action */}
                      <div className="border-t border-[#143230]/6 bg-[#f9faf7] px-6 py-4">
                        <button
                          onClick={() => router.push(`/dashboards/${dashboard.id}`)}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#379890] py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_12px_28px_-14px_rgba(55,152,144,0.5)]"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Abrir dashboard
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
