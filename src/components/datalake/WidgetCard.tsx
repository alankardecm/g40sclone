'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RefreshCcw, X, GripVertical, AlertCircle, TriangleAlert, Maximize2 } from 'lucide-react';
import type { WidgetConfig, QueryResult } from '@/shared/types/dashboard';
import WidgetChart from './WidgetChart';
import { getColumnSemantic, getTableSemantic } from '@/lib/datalake-semantics';

const CHART_ICONS: Record<string, string> = {
  bar: 'BA', line: 'LI', area: 'AR', pie: 'PI', metric: 'ME', table: 'TB',
};

type Props = {
  widget: WidgetConfig;
  onRemove: (id: string) => void;
  onInspect?: (widget: WidgetConfig) => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  viewMode?: boolean;
};

export default function WidgetCard({ widget, onRemove, onInspect, isDragging, dragHandleProps, viewMode = false }: Props) {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/datalake/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: widget.table,
          xColumn: widget.xColumn,
          metric: widget.metric,
          aggregation: widget.aggregation,
          limit: widget.limit,
          filterColumn: widget.filterColumn,
          filterOperator: widget.filterOperator,
          filterValue: widget.filterValue,
          filter2Column: widget.filter2Column,
          filter2Operator: widget.filter2Operator,
          filter2Value: widget.filter2Value,
          dateColumn: widget.dateColumn,
          dateFrom: widget.dateFrom,
          dateTo: widget.dateTo,
          timeBucket: widget.timeBucket,
          numericBucketSize: widget.numericBucketSize,
        }),
      });
      const data = (await response.json()) as QueryResult;
      setResult(data);
      setLastFetched(new Date().toLocaleTimeString('pt-BR'));
    } finally {
      setLoading(false);
    }
  }, [widget]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Calcula a altura do chart baseado no size — full/table = maior
  const chartMinHeight = widget.size === 'full' && widget.chartType === 'table'
    ? 'min-h-[360px]'
    : widget.size === 'lg'
    ? 'min-h-[260px]'
    : 'min-h-[200px]';

  // Cor do widget para o gradiente de topo
  const accentColor = widget.color ?? '#379890';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: isDragging ? 0.5 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={() => !viewMode && onInspect?.(widget)}
      className={`flex flex-col overflow-hidden rounded-[24px] border bg-white/95 shadow-[0_20px_50px_-34px_rgba(20,50,48,0.28)] transition-shadow ${
        isDragging ? 'ring-1 ring-[#379890]/30 shadow-2xl shadow-[#379890]/20' : ''
      } ${viewMode ? 'border-[#143230]/6' : 'border-[#143230]/8'}`}
    >
      {/* Linha de gradiente colorida no topo */}
      <div
        className="h-[3px] w-full shrink-0"
        style={{ background: `linear-gradient(90deg, ${accentColor}cc 0%, ${accentColor}22 100%)` }}
      />

      <div className={`flex items-start gap-3 border-b border-[#143230]/6 px-5 py-4 ${viewMode ? 'bg-white' : 'bg-[#f9faf7]'}`}>
        {/* Drag handle — edit mode apenas */}
        {!viewMode && (
          <div
            {...dragHandleProps}
            onClick={(event) => event.stopPropagation()}
            className="cursor-grab shrink-0 text-stone-400 transition-colors hover:text-[#143230] active:cursor-grabbing mt-0.5"
            title="Arrastar"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[10px] font-black"
          style={{ background: `${accentColor}18`, color: accentColor }}
        >
          {CHART_ICONS[widget.chartType] ?? 'BA'}
        </div>

        <div className="min-w-0 flex-1">
          {/* Título mais proeminente no view mode */}
          <p className={`truncate font-black text-[#143230] ${viewMode ? 'text-base' : 'text-sm'}`}>
            {widget.title}
          </p>
          <p className="truncate text-[10px] font-black uppercase tracking-[0.15em] text-stone-500 mt-0.5">
            {getTableSemantic(widget.table).label}
            {widget.xColumn ? ` · ${getColumnSemantic(widget.table, widget.xColumn).label}` : ' · card de metrica'}
            {widget.filterColumn && widget.filterValue ? ` · ${getColumnSemantic(widget.table, widget.filterColumn).label}: ${widget.filterValue}` : ''}
          </p>
          {!viewMode && (
            <>
              <p className="truncate font-mono text-[9px] text-stone-400">
                {widget.table}
                {widget.xColumn ? ` · ${widget.xColumn}` : ''}
                {widget.dateColumn ? ` · periodo: ${widget.dateColumn}` : ''}
              </p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#379890]">
                Clique para ver a montagem
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={(event) => {
              event.stopPropagation();
              void fetchData();
            }}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-500 transition-all hover:bg-[#379890]/10 hover:text-[#379890]"
            title="Atualizar"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {viewMode ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onInspect?.(widget);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-400 transition-all hover:bg-[#379890]/10 hover:text-[#379890]"
              title="Expandir"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onRemove(widget.id);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-500 transition-all hover:bg-red-400/10 hover:text-red-500"
              title="Remover"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className={`${chartMinHeight} flex-1 p-4`}>
        {loading ? (
          <div className="flex h-full items-center justify-center gap-3 text-stone-500">
            <RefreshCcw className="h-4 w-4 animate-spin" />
            <span className="text-xs">Carregando dados...</span>
          </div>
        ) : result?.error ? (
          <div className="flex h-full items-center gap-3 text-red-500">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="text-xs">{result.error}</p>
          </div>
        ) : !result?.ok ? (
          <div className="flex h-full items-center justify-center text-xs text-stone-500">
            Sem dados disponiveis
          </div>
        ) : (
          <>
            {result.configWarning && (
              <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 flex gap-2">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-red-500 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-red-700">Configuracao incorreta</p>
                  <p className="mt-1 text-[10px] text-red-800 leading-relaxed">{result.configWarning}</p>
                </div>
              </div>
            )}
            <WidgetChart
              chartType={widget.chartType}
              data={result.data}
              rawRows={result.rawRows}
              rawColumns={result.rawColumns}
              color={widget.color}
              valueUnit={widget.aggregation === 'csat' ? '%' : ''}
              meta={widget.aggregation === 'csat' ? 80 : undefined}
            />
            {result.filterWarning && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 flex gap-2">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">
                    Filtro sem match — tente &ldquo;Contém&rdquo;
                  </p>
                  <p className="mt-1 text-[10px] text-amber-800 leading-relaxed">
                    <span className="font-mono">{result.filterWarning.column} = &ldquo;{result.filterWarning.value}&rdquo;</span>{' '}
                    nao encontrou registros. Edite o widget e mude o operador para <span className="font-black">Contém</span>.
                  </p>
                  <p className="mt-1.5 text-[10px] text-amber-700 leading-relaxed">
                    Valores na coluna:{' '}
                    {result.filterWarning.existingValues.slice(0, 6).map((v, i) => (
                      <span key={i} className="font-mono bg-amber-100 rounded px-1">
                        {i > 0 ? ' ' : ''}{v}
                      </span>
                    ))}
                    {result.filterWarning.existingValues.length > 6 && <span className="text-amber-600"> +{result.filterWarning.existingValues.length - 6} mais</span>}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {lastFetched && (
        <div className="border-t border-[#143230]/6 bg-[#f9faf7] px-5 py-2">
          <p className="font-mono text-[9px] text-stone-500">Atualizado as {lastFetched}</p>
        </div>
      )}
    </motion.div>
  );
}
