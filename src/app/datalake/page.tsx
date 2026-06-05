'use client';

import Sidebar from '@/components/Sidebar';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Database, Table2, ChevronRight,
  RefreshCcw, Layers, Bot, Eye,
  AlertCircle, CheckCircle2, XCircle, Clock,
  Plus, BarChart2, TrendingUp, Search,
} from 'lucide-react';
import type { DashboardSuggestion, DashboardSuggestionResponse, DatalakeOverview, DatalakePreviewResult } from '@/shared/types/datalake';
import type { AggregationType, FilterOperator, TimeBucket, WidgetConfig } from '@/shared/types/dashboard';
import { getColumnSemantic, getTableSemantic } from '@/lib/datalake-semantics';
import { buildStarterWidgets, generateWidgetId, type ColumnInfo } from '@/lib/dashboard-widget-intelligence';

const emptyOverview: DatalakeOverview = {
  ok: false,
  status: 'disconnected',
  database: null,
  host: null,
  port: null,
  tableCount: 0,
  tables: [],
  previewLimit: 25,
};

type TabKey = 'catalog' | 'preview' | 'suggest';

const TABS: { key: TabKey; label: string; Icon: React.ElementType }[] = [
  { key: 'catalog', label: 'Catalogo', Icon: Table2 },
  { key: 'preview', label: 'Preview', Icon: Eye },
  { key: 'suggest', label: 'Sugestoes IA', Icon: Bot },
];

const DEFAULT_TABLE_PROMPTS = [
  'Quero um dashboard de desempenho comercial com as tabelas mais relevantes.',
  'Analise o volume de chamados abertos comparado com contratos ativos.',
  'Mostre a evolucao de churn e SLA nos ultimos meses.',
];

function suggestionToWidget(suggestion: DashboardSuggestion): WidgetConfig {
  return {
    id: generateWidgetId('ai'),
    title: suggestion.title,
    chartType: suggestion.chartType,
    table: suggestion.table,
    xColumn: suggestion.x ?? '',
    metric: suggestion.metric ?? suggestion.y ?? '',
    aggregation: (suggestion.aggregation ?? 'count') as AggregationType,
    limit: 20,
    color: '#379890',
    filterColumn: suggestion.filterColumn ?? '',
    filterOperator: (suggestion.filterOperator ?? 'eq') as FilterOperator,
    filterValue: suggestion.filterValue ?? '',
    filter2Column: suggestion.filter2Column ?? '',
    filter2Operator: (suggestion.filter2Operator ?? 'eq') as FilterOperator,
    filter2Value: suggestion.filter2Value ?? '',
    dateColumn: suggestion.dateColumn ?? '',
    dateFrom: suggestion.dateFrom ?? '',
    dateTo: suggestion.dateTo ?? '',
    timeBucket: (suggestion.timeBucket ?? 'none') as TimeBucket,
  };
}

export default function DatalakePage() {
  const router = useRouter();

  const [overview, setOverview] = useState<DatalakeOverview>(emptyOverview);
  const [selectedTable, setSelectedTable] = useState('');
  const [preview, setPreview] = useState<DatalakePreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dashboardPrompt, setDashboardPrompt] = useState(DEFAULT_TABLE_PROMPTS[0]);
  const [dashboardSuggestions, setDashboardSuggestions] = useState<DashboardSuggestionResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [creatingDash, setCreatingDash] = useState<string | null>(null);
  const [createError, setCreateError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('catalog');
  const [catalogSearch, setCatalogSearch] = useState('');

  async function loadOverview() {
    setLoading(true);
    try {
      const response = await fetch('/api/datalake/schema');
      const data = (await response.json()) as DatalakeOverview;
      setOverview(data);
      const firstTable = data.tables[0]?.name || '';
      setSelectedTable((current) => current || firstTable);
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview(tableName: string) {
    if (!tableName) { setPreview(null); return; }
    setPreviewLoading(true);
    setActiveTab('preview');
    try {
      const response = await fetch(`/api/datalake/preview?table=${encodeURIComponent(tableName)}`);
      const data = (await response.json()) as DatalakePreviewResult;
      setPreview(data.ok ? data : null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function loadDashboardSuggestions() {
    setDashboardLoading(true);
    try {
      const response = await fetch('/api/datalake/dashboard-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: dashboardPrompt }),
      });
      const data = (await response.json()) as DashboardSuggestionResponse;
      setDashboardSuggestions(data.ok ? data : null);
    } finally {
      setDashboardLoading(false);
    }
  }

  async function createDashboardFromSuggestion(suggestion: DashboardSuggestion) {
    setCreatingDash(suggestion.table);
    setCreateError('');
    try {
      const widget = suggestionToWidget(suggestion);
      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: suggestion.title,
          description: suggestion.rationale,
          widgets: [widget],
        }),
      });
      const data = (await res.json()) as { ok: boolean; dashboard?: { id: string }; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || 'Erro ao criar dashboard.');
      if (data.dashboard) router.push(`/dashboards/${data.dashboard.id}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Erro ao criar dashboard.');
    } finally {
      setCreatingDash(null);
    }
  }

  async function createDashboardFromTable(tableName: string) {
    setCreatingDash(tableName);
    setCreateError('');
    try {
      const sem = getTableSemantic(tableName);
      let columns: ColumnInfo[] = [];
      try {
        const columnsRes = await fetch(`/api/datalake/columns?table=${encodeURIComponent(tableName)}`);
        const columnsData = (await columnsRes.json()) as { ok: boolean; columns?: ColumnInfo[] };
        columns = columnsData.ok ? columnsData.columns ?? [] : [];
      } catch {
        columns = [];
      }

      const widgets = buildStarterWidgets(tableName, columns);
      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Dashboard - ${sem.label}`,
          description: sem.description,
          widgets,
        }),
      });
      const data = (await res.json()) as { ok: boolean; dashboard?: { id: string }; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Erro ao criar dashboard.');
      }
      if (data.ok && data.dashboard) {
        router.push(`/dashboards/${data.dashboard.id}`);
      }
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Erro ao criar dashboard.');
    } finally {
      setCreatingDash(null);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  const statusBadge = useMemo(() => {
    if (overview.status === 'connected') return { label: 'Conectado', color: 'text-emerald-400 bg-emerald-500/10', dot: 'bg-emerald-400' };
    if (overview.status === 'error') return { label: 'Erro', color: 'text-red-400 bg-red-500/10', dot: 'bg-red-400' };
    return { label: 'Não configurado', color: 'text-amber-400 bg-amber-500/10', dot: 'bg-amber-400' };
  }, [overview.status]);

  const filteredTables = useMemo(() => {
    const needle = catalogSearch.trim().toLowerCase();
    if (!needle) return overview.tables;
    return overview.tables.filter((t) => {
      const sem = getTableSemantic(t.name);
      return (
        t.name.toLowerCase().includes(needle) ||
        sem.label.toLowerCase().includes(needle) ||
        sem.description.toLowerCase().includes(needle) ||
        sem.focus.some((f) => f.toLowerCase().includes(needle))
      );
    });
  }, [overview.tables, catalogSearch]);

  const chartTypeLabel = (type: string) => {
    const labels: Record<string, string> = { metric: 'KPI', bar: 'Barras', line: 'Linha', area: 'Area', pie: 'Pizza', table: 'Tabela' };
    return labels[type] ?? type;
  };

  const StatusIcon = overview.status === 'connected' ? CheckCircle2 : overview.status === 'error' ? XCircle : Clock;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans antialiased">
      <Sidebar />

      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-screen">
        <div className="px-4 py-6 sm:px-8 sm:py-8 lg:px-10 flex flex-col gap-8">

          {/* ── Header ── */}
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.4em] text-stone-700">
                <span>Infraestrutura</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-neon-cyan italic">Data Lake MySQL</span>
              </div>
              <h1 className="mt-3 text-2xl sm:text-4xl font-black tracking-[-0.04em]">
                Explorador de Tabelas
              </h1>
              <p className="mt-1 text-sm text-stone-500">
                Veja os dados disponíveis, faça preview e crie dashboards em segundos.
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:shrink-0">
              <button
                onClick={() => router.push('/dashboards')}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.06] px-5 text-[9px] font-black uppercase tracking-widest text-stone-300 transition-all hover:bg-white/[0.10] sm:w-auto"
              >
                <BarChart2 className="w-3.5 h-3.5" /> Meus Dashboards
              </button>
              <button
                onClick={() => void loadOverview()}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-neon-cyan px-5 text-[9px] font-black uppercase tracking-widest text-black transition-all hover:scale-105 active:scale-95 sm:w-auto"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
              </button>
            </div>
          </header>

          {/* ── Status Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Status', value: statusBadge.label, Icon: StatusIcon, accent: statusBadge.dot },
              { label: 'Banco', value: overview.database || 'Não definido', Icon: Database, accent: 'bg-neon-cyan' },
              { label: 'Tabelas', value: String(overview.tableCount), Icon: Table2, accent: 'bg-violet-400' },
              { label: 'Host', value: overview.host || 'Não definido', Icon: Layers, accent: 'bg-emerald-400' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="bg-card rounded-[24px] p-5 border border-white/5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-2 h-2 rounded-full ${item.accent}`} />
                  <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">{item.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <item.Icon className="w-5 h-5 text-stone-600 shrink-0" />
                  <strong className="text-lg font-black leading-tight truncate">{item.value}</strong>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Warning: not connected ── */}
          {!overview.ok && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-start gap-4 rounded-[24px] border border-amber-500/20 bg-amber-500/5 p-5"
            >
              <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-400">Data Lake não conectado</p>
                <p className="mt-1 text-xs text-stone-400">
                  {overview.message || 'Configure as credenciais MySQL no .env para habilitar o Data Lake.'}
                </p>
                <code className="mt-2 block text-[10px] text-stone-500 font-mono">
                  MYSQL_HOST • MYSQL_DATABASE • MYSQL_USER • MYSQL_PASSWORD
                </code>
              </div>
            </motion.div>
          )}

          {createError && (
            <div className="flex items-start gap-3 rounded-[20px] border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          {/* ── All Tables — Dynamic Cards ── */}
          {overview.ok && overview.tables.length > 0 && (
            <section>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
                <div>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.35em] text-stone-600">
                    Tabelas disponíveis
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    Explore qualquer tabela e crie um dashboard com um clique.
                  </p>
                </div>
                <div className="flex w-full items-center gap-3 sm:w-auto">
                  <div className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 sm:flex-none">
                    <Search className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <input
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Buscar tabela..."
                      className="w-full bg-transparent text-sm outline-none placeholder:text-stone-600 sm:w-48"
                    />
                  </div>
                  <span className="text-[10px] font-black text-stone-500 bg-white/5 px-3 py-1.5 rounded-xl whitespace-nowrap">
                    {filteredTables.length}/{overview.tables.length}
                  </span>
                </div>
              </div>

              {filteredTables.length === 0 ? (
                <div className="flex items-center justify-center rounded-[24px] border border-white/5 bg-card py-12 text-stone-500 text-sm">
                  Nenhuma tabela encontrada para &ldquo;{catalogSearch}&rdquo;.
                </div>
              ) : (
                <div className={`grid gap-4 ${
                  filteredTables.length === 1
                    ? 'grid-cols-1 max-w-md'
                    : filteredTables.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                }`}>
                  {filteredTables.map((table, i) => {
                    const meta = getTableSemantic(table.name);
                    const isCreating = creatingDash === table.name;

                    return (
                      <motion.div
                        key={table.name}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.06, 0.3) }}
                        className="bg-card rounded-[24px] p-6 border border-white/5 flex flex-col gap-4"
                      >
                        {/* Card header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-neon-cyan/10 flex items-center justify-center shrink-0">
                              <TrendingUp className="w-5 h-5 text-neon-cyan" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-widest text-stone-500 truncate">
                                {table.name}
                              </p>
                              <p className="text-sm font-black mt-0.5 leading-tight">{meta.label}</p>
                            </div>
                          </div>
                          {table.rows !== null && (
                            <span className="text-[10px] font-mono text-stone-500 bg-white/5 px-2 py-1 rounded-xl shrink-0">
                              {table.rows.toLocaleString('pt-BR')} rows
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-xs text-stone-400 leading-relaxed">{meta.description}</p>

                        {/* Focus tags */}
                        <div className="flex flex-wrap gap-1.5">
                          {meta.focus.slice(0, 4).map((f) => (
                            <span
                              key={f}
                              className="text-[9px] font-black uppercase tracking-wide text-stone-400 bg-white/5 px-2 py-1 rounded-lg"
                            >
                              {f}
                            </span>
                          ))}
                        </div>

                        {/* Actions */}
                        <div className="mt-auto grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setSelectedTable(table.name);
                              void loadPreview(table.name);
                            }}
                            className={`h-9 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                              selectedTable === table.name && activeTab === 'preview'
                                ? 'bg-neon-cyan text-black'
                                : 'bg-white/5 text-stone-400 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" /> Preview
                          </button>

                          <button
                            onClick={() => void createDashboardFromTable(table.name)}
                            disabled={isCreating}
                            className="h-9 rounded-2xl bg-violet-500/20 text-violet-300 border border-violet-500/20 text-[9px] font-black uppercase tracking-widest hover:bg-violet-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                          >
                            {isCreating ? (
                              <><RefreshCcw className="w-3.5 h-3.5 animate-spin" /> Criando...</>
                            ) : (
                              <><Plus className="w-3.5 h-3.5" /> Criar</>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ── Tabs ── */}
          <section>
            <div className="mb-6 flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-white/[0.03] p-1 sm:w-fit">
              {TABS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    activeTab === key ? 'bg-white/10 text-white' : 'text-stone-500 hover:text-stone-300'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>

            {/* ─ Tab: Catálogo ─ */}
            {activeTab === 'catalog' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card rounded-[24px] p-4 sm:p-6 border border-white/5"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">Todas as tabelas</h3>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${statusBadge.color} flex items-center gap-2`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                    {statusBadge.label}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px]">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left text-[10px] font-black text-stone-600 uppercase tracking-widest py-4 px-4">Tabela</th>
                        <th className="text-left text-[10px] font-black text-stone-600 uppercase tracking-widest py-4 px-4">Descrição</th>
                        <th className="text-right text-[10px] font-black text-stone-600 uppercase tracking-widest py-4 px-4">Linhas</th>
                        <th className="text-left text-[10px] font-black text-stone-600 uppercase tracking-widest py-4 px-4">Engine</th>
                        <th className="text-right text-[10px] font-black text-stone-600 uppercase tracking-widest py-4 px-4">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="py-10 px-4 text-center text-stone-500 text-sm">
                            <RefreshCcw className="w-4 h-4 animate-spin inline-block mr-2" /> Carregando catálogo...
                          </td>
                        </tr>
                      ) : overview.tables.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 px-4 text-center text-stone-500 text-sm">
                            Nenhuma tabela disponível.
                          </td>
                        </tr>
                      ) : (
                        overview.tables.map((table) => {
                          const meta = getTableSemantic(table.name);
                          return (
                            <tr
                              key={table.name}
                              onClick={() => { setSelectedTable(table.name); void loadPreview(table.name); }}
                              className={`border-b border-white/5 transition-colors cursor-pointer hover:bg-white/[0.02] ${
                                selectedTable === table.name ? 'bg-white/[0.04]' : ''
                              }`}
                            >
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <TrendingUp className="w-4 h-4 shrink-0 text-neon-cyan" />
                                  <div>
                                    <span className="text-sm font-bold block">{table.name}</span>
                                    <span className="text-[10px] text-stone-500 font-black uppercase tracking-widest">{meta.label}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-xs text-stone-400 max-w-[240px]">
                                <span className="line-clamp-2">{meta.description}</span>
                              </td>
                              <td className="py-4 px-4 text-right font-mono text-sm">
                                {table.rows?.toLocaleString('pt-BR') ?? '—'}
                              </td>
                              <td className="py-4 px-4 text-xs text-stone-400 uppercase">
                                {table.engine ?? '—'}
                              </td>
                              <td className="py-4 px-4 text-right">
                                <button
                                  onClick={(e) => { e.stopPropagation(); void createDashboardFromTable(table.name); }}
                                  disabled={creatingDash === table.name}
                                  className="text-[9px] font-black uppercase tracking-widest text-violet-300 hover:text-white bg-violet-500/15 hover:bg-violet-500/25 px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 inline-flex items-center gap-1"
                                >
                                  {creatingDash === table.name
                                    ? <><RefreshCcw className="w-3 h-3 animate-spin" /> Criando...</>
                                    : <><Plus className="w-3 h-3" /> Dashboard</>}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* ─ Tab: Preview ─ */}
            {activeTab === 'preview' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card rounded-[24px] p-4 sm:p-6 border border-white/5"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">Preview Seguro</h3>
                  <Eye className="w-4 h-4 text-neon-cyan" />
                </div>

                <div className="mb-6">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-600">
                    Tabela ativa
                  </label>
                  <select
                    value={selectedTable}
                    onChange={(e) => { setSelectedTable(e.target.value); void loadPreview(e.target.value); }}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
                  >
                    <option value="">Selecione uma tabela</option>
                    {overview.tables.map((table) => {
                      const meta = getTableSemantic(table.name);
                      return (
                        <option key={table.name} value={table.name}>
                          {table.name} — {meta.label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {previewLoading ? (
                  <div className="flex items-center justify-center gap-3 py-12 text-stone-500 text-sm">
                    <RefreshCcw className="w-4 h-4 animate-spin" /> Carregando preview...
                  </div>
                ) : !preview ? (
                  <p className="text-sm text-stone-500 py-10 text-center">
                    Selecione uma tabela para visualizar a amostra de dados.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs text-stone-500">
                        Até <strong className="text-white">{preview.limit}</strong> linhas ·{' '}
                        tabela <strong className="text-neon-cyan">{preview.table}</strong> ·{' '}
                        <strong className="text-white">{preview.columns.length}</strong> colunas
                      </span>
                      <button
                        onClick={() => void createDashboardFromTable(preview.table)}
                        disabled={creatingDash === preview.table}
                        className="text-[9px] font-black uppercase tracking-widest text-violet-300 bg-violet-500/15 hover:bg-violet-500/25 px-3 py-1.5 rounded-xl transition-all inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Plus className="w-3 h-3" /> Criar Dashboard desta tabela
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-white/5">
                      <table className="w-full text-xs min-w-[400px]">
                        <thead className="bg-white/[0.03]">
                          <tr>
                            {preview.columns.map((column) => {
                              const sem = getColumnSemantic(preview.table, column.name);
                              return (
                                <th
                                  key={column.name}
                                  className="px-3 py-3 text-left font-black uppercase tracking-wider text-stone-500 whitespace-nowrap"
                                >
                                  {sem.label}
                                  <span className="block font-mono text-[9px] normal-case tracking-normal text-stone-600 mt-0.5">
                                    {column.name}{column.key === 'PRI' ? ' [PK]' : ''}
                                  </span>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rows.map((row, index) => (
                            <tr key={index} className="border-t border-white/5 hover:bg-white/[0.02]">
                              {preview.columns.map((column) => (
                                <td
                                  key={column.name}
                                  className="px-3 py-3 text-stone-300 whitespace-nowrap max-w-[200px] truncate"
                                >
                                  {String(row[column.name] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="text-[10px] text-stone-600 uppercase tracking-widest">
                      Read-only · Limite: {preview.limit} linhas
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ─ Tab: Sugestões IA ─ */}
            {activeTab === 'suggest' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card rounded-[24px] p-4 sm:p-6 border border-white/5"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">Sugestões de Dashboard com IA</h3>
                  <Bot className="w-4 h-4 text-neon-cyan" />
                </div>

                <div className="mb-5 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-600">Atalhos rápidos</p>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_TABLE_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setDashboardPrompt(p)}
                        className={`text-[10px] font-bold px-3 py-2 rounded-xl transition-colors text-left ${
                          dashboardPrompt === p
                            ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30'
                            : 'bg-white/5 text-stone-400 hover:bg-white/10 hover:text-white border border-transparent'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={dashboardPrompt}
                  onChange={(e) => setDashboardPrompt(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none resize-none"
                  placeholder="Descreva o dashboard desejado em linguagem natural..."
                />

                <button
                  onClick={() => void loadDashboardSuggestions()}
                  disabled={dashboardLoading || !overview.ok}
                  className="mt-4 h-11 px-6 rounded-2xl bg-neon-cyan text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Bot className="w-4 h-4" />
                  {dashboardLoading ? 'Gerando...' : 'Gerar sugestões'}
                </button>

                {!overview.ok && (
                  <p className="mt-3 text-xs text-amber-400/70">
                    Conecte o Data Lake para habilitar sugestões.
                  </p>
                )}

                {dashboardSuggestions && (
                  <div className="mt-6 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-600">
                      Gerado por: {dashboardSuggestions.source === 'ai' ? 'IA' : 'Heuristica'}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {dashboardSuggestions.suggestions.map((suggestion) => (
                        <div
                          key={`${suggestion.title}-${suggestion.table}`}
                          className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 flex flex-col gap-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="text-sm font-black leading-tight">{suggestion.title}</h4>
                            <span className="shrink-0 rounded-lg bg-neon-cyan/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-neon-cyan">
                              {chartTypeLabel(suggestion.chartType)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] uppercase tracking-widest font-black text-neon-cyan bg-neon-cyan/10 px-2 py-1 rounded-lg">
                              {suggestion.chartType}
                            </span>
                            <span className="text-[9px] uppercase tracking-widest font-black text-stone-500 bg-white/5 px-2 py-1 rounded-lg">
                              {suggestion.table}
                            </span>
                            {suggestion.aggregation && (
                              <span className="text-[9px] uppercase tracking-widest font-black text-violet-400 bg-violet-400/10 px-2 py-1 rounded-lg">
                                {suggestion.aggregation}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-400 leading-relaxed">{suggestion.rationale}</p>
                          <button
                            onClick={() => void createDashboardFromSuggestion(suggestion)}
                            disabled={creatingDash === suggestion.table}
                            className="mt-auto h-8 rounded-xl bg-violet-500/15 text-violet-300 text-[9px] font-black uppercase tracking-widest hover:bg-violet-500/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {creatingDash === suggestion.table
                              ? <><RefreshCcw className="w-3 h-3 animate-spin" /> Criando...</>
                              : <><Plus className="w-3 h-3" /> Criar Dashboard</>}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </section>

        </div>
      </main>
    </div>
  );
}
