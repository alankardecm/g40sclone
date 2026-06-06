'use client';

import React, { use } from 'react';
import Sidebar from '@/components/Sidebar';
import WidgetCard from '@/components/datalake/WidgetCard';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart2, Plus, Trash2, ChevronRight, LayoutGrid, Search, Table2, Columns3, Eye,
  Sparkles, RefreshCcw, Wand2, Filter, CalendarRange, ScanSearch, SlidersHorizontal,
  ArrowLeft, Check, AlertCircle, Pencil, LayoutTemplate,
} from 'lucide-react';
import type { AggregationType, ChartType, FilterOperator, TimeBucket, WidgetConfig, WidgetSize } from '@/shared/types/dashboard';
import type { DashboardSuggestionResponse, DatalakeOverview, DatalakePreviewResult } from '@/shared/types/datalake';
import { getColumnSemantic, getFilterOperatorLabel, getTableSemantic, getTimeBucketLabel } from '@/lib/datalake-semantics';
import ColumnPicker from '@/components/datalake/ColumnPicker';
import {
  isAnalyticMetricColumn,
  isIdentifierColumnName,
  isNumericColumnType,
  isTemporalColumnName,
  isUsefulDimensionColumn,
  pickDimensionColumn,
  pickMetricColumn,
  pickStatusColumn,
  pickTemporalColumn,
} from '@/lib/dashboard-widget-intelligence';

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Barras' },
  { value: 'line', label: 'Linha' },
  { value: 'area', label: 'Area' },
  { value: 'pie', label: 'Pizza' },
  { value: 'metric', label: 'Metrica' },
  { value: 'table', label: 'Tabela' },
];

const CHART_HINTS: Record<ChartType, string> = {
  bar: 'Comparar categorias',
  line: 'Tendencia temporal',
  area: 'Volume ao longo do tempo',
  pie: 'Partes de um todo',
  metric: 'Valor unico (KPI)',
  table: 'Dados brutos',
};

const CHART_SVG: Record<ChartType, React.ReactNode> = {
  bar: (
    <svg viewBox="0 0 20 16" fill="currentColor" className="w-5 h-4">
      <rect x="1" y="8" width="4" height="8" rx="0.5" opacity="0.45" />
      <rect x="8" y="3" width="4" height="13" rx="0.5" />
      <rect x="15" y="5" width="4" height="11" rx="0.5" opacity="0.7" />
    </svg>
  ),
  line: (
    <svg viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-4">
      <polyline points="1,13 6,8 11,10 19,3" />
      <circle cx="1" cy="13" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="6" cy="8" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="11" cy="10" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="3" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  area: (
    <svg viewBox="0 0 20 16" fill="none" className="w-5 h-4">
      <path d="M1 13 L6 8 L11 10 L19 3 L19 15 L1 15 Z" fill="currentColor" fillOpacity="0.28" />
      <polyline points="1,13 6,8 11,10 19,3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pie: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M10 10 L10 1.5 A8.5 8.5 0 0 1 18.5 10 Z" />
      <path d="M10 10 L18.5 10 A8.5 8.5 0 0 1 3 16.3 Z" opacity="0.55" />
      <path d="M10 10 L3 16.3 A8.5 8.5 0 0 1 10 1.5 Z" opacity="0.3" />
    </svg>
  ),
  metric: (
    <svg viewBox="0 0 24 20" fill="none" className="w-5 h-4">
      <rect x="2" y="2" width="20" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.08" />
      <rect x="6" y="7" width="12" height="6" rx="1" fill="currentColor" />
    </svg>
  ),
  table: (
    <svg viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-5 h-4">
      <rect x="1" y="1" width="18" height="14" rx="1.5" />
      <line x1="1" y1="5" x2="19" y2="5" />
      <line x1="1" y1="9" x2="19" y2="9" />
      <line x1="1" y1="13" x2="19" y2="13" />
      <line x1="7" y1="1" x2="7" y2="15" />
      <line x1="13" y1="1" x2="13" y2="15" />
    </svg>
  ),
};
const AGGREGATIONS: { value: AggregationType; label: string }[] = [
  { value: 'count', label: 'COUNT (contagem)' },
  { value: 'count_distinct', label: 'COUNT DISTINCT (unicos)' },
  { value: 'sum', label: 'SUM (soma)' },
  { value: 'avg', label: 'AVG (media)' },
  { value: 'min', label: 'MIN (minimo)' },
  { value: 'max', label: 'MAX (maximo)' },
  { value: 'none', label: 'Sem agregacao (tabela raw)' },
];
const FILTER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'eq', label: getFilterOperatorLabel('eq') },
  { value: 'neq', label: getFilterOperatorLabel('neq') },
  { value: 'contains', label: getFilterOperatorLabel('contains') },
  { value: 'gte', label: getFilterOperatorLabel('gte') },
  { value: 'lte', label: getFilterOperatorLabel('lte') },
  { value: 'gt', label: getFilterOperatorLabel('gt') },
  { value: 'lt', label: getFilterOperatorLabel('lt') },
];
const TIME_BUCKETS: { value: TimeBucket; label: string }[] = [
  { value: 'none', label: getTimeBucketLabel('none') },
  { value: 'day', label: getTimeBucketLabel('day') },
  { value: 'month', label: getTimeBucketLabel('month') },
  { value: 'year', label: getTimeBucketLabel('year') },
];
const WIDGET_COLORS = ['#379890', '#3f7d78', '#5b90c7', '#6aa84f', '#d4a23a', '#bf6f8d', '#7ab8b1', '#8f7edc'];
const DECISION_PROMPTS = [
  'Quero um painel comercial para contratos, carteira e cidades mais relevantes.',
  'Quero identificar gargalos de atendimento, SLA e status de solicitacoes.',
  'Quero um dashboard executivo com receita, churn e distribuicao geografica.',
];

type ColumnInfo = { name: string; type: string };
type WidgetFormState = {
  title: string; table: string; chartType: ChartType; xColumn: string; metric: string;
  aggregation: AggregationType; limit: number; color: string;
  filterColumn: string; filterOperator: FilterOperator; filterValue: string;
  filter2Column: string; filter2Operator: FilterOperator; filter2Value: string;
  dateColumn: string; dateFrom: string; dateTo: string; timeBucket: TimeBucket;
  numericBucketSize: number; size: WidgetSize;
};
type QuickAction = {
  title: string; description: string; chartType: ChartType; aggregation: AggregationType;
  xColumn: string; metric: string; filterColumn?: string; filterValue?: string;
  filter2Column?: string; filter2Value?: string;
  dateColumn?: string; dateFrom?: string; dateTo?: string; timeBucket?: TimeBucket;
};

const emptyOverview: DatalakeOverview = {
  ok: false, status: 'disconnected', database: null, host: null, port: null,
  tableCount: 0, tables: [], previewLimit: 25,
};
const defaultForm: WidgetFormState = {
  title: '', table: '', chartType: 'bar', xColumn: '', metric: '',
  aggregation: 'count', limit: 20, color: WIDGET_COLORS[0],
  filterColumn: '', filterOperator: 'eq', filterValue: '',
  filter2Column: '', filter2Operator: 'eq', filter2Value: '',
  dateColumn: '', dateFrom: '', dateTo: '', timeBucket: 'none',
  numericBucketSize: 0, size: 'md',
};

// Mapeamento de tamanho para classes de grid col-span
const WIDGET_SIZE_COL: Record<WidgetSize, string> = {
  sm: 'col-span-1',
  md: 'col-span-1',
  lg: 'col-span-1 md:col-span-2',
  full: 'col-span-1 md:col-span-2 xl:col-span-3',
};

// Preset de datas para filtro global
type DatePreset = { label: string; days: number | null };
const DATE_PRESETS: DatePreset[] = [
  { label: 'Hoje', days: 0 },
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
  { label: 'Este ano', days: null },
];

function getPresetDates(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  if (preset.days === 0) {
    return { from: to, to };
  }
  if (preset.days === null) {
    // Este ano
    const from = `${now.getFullYear()}-01-01`;
    return { from, to };
  }
  const from = new Date(now);
  from.setDate(from.getDate() - preset.days);
  return { from: from.toISOString().slice(0, 10), to };
}

function generateId() { return `w-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function isNumericColumn(type: string) { return isNumericColumnType(type); }
function looksTemporalColumn(name: string) { return isTemporalColumnName(name); }

function buildWidget(input: {
  title: string; table: string; chartType: ChartType; aggregation: AggregationType;
  xColumn?: string; metric?: string; limit?: number; color: string;
  filterColumn?: string; filterOperator?: FilterOperator; filterValue?: string;
  filter2Column?: string; filter2Operator?: FilterOperator; filter2Value?: string;
  dateColumn?: string; dateFrom?: string; dateTo?: string; timeBucket?: TimeBucket;
  numericBucketSize?: number; size?: WidgetSize;
}): WidgetConfig {
  return {
    id: generateId(), title: input.title, table: input.table, chartType: input.chartType,
    xColumn: input.xColumn || '', metric: input.metric || '', aggregation: input.aggregation,
    limit: input.limit || 20, color: input.color, filterColumn: input.filterColumn || '',
    filterOperator: input.filterOperator || 'eq', filterValue: input.filterValue || '',
    filter2Column: input.filter2Column || '', filter2Operator: input.filter2Operator || 'eq',
    filter2Value: input.filter2Value || '',
    dateColumn: input.dateColumn || '', dateFrom: input.dateFrom || '',
    dateTo: input.dateTo || '', timeBucket: input.timeBucket || 'none',
    numericBucketSize: input.numericBucketSize || 0,
    size: input.size || 'md',
  };
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type Props = { params: Promise<{ id: string }> };

export default function DashboardEditorPage({ params }: Props) {
  const { id: dashboardId } = use(params);
  const router = useRouter();

  const [dashboardName, setDashboardName] = useState('Carregando...');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [form, setForm] = useState<WidgetFormState>(defaultForm);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [colsLoading, setColsLoading] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [overview, setOverview] = useState<DatalakeOverview>(emptyOverview);
  const [selectedTable, setSelectedTable] = useState('');
  const [preview, setPreview] = useState<DatalakePreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [explorerSearch, setExplorerSearch] = useState('');
  const [columnSearch, setColumnSearch] = useState('');
  const [suggestionPrompt, setSuggestionPrompt] = useState(DECISION_PROMPTS[0]);
  const [suggestions, setSuggestions] = useState<DashboardSuggestionResponse | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [explorerTab, setExplorerTab] = useState<'columns' | 'preview'>('columns');

  // Smart Assistant state
  const [smartPrompt, setSmartPrompt] = useState('');
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartResult, setSmartResult] = useState<DashboardSuggestionResponse | null>(null);

  // View mode toggle (edit = padrão, view = modo leitura limpo)
  const [viewMode, setViewMode] = useState<'edit' | 'view'>('edit');

  // Filtro de data global — para o view mode
  const [globalDateFrom, setGlobalDateFrom] = useState('');
  const [globalDateTo, setGlobalDateTo] = useState('');
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const dragId = useRef<string | null>(null);
  const dragOverId = useRef<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const widgetsRef = useRef(widgets);
  const nameRef = useRef(dashboardName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const deferredExplorerSearch = useDeferredValue(explorerSearch);
  const deferredColumnSearch = useDeferredValue(columnSearch);

  // Keep refs in sync
  useEffect(() => { widgetsRef.current = widgets; }, [widgets]);
  useEffect(() => { nameRef.current = dashboardName; }, [dashboardName]);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  function triggerAutoSave() {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(() => void persistDashboard(), 1500);
  }

  async function persistDashboard() {
    try {
      const res = await fetch(`/api/dashboards/${dashboardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameRef.current, widgets: widgetsRef.current }),
      });
      if (!res.ok) throw new Error();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2500);
    } catch {
      setSaveStatus('error');
    }
  }

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadOverview = useCallback(async () => {
    try {
      const response = await fetch('/api/datalake/schema');
      const data = (await response.json()) as DatalakeOverview;
      setOverview(data);
      if (data.ok && data.tables.length > 0) {
        const names = data.tables.map((t) => t.name);
        setAvailableTables(names);
        setSelectedTable((cur) => cur || names[0]);
        setForm((cur) => ({ ...cur, table: cur.table || names[0] }));
      }
    } catch {}
  }, []);

  const loadColumns = useCallback(async (table: string) => {
    if (!table) return;
    setColsLoading(true);
    try {
      const res = await fetch(`/api/datalake/columns?table=${encodeURIComponent(table)}`);
      const data = (await res.json()) as { ok: boolean; columns: ColumnInfo[] };
      setColumns(data.ok ? data.columns : []);
    } finally {
      setColsLoading(false);
    }
  }, []);

  const loadPreview = useCallback(async (table: string) => {
    if (!table) return;
    setPreviewLoading(true);
    try {
      const response = await fetch(`/api/datalake/preview?table=${encodeURIComponent(table)}`);
      const data = (await response.json()) as DatalakePreviewResult;
      setPreview(data.ok ? data : null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const loadSuggestions = useCallback(async (promptValue: string) => {
    setSuggestionsLoading(true);
    try {
      const response = await fetch('/api/datalake/dashboard-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptValue }),
      });
      const data = (await response.json()) as DashboardSuggestionResponse;
      setSuggestions(data.ok ? data : null);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await fetch(`/api/dashboards/${dashboardId}`);
        const data = (await res.json()) as { ok: boolean; dashboard?: { name: string; widgets: WidgetConfig[] } };
        if (data.ok && data.dashboard) {
          setDashboardName(data.dashboard.name);
          setWidgets(data.dashboard.widgets ?? []);
        }
      } catch {}
    }
    void loadDashboard();
    void loadOverview();
    void loadSuggestions(DECISION_PROMPTS[0]);
  }, [dashboardId, loadOverview, loadSuggestions]);

  useEffect(() => {
    if (!selectedTable) return;
    void loadColumns(selectedTable);
    void loadPreview(selectedTable);
    setForm((cur) => ({ ...cur, table: selectedTable, xColumn: '', metric: '' }));
  }, [selectedTable, loadColumns, loadPreview]);

  useEffect(() => {
    if (showPanel && form.table) void loadColumns(form.table);
  }, [form.table, showPanel, loadColumns]);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredTables = useMemo(() => {
    const needle = deferredExplorerSearch.trim().toLowerCase();
    if (!needle) return overview.tables;
    return overview.tables.filter((table) => {
      const semantic = getTableSemantic(table.name);
      return (
        table.name.toLowerCase().includes(needle) ||
        semantic.label.toLowerCase().includes(needle) ||
        semantic.description.toLowerCase().includes(needle)
      );
    });
  }, [overview.tables, deferredExplorerSearch]);

  const filteredColumns = useMemo(() => {
    const needle = deferredColumnSearch.trim().toLowerCase();
    if (!needle) return columns;
    return columns.filter((col) => {
      const semantic = getColumnSemantic(selectedTable, col.name);
      return (
        col.name.toLowerCase().includes(needle) ||
        col.type.toLowerCase().includes(needle) ||
        semantic.label.toLowerCase().includes(needle) ||
        (semantic.description || '').toLowerCase().includes(needle)
      );
    });
  }, [columns, deferredColumnSearch, selectedTable]);

  const numericColumns = useMemo(() => columns.filter(isAnalyticMetricColumn), [columns]);
  const dimensionalColumns = useMemo(() => columns.filter((c) => isUsefulDimensionColumn(selectedTable, c)), [columns, selectedTable]);
  const temporalColumns = useMemo(() => columns.filter((c) => looksTemporalColumn(c.name)), [columns]);
  const selectedTableSemantic = useMemo(() => getTableSemantic(selectedTable), [selectedTable]);

  const quickActions = useMemo<QuickAction[]>(() => {
    if (!selectedTable) return [];
    const countDimension = pickDimensionColumn(selectedTable, columns)?.name || dimensionalColumns[0]?.name || '';
    const topMetric = pickMetricColumn(columns)?.name || numericColumns[0]?.name || '';
    const trendDimension = pickTemporalColumn(columns)?.name || temporalColumns[0]?.name || '';
    const statusColumn = pickStatusColumn(columns)?.name || '';
    const activeStatusValue = selectedTable === 'fato_contratos' ? 'ativo' : '';
    const startDateColumn = trendDimension;
    const januaryStart = '2026-01-01';
    const januaryEnd = '2026-01-31';
    const defaults: QuickAction[] = [
      { title: 'Tabela exploratoria', description: 'Mostra linhas brutas para inspecao rapida da base.', chartType: 'table', aggregation: 'none', xColumn: '', metric: '' },
      ...(countDimension ? [{ title: 'Contagem por categoria', description: 'Ajuda a descobrir distribuicao por status, cidade, vendedor ou tipo.', chartType: 'bar' as const, aggregation: 'count' as const, xColumn: countDimension, metric: '' }] : []),
      ...(trendDimension ? [{ title: 'Volume mensal', description: 'Mostra volume por mes usando a melhor coluna de data da tabela.', chartType: 'line' as const, aggregation: 'count' as const, xColumn: trendDimension, metric: '', timeBucket: 'month' as const }] : []),
      ...(countDimension && topMetric ? [{ title: 'Valor por categoria', description: 'Soma uma coluna financeira real por uma dimensao de negocio.', chartType: 'bar' as const, aggregation: 'sum' as const, xColumn: countDimension, metric: topMetric }] : []),
    ];
    if (selectedTable === 'fato_contratos') {
      const sellerColumn = columns.find((c) => /vendedor/i.test(c.name) && !isIdentifierColumnName(c.name))?.name || countDimension;
      const revenueColumn = columns.find((c) => /valor|receita|total/i.test(c.name))?.name || topMetric;
      return [
        { title: 'Contratos ativos em janeiro/2026', description: 'Card de resposta direta para saber quantos contratos ficaram ativos no periodo.', chartType: 'metric', aggregation: 'count', xColumn: '', metric: '', filterColumn: statusColumn, filterValue: activeStatusValue, dateColumn: startDateColumn, dateFrom: januaryStart, dateTo: januaryEnd, timeBucket: 'none' },
        { title: 'Ativacoes por mes', description: 'Leitura mensal para acompanhar volume de contratos ao longo do tempo.', chartType: 'line', aggregation: 'count', xColumn: startDateColumn, metric: '', timeBucket: 'month' },
        { title: 'Contratos ativos por cidade', description: 'Distribuicao da carteira ativa por cidade.', chartType: 'bar', aggregation: 'count', xColumn: columns.find((c) => /cidade/i.test(c.name))?.name || countDimension, metric: '', filterColumn: statusColumn, filterValue: activeStatusValue },
        { title: 'Vendas por vendedor no periodo', description: 'Ranking comercial para somar o valor vendido por cada vendedor no recorte selecionado.', chartType: 'bar', aggregation: 'sum', xColumn: sellerColumn, metric: revenueColumn, filterColumn: statusColumn, filterValue: 'Aprovado', dateColumn: startDateColumn, dateFrom: januaryStart, dateTo: januaryEnd, timeBucket: 'none' },
        ...defaults,
      ];
    }
    return defaults;
  }, [selectedTable, dimensionalColumns, columns, numericColumns, temporalColumns]);

  // ── Widget operations ──────────────────────────────────────────────────────
  function pushWidget(widget: WidgetConfig) {
    setWidgets((prev) => [...prev, widget]);
    setColorIndex((i) => i + 1);
    triggerAutoSave();
  }
  function handleChartTypeChange(ct: ChartType) {
    setForm((f) => ({
      ...f,
      chartType: ct,
      aggregation: ct === 'table' ? 'none' : f.aggregation === 'none' ? 'count' : f.aggregation,
      xColumn: ct === 'metric' ? '' : f.xColumn,
    }));
  }

  function handleAggregationChange(agg: AggregationType) {
    setForm((f) => ({
      ...f,
      aggregation: agg,
      chartType: agg === 'none' ? 'table' : f.chartType === 'table' ? 'bar' : f.chartType,
    }));
  }

  function closePanel() { setShowPanel(false); setEditingWidgetId(null); }
  function openPanel() {
    const nextColor = WIDGET_COLORS[colorIndex % WIDGET_COLORS.length];
    setForm({ ...defaultForm, color: nextColor, table: selectedTable || availableTables[0] || '' });
    setEditingWidgetId(null);
    setShowPanel(true);
  }
  function inspectWidget(widget: WidgetConfig) {
    setEditingWidgetId(widget.id);
    setForm({
      title: widget.title, table: widget.table, chartType: widget.chartType, xColumn: widget.xColumn,
      metric: widget.metric || '', aggregation: widget.aggregation, limit: widget.limit,
      color: widget.color || WIDGET_COLORS[0],
      filterColumn: widget.filterColumn || '', filterOperator: widget.filterOperator || 'eq', filterValue: widget.filterValue || '',
      filter2Column: widget.filter2Column || '', filter2Operator: widget.filter2Operator || 'eq', filter2Value: widget.filter2Value || '',
      dateColumn: widget.dateColumn || '', dateFrom: widget.dateFrom || '', dateTo: widget.dateTo || '', timeBucket: widget.timeBucket || 'none',
      numericBucketSize: widget.numericBucketSize || 0,
      size: widget.size || 'md',
    });
    setSelectedTable(widget.table);
    setShowPanel(true);
  }
  function addWidget() {
    if (!form.title || !form.table) return;
    const nextWidget = buildWidget({
      title: form.title, table: form.table, chartType: form.chartType, aggregation: form.aggregation,
      xColumn: form.xColumn, metric: form.metric, limit: form.limit, color: form.color,
      filterColumn: form.filterColumn, filterOperator: form.filterOperator, filterValue: form.filterValue,
      filter2Column: form.filter2Column, filter2Operator: form.filter2Operator, filter2Value: form.filter2Value,
      dateColumn: form.dateColumn, dateFrom: form.dateFrom, dateTo: form.dateTo, timeBucket: form.timeBucket,
      numericBucketSize: form.numericBucketSize, size: form.size,
    });
    if (editingWidgetId) {
      setWidgets((prev) => prev.map((w) => (w.id === editingWidgetId ? { ...nextWidget, id: editingWidgetId } : w)));
      triggerAutoSave();
    } else {
      pushWidget(nextWidget);
    }
    closePanel();
  }
  function addQuickAction(action: QuickAction) {
    if (!selectedTable) return;
    const color = WIDGET_COLORS[colorIndex % WIDGET_COLORS.length];
    pushWidget(buildWidget({ 
      title: `${getTableSemantic(selectedTable).label} | ${action.title}`, table: selectedTable, 
      chartType: action.chartType, aggregation: action.aggregation, xColumn: action.xColumn, metric: action.metric, 
      limit: action.chartType === 'table' ? 25 : 12, color, 
      filterColumn: action.filterColumn, filterValue: action.filterValue, 
      filter2Column: action.filter2Column, filter2Value: action.filter2Value, 
      dateColumn: action.dateColumn, dateFrom: action.dateFrom, dateTo: action.dateTo, timeBucket: action.timeBucket 
    }));
  }
  async function runSmartAssistant() {
    if (!smartPrompt.trim()) return;
    setSmartLoading(true);
    setSmartResult(null);
    try {
      const res = await fetch('/api/datalake/smart-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: smartPrompt }),
      });
      const data = (await res.json()) as DashboardSuggestionResponse;
      if (data.ok) setSmartResult(data);
    } catch {
      // fail silently
    } finally {
      setSmartLoading(false);
    }
  }

  function addSuggestion(suggestion: any) {
    if (!suggestion) return;
    const color = WIDGET_COLORS[colorIndex % WIDGET_COLORS.length];
    const suggestedMetric = suggestion.metric || suggestion.y || '';
    const safeMetric = suggestedMetric && !isIdentifierColumnName(suggestedMetric) ? suggestedMetric : '';
    const suggestedAggregation = suggestion.aggregation || 'count';
    const safeAggregation = suggestedAggregation === 'sum' && !safeMetric ? 'count' : suggestedAggregation;
    
    pushWidget(buildWidget({
      title: suggestion.title,
      table: suggestion.table,
      chartType: suggestion.chartType,
      aggregation: safeAggregation,
      xColumn: suggestion.x,
      metric: safeMetric,
      limit: suggestion.chartType === 'table' ? 25 : 15,
      color,
      filterColumn: suggestion.filterColumn,
      filterOperator: suggestion.filterOperator,
      filterValue: suggestion.filterValue,
      filter2Column: suggestion.filter2Column,
      filter2Operator: suggestion.filter2Operator,
      filter2Value: suggestion.filter2Value,
      dateColumn: suggestion.dateColumn,
      dateFrom: suggestion.dateFrom,
      dateTo: suggestion.dateTo,
      timeBucket: suggestion.timeBucket || (suggestion.x && isTemporalColumnName(suggestion.x) ? 'month' : 'none'),
    }));
  }
  function removeWidget(id: string) {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    if (editingWidgetId === id) closePanel();
    triggerAutoSave();
  }
  function clearAll() {
    if (confirm('Limpar todos os widgets?')) { setWidgets([]); triggerAutoSave(); }
  }
  function handleDragStart(id: string) { dragId.current = id; }
  function handleDragOver(e: React.DragEvent, id: string) { e.preventDefault(); dragOverId.current = id; }
  function handleDrop() {
    if (!dragId.current || !dragOverId.current || dragId.current === dragOverId.current) return;
    setWidgets((prev) => {
      const items = [...prev];
      const from = items.findIndex((w) => w.id === dragId.current);
      const to = items.findIndex((w) => w.id === dragOverId.current);
      if (from === -1 || to === -1) return prev;
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);
      return items;
    });
    dragId.current = null;
    dragOverId.current = null;
    triggerAutoSave();
  }

  // ── Name editing ───────────────────────────────────────────────────────────
  function startEditingName() {
    setNameInput(dashboardName);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 50);
  }
  function commitNameEdit() {
    const trimmed = nameInput.trim() || 'Dashboard sem título';
    setDashboardName(trimmed);
    setEditingName(false);
    triggerAutoSave();
  }

  // ── Save status indicator ──────────────────────────────────────────────────
  const saveIndicator = useMemo(() => {
    if (saveStatus === 'saving') return { label: 'Salvando...', color: 'text-muted-foreground', icon: <RefreshCcw className="w-3 h-3 animate-spin" /> };
    if (saveStatus === 'saved') return { label: 'Salvo', color: 'text-[#379890]', icon: <Check className="w-3 h-3" /> };
    if (saveStatus === 'error') return { label: 'Erro ao salvar', color: 'text-red-500', icon: <AlertCircle className="w-3 h-3" /> };
    return null;
  }, [saveStatus]);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans antialiased">
      <Sidebar />
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-4 py-6 sm:px-8 sm:py-8 lg:px-10 flex min-h-full flex-col gap-8">

          {/* Header */}
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">
                <button onClick={() => router.push('/dashboards')} className="flex items-center gap-1.5 hover:text-[#143230] transition-colors">
                  <ArrowLeft className="w-3 h-3" /> Dashboards
                </button>
                <ChevronRight className="w-3 h-3" />
                <span className="text-[#379890] italic">Editor</span>
              </div>

              <div className="mt-4 flex items-center gap-3">
                {editingName ? (
                  <input
                    ref={nameInputRef}
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onBlur={commitNameEdit}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitNameEdit(); if (e.key === 'Escape') setEditingName(false); }}
                    className="text-2xl sm:text-4xl font-black tracking-[-0.05em] text-[#143230] bg-transparent border-b-2 border-[#379890] outline-none w-full max-w-2xl"
                    maxLength={120}
                  />
                ) : (
                  <button onClick={startEditingName} className="group flex items-center gap-3 text-left">
                    <h1 className="text-2xl sm:text-4xl font-black tracking-[-0.05em] text-[#143230] leading-tight">
                      {dashboardName}
                    </h1>
                    <Pencil className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                )}
              </div>

              {saveIndicator && (
                <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${saveIndicator.color}`}>
                  {saveIndicator.icon}
                  {saveIndicator.label}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {/* Toggle View/Edit */}
              <div className="flex items-center gap-1 rounded-2xl border border-[#143230]/10 bg-[#f7f8f4] p-1">
                <button
                  onClick={() => setViewMode('edit')}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'edit' ? 'bg-card text-[#143230] shadow-sm' : 'text-muted-foreground hover:text-[#143230]'}`}
                >
                  <Pencil className="w-3 h-3" /> Editar
                </button>
                <button
                  onClick={() => setViewMode('view')}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'view' ? 'bg-[#379890] text-white shadow-sm' : 'text-muted-foreground hover:text-[#143230]'}`}
                >
                  <LayoutTemplate className="w-3 h-3" /> Visualizar
                </button>
              </div>

              {viewMode === 'edit' && widgets.length > 0 && (
                <button onClick={clearAll} className="h-10 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 text-[9px] font-black uppercase tracking-widest text-red-500 transition-all hover:bg-red-500/20">
                  <span className="inline-flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" /> Limpar</span>
                </button>
              )}
              {viewMode === 'edit' && (
                <button onClick={openPanel} className="h-10 rounded-2xl bg-[#379890] px-6 text-[9px] font-black uppercase tracking-widest text-white shadow-[0_18px_38px_-18px_rgba(55,152,144,0.45)] transition-all hover:scale-105 active:scale-95">
                  <span className="inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Novo Widget</span>
                </button>
              )}
            </div>
          </header>

          {/* Filtro de data global — view mode apenas */}
          {viewMode === 'view' && (
            <div className="rounded-[24px] border border-[#143230]/8 bg-card/85 px-5 py-4 shadow-[0_8px_24px_-12px_rgba(20,50,48,0.12)]">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  <CalendarRange className="w-3.5 h-3.5 text-[#379890]" />
                  Período global
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {DATE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        const { from, to } = getPresetDates(preset);
                        setGlobalDateFrom(from);
                        setGlobalDateTo(to);
                        setActivePreset(preset.label);
                      }}
                      className={`rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                        activePreset === preset.label
                          ? 'bg-[#379890] text-white shadow-sm'
                          : 'border border-[#143230]/10 bg-card text-muted-foreground hover:border-[#379890]/30 hover:text-[#143230]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <input
                    type="date"
                    value={globalDateFrom}
                    onChange={(e) => { setGlobalDateFrom(e.target.value); setActivePreset(null); }}
                    className="rounded-xl border border-[#143230]/10 bg-card px-3 py-1.5 text-xs outline-none focus:border-[#379890]/50"
                  />
                  <span className="text-[10px] text-muted-foreground">até</span>
                  <input
                    type="date"
                    value={globalDateTo}
                    onChange={(e) => { setGlobalDateTo(e.target.value); setActivePreset(null); }}
                    className="rounded-xl border border-[#143230]/10 bg-card px-3 py-1.5 text-xs outline-none focus:border-[#379890]/50"
                  />
                  {(globalDateFrom || globalDateTo) && (
                    <button
                      onClick={() => { setGlobalDateFrom(''); setGlobalDateTo(''); setActivePreset(null); }}
                      className="rounded-xl border border-[#143230]/10 bg-card px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Explorer grid — edit mode apenas */}
          {viewMode === 'edit' && <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[0.9fr_1.2fr_0.9fr]">

            {/* Tables */}
            <div className="rounded-[30px] border border-[#143230]/8 bg-card/85 p-6 shadow-[0_20px_50px_-34px_rgba(20,50,48,0.18)]">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Catalogo</p><h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#143230]">Tabelas</h2></div>
                <Table2 className="w-6 h-6 text-[#379890]" />
              </div>
              <div className="mt-5 rounded-2xl border border-[#143230]/10 bg-[#f7f8f4] px-4 py-3 flex items-center gap-3">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input value={explorerSearch} onChange={(e) => setExplorerSearch(e.target.value)} placeholder="Buscar tabela" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              </div>
              <div className="mt-5 space-y-3 max-h-[320px] lg:max-h-[440px] xl:max-h-[560px] overflow-y-auto pr-1">
                {filteredTables.map((table) => {
                  const active = selectedTable === table.name;
                  const hint = getTableSemantic(table.name);
                  return (
                    <button key={table.name} onClick={() => setSelectedTable(table.name)} className={`w-full rounded-[22px] border p-4 text-left transition-all ${active ? 'border-[#379890]/30 bg-[#379890]/10 shadow-[0_18px_35px_-25px_rgba(55,152,144,0.45)]' : 'border-[#143230]/8 bg-card hover:border-[#379890]/20'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-sm font-black text-[#143230]">{hint.label}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{table.name}</p></div>
                        <span className="rounded-full border border-[#143230]/8 px-2 py-1 text-[10px] font-black text-muted-foreground">{table.rows?.toLocaleString('pt-BR') ?? '-'} rows</span>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{hint.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Column explorer + preview */}
            <div className="lg:col-span-1 xl:col-span-1 rounded-[30px] border border-[#143230]/8 bg-card/85 p-6 shadow-[0_20px_50px_-34px_rgba(20,50,48,0.18)] flex flex-col">

              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Explorador</p>
                  <h2 className="mt-1.5 text-2xl font-black tracking-[-0.05em] text-[#143230] leading-tight">
                    {selectedTableSemantic.label || 'Selecione uma tabela'}
                  </h2>
                  {selectedTable && (
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{selectedTable}</p>
                  )}
                </div>
                <button
                  onClick={() => selectedTable && void loadPreview(selectedTable)}
                  className="shrink-0 rounded-2xl border border-[#143230]/10 bg-card px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:border-[#379890]/20 hover:text-[#143230] transition-colors"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <RefreshCcw className={`w-3 h-3 ${previewLoading ? 'animate-spin' : ''}`} />
                    Atualizar
                  </span>
                </button>
              </div>

              {/* Stats strip */}
              <div className="mt-4 flex gap-2">
                <div className="flex-1 rounded-2xl bg-[#f7f8f4] border border-[#143230]/6 px-3 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Rows</p>
                  <p className="mt-1 text-xl font-black text-[#143230]">
                    {overview.tables.find((t) => t.name === selectedTable)?.rows?.toLocaleString('pt-BR') || '—'}
                  </p>
                </div>
                <div className="flex-1 rounded-2xl bg-[#f7f8f4] border border-[#143230]/6 px-3 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Colunas</p>
                  <p className="mt-1 text-xl font-black text-[#143230]">{columns.length || '—'}</p>
                </div>
                <div className="flex-1 rounded-2xl bg-[#f7f8f4] border border-[#143230]/6 px-3 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Foco</p>
                  <p className="mt-1 text-[11px] font-black text-[#143230] leading-tight">
                    {selectedTableSemantic.focus.slice(0, 2).join(' / ') || 'Geral'}
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="mt-4 flex rounded-2xl border border-[#143230]/8 bg-[#f7f8f4] p-1 gap-1">
                <button
                  onClick={() => setExplorerTab('columns')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all ${explorerTab === 'columns' ? 'bg-card text-[#143230] shadow-sm' : 'text-muted-foreground hover:text-[#143230]'}`}
                >
                  <Columns3 className="w-3.5 h-3.5" />
                  Colunas
                  {colsLoading && <RefreshCcw className="w-3 h-3 animate-spin opacity-50" />}
                </button>
                <button
                  onClick={() => setExplorerTab('preview')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all ${explorerTab === 'preview' ? 'bg-card text-[#143230] shadow-sm' : 'text-muted-foreground hover:text-[#143230]'}`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </button>
              </div>

              {/* Tab: Colunas */}
              {explorerTab === 'columns' && (
                <div className="mt-4 flex flex-col flex-1 min-h-0">
                  <div className="rounded-2xl border border-[#143230]/10 bg-[#f7f8f4] px-4 py-2.5 flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                      value={columnSearch}
                      onChange={(e) => setColumnSearch(e.target.value)}
                      placeholder="Buscar coluna ou tipo..."
                      className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="mt-3 flex-1 overflow-y-auto max-h-[480px] pr-1 space-y-1">
                    {filteredColumns.map((col) => {
                      const semantic = getColumnSemantic(selectedTable, col.name);
                      const isNum = isNumericColumn(col.type);
                      const rawType = col.type.split('(')[0].toLowerCase();
                      return (
                        <div
                          key={col.name}
                          className="group flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 hover:bg-card border border-transparent hover:border-[#143230]/8 transition-all cursor-default"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#143230] truncate">{semantic.label}</p>
                            <p className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">{col.name}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {semantic.category && (
                              <span className="rounded-full bg-[#379890]/10 px-2 py-0.5 text-[10px] font-black uppercase text-[#2c7f78]">
                                {semantic.category}
                              </span>
                            )}
                            {isNum && (
                              <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-600">
                                num
                              </span>
                            )}
                            <span className="rounded-full bg-[#143230]/5 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                              {rawType}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {filteredColumns.length === 0 && !colsLoading && (
                      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                        {selectedTable ? 'Nenhuma coluna encontrada.' : 'Selecione uma tabela.'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Preview */}
              {explorerTab === 'preview' && (
                <div className="mt-4 flex-1 rounded-2xl border border-[#143230]/8 bg-[#fcfcfb] overflow-auto max-h-[540px]">
                  {previewLoading ? (
                    <div className="flex h-48 items-center justify-center gap-3 text-sm text-muted-foreground">
                      <RefreshCcw className="w-4 h-4 animate-spin" /> Carregando amostra...
                    </div>
                  ) : !preview || preview.columns.length === 0 ? (
                    <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Eye className="w-6 h-6 opacity-30" />
                      Selecione uma tabela para ver os dados.
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[#eef1ed] z-10">
                        <tr>
                          {preview.columns.map((col) => {
                            const sem = getColumnSemantic(selectedTable, col.name);
                            return (
                              <th key={col.name} className="px-3 py-2.5 text-left whitespace-nowrap border-r border-[#143230]/6 last:border-r-0">
                                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#143230]">{sem.label}</div>
                                <div className="mt-0.5 font-mono text-[9px] text-muted-foreground normal-case tracking-normal">{col.name}</div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, i) => (
                          <tr key={i} className={`border-t border-[#143230]/5 ${i % 2 === 0 ? '' : 'bg-[#f9faf8]'} hover:bg-[#f0f6f5] transition-colors`}>
                            {preview.columns.map((col) => (
                              <td key={col.name} className="max-w-[200px] truncate px-3 py-2 text-muted-foreground border-r border-[#143230]/4 last:border-r-0">
                                {String(row[col.name] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>

            {/* Quick actions + AI suggestions */}
            <div className="lg:col-span-2 xl:col-span-1 rounded-[30px] border border-[#143230]/8 bg-card/85 p-6 shadow-[0_20px_50px_-34px_rgba(20,50,48,0.18)]">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Acoes</p><h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#143230]">Decisao rapida</h2></div>
                <Sparkles className="w-6 h-6 text-[#379890]" />
              </div>
              <div className="mt-5 space-y-3">
                {quickActions.map((action) => (
                  <button key={action.title} onClick={() => addQuickAction(action)} disabled={!selectedTable || (action.aggregation !== 'none' && !action.xColumn)} className="w-full rounded-[22px] border border-[#143230]/8 bg-[#f7f8f4] p-4 text-left transition-all hover:border-[#379890]/20 disabled:opacity-50">
                    <p className="text-sm font-black text-[#143230]">{action.title}</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{action.description}</p>
                  </button>
                ))}
              </div>

              {/* Smart Assistant */}
              <div className="mt-8 rounded-[24px] border border-[#379890]/20 bg-[#379890]/5 p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-[#379890]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2c7f78]">Assistente Inteligente</p>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">Fale o que voce precisa em linguagem natural e eu monto os widgets para voce.</p>
                <div className="mt-4 flex gap-2">
                  <input
                    value={smartPrompt}
                    onChange={(e) => setSmartPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSmartAssistant()}
                    placeholder="Ex: Contratos ativos por cidade..."
                    className="flex-1 rounded-xl border border-[#379890]/20 bg-card px-3 py-2 text-sm outline-none focus:border-[#379890] transition-all"
                  />
                  <button
                    onClick={runSmartAssistant}
                    disabled={smartLoading || !smartPrompt.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#379890] text-white shadow-lg shadow-[#379890]/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    {smartLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>

                {smartResult && (
                  <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                    {smartResult.suggestions.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic">Nao consegui encontrar widgets para esse pedido. Tente ser mais especifico.</p>
                    ) : (
                      smartResult.suggestions.map((suggestion, index) => (
                        <div key={`smart-${index}`} className="rounded-2xl border border-[#379890]/10 bg-card p-4 shadow-sm">
                          <p className="text-sm font-black text-[#143230]">{suggestion.title}</p>
                          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{suggestion.rationale}</p>
                          <button
                            onClick={() => addSuggestion(suggestion)}
                            className="mt-4 rounded-full bg-[#379890] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white hover:opacity-90 transition-all shadow-md shadow-[#379890]/10"
                          >
                            Adicionar ao dashboard
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8 rounded-[24px] border border-[#143230]/8 bg-[#f7f8f4] p-4">
                <div className="flex items-center gap-2"><Wand2 className="w-4 h-4 text-[#379890]" /><p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Sugestoes por objetivo</p></div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {DECISION_PROMPTS.map((prompt) => (
                    <button key={prompt} onClick={() => { setSuggestionPrompt(prompt); void loadSuggestions(prompt); }} className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${suggestionPrompt === prompt ? 'bg-[#379890] text-white' : 'border border-[#143230]/10 bg-card text-muted-foreground hover:border-[#379890]/20'}`}>{prompt.slice(0, 28)}...</button>
                  ))}
                </div>
                <div className="mt-4 space-y-3">
                  {suggestionsLoading ? (
                    <div className="rounded-2xl border border-[#143230]/8 bg-card px-4 py-6 text-sm text-muted-foreground">Gerando sugestoes...</div>
                  ) : (
                    suggestions?.suggestions.slice(0, 3).map((suggestion, index) => (
                      <div key={`${suggestion.title}-${index}`} className="rounded-2xl border border-[#143230]/8 bg-card p-4">
                        <p className="text-sm font-black text-[#143230]">{suggestion.title}</p>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{suggestion.rationale}</p>
                        <button onClick={() => addSuggestion(suggestion)} className="mt-4 rounded-full bg-[#379890]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#2c7f78] hover:bg-[#379890]/20">Adicionar ao dashboard</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>}

          {/* Widget count bar — edit mode apenas */}
          {viewMode === 'edit' && widgets.length > 0 && (
            <div className="flex items-center gap-6 rounded-[24px] border border-[#143230]/8 bg-card/70 px-5 py-4">
              <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground"><LayoutGrid className="w-4 h-4" /><span>{widgets.length} widget{widgets.length !== 1 ? 's' : ''}</span></div>
              <div className="text-[10px] font-black text-muted-foreground">Arraste os cards para reordenar.</div>
            </div>
          )}

          {/* Empty widget state */}
          {widgets.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-1 flex-col items-center justify-center gap-6 rounded-[36px] border border-[#379890]/10 bg-card/75 py-24">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#379890]/12 shadow-[0_24px_40px_-24px_rgba(55,152,144,0.45)]"><BarChart2 className="h-9 w-9 text-[#379890]" /></div>
              <div className="text-center">
                <h2 className="mb-2 text-2xl font-black text-[#143230]">Dashboard vazio</h2>
                <p className="text-sm text-muted-foreground">Escolha uma tabela, entenda as colunas e use as acoes rapidas para subir a primeira leitura.</p>
              </div>
            </motion.div>
          )}

          {/* Widget grid — modo edição com drag-and-drop */}
          {viewMode === 'edit' && widgets.length > 0 && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 pb-12">
              <AnimatePresence mode="popLayout">
                {widgets.map((widget) => (
                  <div
                    key={widget.id}
                    draggable
                    onDragStart={() => handleDragStart(widget.id)}
                    onDragOver={(e) => handleDragOver(e, widget.id)}
                    onDrop={handleDrop}
                    className={WIDGET_SIZE_COL[widget.size ?? 'md']}
                  >
                    <WidgetCard widget={widget} onRemove={removeWidget} onInspect={inspectWidget} dragHandleProps={{ onMouseDown: (e) => e.stopPropagation() }} />
                  </div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Widget grid — modo visualização limpo com filtro global */}
          {viewMode === 'view' && widgets.length > 0 && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 pb-12">
              <AnimatePresence mode="popLayout">
                {widgets.map((widget) => {
                  // Aplica filtro global se o widget tem dateColumn configurado
                  const overriddenWidget: WidgetConfig =
                    (globalDateFrom || globalDateTo) && widget.dateColumn
                      ? {
                          ...widget,
                          dateFrom: globalDateFrom || widget.dateFrom,
                          dateTo: globalDateTo || widget.dateTo,
                        }
                      : widget;
                  return (
                    <div key={widget.id} className={WIDGET_SIZE_COL[widget.size ?? 'md']}>
                      <WidgetCard
                        widget={overriddenWidget}
                        onRemove={removeWidget}
                        viewMode={true}
                      />
                    </div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Widget builder panel */}
      <AnimatePresence>
        {showPanel && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closePanel} className="fixed inset-0 z-40 bg-[#143230]/25 backdrop-blur-[2px]" />
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className="fixed right-0 top-0 z-50 flex h-full w-full sm:w-[430px] flex-col border-l border-[#143230]/10 bg-[#f7f8f4] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#143230]/8 bg-card/80 px-6 py-5">
                <div className="flex items-center gap-3"><Plus className="h-5 w-5 text-[#379890]" /><div><h2 className="text-sm font-black uppercase tracking-widest text-[#143230]">{editingWidgetId ? 'Editar Widget' : 'Novo Widget'}</h2><p className="mt-1 text-[11px] text-muted-foreground">{editingWidgetId ? 'Revise a montagem e salve de novo' : 'Monte uma leitura clara com recorte e pergunta de negocio'}</p></div></div>
                <button onClick={closePanel} className="text-xl leading-none text-muted-foreground transition-colors hover:text-[#143230]">×</button>
              </div>
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
                <div className="rounded-[24px] border border-[#143230]/8 bg-card p-4">
                  <div className="flex items-center gap-2"><ScanSearch className="h-4 w-4 text-[#379890]" /><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pergunta</p></div>
                  <div className="mt-4"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Titulo *</label><input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Contratos ativos em janeiro de 2026" className="mt-2 w-full rounded-2xl border border-[#143230]/10 bg-card px-4 py-3 text-sm outline-none focus:border-[#379890]/50" /></div>
                  <div className="mt-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tabela base *</label>
                    <div className="mt-2 space-y-2">
                      {availableTables.map((t) => {
                        const sem = getTableSemantic(t);
                        const tableInfo = overview.tables.find((ot) => ot.name === t);
                        const active = form.table === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, table: t, xColumn: '', metric: '', filterColumn: '', dateColumn: '' }))}
                            className={`w-full rounded-2xl border px-4 py-3 text-left flex items-center justify-between gap-3 transition-all ${active ? 'border-[#379890]/30 bg-[#379890]/8 shadow-[0_8px_20px_-12px_rgba(55,152,144,0.3)]' : 'border-[#143230]/8 bg-card hover:border-[#379890]/20'}`}
                          >
                            <div className="min-w-0">
                              <p className={`text-sm font-black truncate ${active ? 'text-[#2c7f78]' : 'text-[#143230]'}`}>{sem.label}</p>
                              <p className="font-mono text-[10px] text-muted-foreground">{t}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {tableInfo?.rows != null && (
                                <span className="text-[10px] font-black text-muted-foreground">{tableInfo.rows.toLocaleString('pt-BR')} rows</span>
                              )}
                              {active && <Check className="w-4 h-4 text-[#379890]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-[#379890]/15 bg-[#379890]/6 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2c7f78]">Como montar sem confusao</p>
                    <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
                      <p><strong className="text-[#143230]">1. Quem aparece no grafico?</strong> Escolha em <strong className="text-[#143230]">Eixo ou categoria</strong>.</p>
                      <p><strong className="text-[#143230]">2. O que sera calculado?</strong> Defina em <strong className="text-[#143230]">Calculo</strong>.</p>
                      <p><strong className="text-[#143230]">3. Qual recorte?</strong> Use <strong className="text-[#143230]">Filtro de negocio</strong>.</p>
                      <p><strong className="text-[#143230]">4. Qual periodo?</strong> Use <strong className="text-[#143230]">Coluna de periodo</strong>.</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-[#143230]/8 bg-card p-4">
                  <div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-[#379890]" /><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Leitura</p></div>
                  <div className="mt-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de grafico</label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {CHART_TYPES.map((ct) => (
                        <button
                          key={ct.value}
                          type="button"
                          onClick={() => handleChartTypeChange(ct.value)}
                          className={`rounded-2xl border py-3 px-2 flex flex-col items-center gap-1 transition-all ${form.chartType === ct.value ? 'border-[#379890] bg-[#379890]/10 text-[#2c7f78]' : 'border-[#143230]/10 bg-card text-muted-foreground hover:border-[#379890]/20'}`}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/5">
                            {CHART_SVG[ct.value]}
                          </div>
                          <span className="text-[11px] font-black">{ct.label}</span>
                          <span className="text-[9px] text-center leading-tight opacity-70">{CHART_HINTS[ct.value]}</span>
                        </button>
                      ))}
                    </div>

                    {/* Aviso: Metrica com periodo configurado */}
                    {form.chartType === 'metric' && (form.dateColumn || form.timeBucket !== 'none') && (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">⚠ Metrica soma tudo em um numero so</p>
                        <p className="mt-1 text-[10px] text-amber-800 leading-relaxed">
                          Com o tipo <strong>Metrica</strong>, o periodo e o agrupamento sao ignorados — o resultado e sempre um unico numero total.
                        </p>
                        <p className="mt-1.5 text-[10px] text-amber-700 leading-relaxed">
                          Para ver <strong>por mes</strong>: troque para <strong>Barras</strong> → Eixo = coluna de data → Agrupamento = Por mes.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleChartTypeChange('bar')}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-800 transition-all hover:bg-amber-200"
                        >
                          Trocar para Barras agora
                        </button>
                      </div>
                    )}

                    {/* Sugestao: titulo tem "mensal" mas tipo e metrica */}
                    {form.chartType === 'metric' && /mensal|por mes|por mês|evolucao|evolução|trend/i.test(form.title) && (
                      <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-700">💡 Titulo sugere grafico temporal</p>
                        <p className="mt-1 text-[10px] text-blue-800 leading-relaxed">
                          O titulo parece pedir uma serie por periodo. Use <strong>Barras</strong> ou <strong>Linha</strong> com Eixo = coluna de data e Agrupamento = Por mes.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleChartTypeChange('bar')}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-blue-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-800 transition-all hover:bg-blue-200"
                        >
                          Trocar para Barras
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Calculo</label>
                    <select value={form.aggregation} onChange={(e) => handleAggregationChange(e.target.value as AggregationType)} className="mt-2 w-full rounded-2xl border border-[#143230]/10 bg-card px-4 py-3 text-sm outline-none">
                      {AGGREGATIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>

                  {form.aggregation !== 'none' && (
                    <div className="mt-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Eixo ou categoria</label>
                      <div className="mt-2">
                        <ColumnPicker
                          columns={columns}
                          table={form.table}
                          value={form.xColumn}
                          onChange={(col) => {
                            const colType = columns.find((c) => c.name === col)?.type ?? '';
                            setForm((f) => ({ ...f, xColumn: col, numericBucketSize: isNumericColumn(colType) ? 100 : 0 }));
                          }}
                          placeholder="Sem agrupamento (gera card de metrica)"
                          nullLabel="Sem agrupamento (gera card de metrica)"
                        />
                      </div>
                      {form.xColumn && isNumericColumn(columns.find((c) => c.name === form.xColumn)?.type ?? '') && (
                        <div className="mt-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Agrupar em faixas de valor</label>
                          <select
                            value={form.numericBucketSize}
                            onChange={(e) => setForm((f) => ({ ...f, numericBucketSize: Number(e.target.value) }))}
                            className="mt-2 w-full rounded-2xl border border-[#143230]/10 bg-card px-4 py-3 text-sm outline-none"
                          >
                            <option value={0}>Valor exato (sem faixas)</option>
                            <option value={50}>Faixas de 50</option>
                            <option value={100}>Faixas de 100</option>
                            <option value={500}>Faixas de 500</option>
                            <option value={1000}>Faixas de 1.000</option>
                            <option value={5000}>Faixas de 5.000</option>
                            <option value={10000}>Faixas de 10.000</option>
                          </select>
                          {form.numericBucketSize > 0 && (
                            <p className="mt-1.5 text-[10px] text-muted-foreground leading-relaxed">
                              O eixo vai mostrar intervalos como &ldquo;0 – {form.numericBucketSize - 1}&rdquo;, &ldquo;{form.numericBucketSize} – {form.numericBucketSize * 2 - 1}&rdquo;…
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {['count_distinct', 'sum', 'avg', 'min', 'max'].includes(form.aggregation) && (
                    <div className="mt-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {form.aggregation === 'count_distinct' ? 'Coluna para contagem unica' : 'Coluna numerica'}
                      </label>
                      <div className="mt-2">
                        <ColumnPicker
                          columns={columns}
                          table={form.table}
                          value={form.metric}
                          onChange={(col) => setForm((f) => ({ ...f, metric: col }))}
                          placeholder={form.aggregation === 'count_distinct' ? 'Selecione a coluna para contar unicos' : 'Selecione a coluna de valor'}
                          nullLabel={form.aggregation === 'count_distinct' ? 'Selecione a coluna para contar unicos' : 'Selecione a coluna de valor'}
                          filterType={form.aggregation === 'count_distinct' ? undefined : 'numeric'}
                        />
                      </div>
                      {/* Aviso: SUM/AVG sem coluna → cai silenciosamente em COUNT */}
                      {['sum', 'avg', 'min', 'max'].includes(form.aggregation) && !form.metric && (
                        <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5">
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-red-700">⚠ Coluna numerica obrigatoria</p>
                          <p className="mt-1 text-[10px] text-red-800 leading-relaxed">
                            <strong>{form.aggregation.toUpperCase()}</strong> sem coluna vai usar <strong>COUNT(*)</strong> como fallback — o resultado sera uma contagem, nao uma soma/media. Selecione a coluna de valor acima.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Agrupamento temporal</label><select value={form.timeBucket} onChange={(e) => setForm((f) => ({ ...f, timeBucket: e.target.value as TimeBucket }))} className="mt-2 w-full rounded-2xl border border-[#143230]/10 bg-card px-4 py-3 text-sm outline-none">{TIME_BUCKETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select></div>
                </div>
                <div className="rounded-[24px] border border-[#143230]/8 bg-card p-4">
                  <div className="flex items-center gap-2"><CalendarRange className="h-4 w-4 text-[#379890]" /><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recorte</p></div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filtro de negocio 1</label>
                      <div className="mt-2">
                        <ColumnPicker
                          columns={columns}
                          table={form.table}
                          value={form.filterColumn}
                          onChange={(col) => {
                            const colInfo = columns.find((c) => c.name === col);
                            const isTextDim = col && colInfo && !isNumericColumnType(colInfo.type) && !isTemporalColumnName(col);
                            setForm((f) => ({
                              ...f,
                              filterColumn: col,
                              filterOperator: isTextDim ? 'contains' : 'eq',
                              filterValue: '',
                            }));
                          }}
                          placeholder="Sem filtro"
                          nullLabel="Sem filtro"
                        />
                      </div>
                    </div>
                    {form.filterColumn && (
                      <>
                        <div><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operador 1</label><select value={form.filterOperator} onChange={(e) => setForm((f) => ({ ...f, filterOperator: e.target.value as FilterOperator }))} className="mt-2 w-full rounded-2xl border border-[#143230]/10 bg-card px-4 py-3 text-sm outline-none">{FILTER_OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}</select></div>
                        <div><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor 1</label><input type="text" value={form.filterValue} onChange={(e) => setForm((f) => ({ ...f, filterValue: e.target.value }))} placeholder="Ex: NOC" className="mt-2 w-full rounded-2xl border border-[#143230]/10 bg-card px-4 py-3 text-sm outline-none focus:border-[#379890]/50" /></div>
                      </>
                    )}

                    {form.filterColumn && (
                      <div className="col-span-2 mt-1">
                        {!form.filter2Column ? (
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, filter2Column: '' }))}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#379890]/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#379890]/70 transition-all hover:border-[#379890]/60 hover:text-[#379890]"
                          >
                            <Plus className="h-3 w-3" /> Adicionar filtro 2
                          </button>
                        ) : (
                          <>
                            <div className="mb-3">
                              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filtro de negocio 2</label>
                              <div className="mt-2">
                                <ColumnPicker
                                  columns={columns}
                                  table={form.table}
                                  value={form.filter2Column}
                                  onChange={(col) => {
                                    const colInfo = columns.find((c) => c.name === col);
                                    const isTextDim = col && colInfo && !isNumericColumnType(colInfo.type) && !isTemporalColumnName(col);
                                    setForm((f) => ({
                                      ...f,
                                      filter2Column: col,
                                      filter2Operator: isTextDim ? 'contains' : 'eq',
                                      filter2Value: '',
                                    }));
                                  }}
                                  placeholder="Sem filtro"
                                  nullLabel="Remover filtro 2"
                                />
                              </div>
                            </div>
                            {form.filter2Column && (
                              <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operador 2</label><select value={form.filter2Operator} onChange={(e) => setForm((f) => ({ ...f, filter2Operator: e.target.value as FilterOperator }))} className="mt-2 w-full rounded-2xl border border-[#143230]/10 bg-card px-4 py-3 text-sm outline-none">{FILTER_OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}</select></div>
                                <div><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor 2</label><input type="text" value={form.filter2Value} onChange={(e) => setForm((f) => ({ ...f, filter2Value: e.target.value }))} placeholder="Ex: ativo" className="mt-2 w-full rounded-2xl border border-[#143230]/10 bg-card px-4 py-3 text-sm outline-none focus:border-[#379890]/50" /></div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    <div className="col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Coluna de periodo</label>
                      <div className="mt-2">
                        <ColumnPicker
                          columns={columns}
                          table={form.table}
                          value={form.dateColumn}
                          onChange={(col) => setForm((f) => ({ ...f, dateColumn: col }))}
                          placeholder="Sem recorte por periodo"
                          nullLabel="Sem recorte por periodo"
                          filterType="temporal"
                        />
                      </div>
                    </div>
                    <div><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data inicial</label><input type="date" value={form.dateFrom} onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#143230]/10 bg-card px-4 py-3 text-sm outline-none focus:border-[#379890]/50" /></div>
                    <div><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data final</label><input type="date" value={form.dateTo} onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))} className="mt-2 w-full rounded-2xl border border-[#143230]/10 bg-card px-4 py-3 text-sm outline-none focus:border-[#379890]/50" /></div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-[#143230]/8 bg-card p-4">
                  <div><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Limite de linhas: <span className="text-[#143230]">{form.limit}</span></label><input type="range" min={5} max={100} step={5} value={form.limit} onChange={(e) => setForm((f) => ({ ...f, limit: Number(e.target.value) }))} className="mt-2 w-full accent-[#379890]" /></div>
                  <div className="mt-4"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cor</label><div className="mt-2 flex flex-wrap gap-2">{WIDGET_COLORS.map((c) => <button key={c} onClick={() => setForm((f) => ({ ...f, color: c }))} className={`h-8 w-8 rounded-xl border border-white/60 transition-all ${form.color === c ? 'scale-110 ring-2 ring-[#143230] ring-offset-2 ring-offset-[#f7f8f4]' : 'hover:scale-110'}`} style={{ background: c }} />)}</div></div>
                </div>
              </div>
              <div className="border-t border-[#143230]/8 bg-card/80 px-6 py-5 space-y-4">
                {/* Seletor de tamanho */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tamanho do widget</label>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {([
                      { value: 'sm' as WidgetSize, label: 'P', hint: 'Compacto' },
                      { value: 'md' as WidgetSize, label: 'M', hint: 'Padrão' },
                      { value: 'lg' as WidgetSize, label: 'G', hint: '2 colunas' },
                      { value: 'full' as WidgetSize, label: 'Full', hint: 'Largura total' },
                    ] as const).map((sz) => (
                      <button
                        key={sz.value}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, size: sz.value }))}
                        className={`flex flex-col items-center rounded-2xl border py-2 px-1 text-[10px] font-black transition-all ${
                          form.size === sz.value
                            ? 'border-[#379890] bg-[#379890]/10 text-[#2c7f78]'
                            : 'border-[#143230]/10 bg-card text-muted-foreground hover:border-[#379890]/20'
                        }`}
                      >
                        <span className="text-sm font-black">{sz.label}</span>
                        <span className="mt-0.5 text-[9px] leading-tight opacity-70 text-center">{sz.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={addWidget} disabled={!form.title || !form.table} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#379890] text-[10px] font-black uppercase tracking-widest text-white shadow-[0_18px_36px_-18px_rgba(55,152,144,0.45)] transition-all hover:scale-105 active:scale-95 disabled:opacity-40">
                  <Plus className="w-4 h-4" /> {editingWidgetId ? 'Salvar alteracoes' : 'Adicionar ao Dashboard'}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
