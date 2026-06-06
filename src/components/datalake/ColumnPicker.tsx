'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { getColumnSemantic } from '@/lib/datalake-semantics';
import { isAnalyticMetricColumn, isNumericColumnType, isTemporalColumnName } from '@/lib/dashboard-widget-intelligence';

type ColumnInfo = { name: string; type: string };

interface ColumnPickerProps {
  columns: ColumnInfo[];
  table: string;
  value: string;
  onChange: (col: string) => void;
  placeholder?: string;
  filterType?: 'numeric' | 'temporal' | 'all';
  nullable?: boolean;
  nullLabel?: string;
  disabled?: boolean;
}

function isNumericCol(type: string) {
  return isNumericColumnType(type);
}

function isTemporalCol(name: string) {
  return isTemporalColumnName(name);
}

export default function ColumnPicker({
  columns,
  table,
  value,
  onChange,
  placeholder = 'Selecione uma coluna',
  filterType = 'all',
  nullable = true,
  nullLabel = 'Nenhum',
  disabled = false,
}: ColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const eligibleColumns = useMemo(() => {
    if (filterType === 'numeric') return columns.filter(isAnalyticMetricColumn);
    if (filterType === 'temporal') return columns.filter((c) => isTemporalCol(c.name));
    return columns;
  }, [columns, filterType]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return eligibleColumns;
    return eligibleColumns.filter((col) => {
      const sem = getColumnSemantic(table, col.name);
      return (
        col.name.toLowerCase().includes(needle) ||
        sem.label.toLowerCase().includes(needle) ||
        (sem.description || '').toLowerCase().includes(needle)
      );
    });
  }, [eligibleColumns, search, table]);

  const groups = useMemo(() => {
    const metricCols = filtered.filter((c) => isNumericCol(c.type));
    const temporalCols = filtered.filter((c) => !isNumericCol(c.type) && isTemporalCol(c.name));
    const dimCols = filtered.filter((c) => !isNumericCol(c.type) && !isTemporalCol(c.name));
    return [
      { key: 'metric', label: 'Métricas', accent: '#6aa84f', cols: metricCols },
      { key: 'dimension', label: 'Dimensões', accent: '#5b90c7', cols: dimCols },
      { key: 'temporal', label: 'Temporal', accent: '#d4a23a', cols: temporalCols },
    ].filter((g) => g.cols.length > 0);
  }, [filtered]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const selectedSemantic = value ? getColumnSemantic(table, value) : null;
  const selectedCol = value ? columns.find((c) => c.name === value) : null;
  const typeTag = selectedCol
    ? isNumericCol(selectedCol.type)
      ? 'num'
      : isTemporalCol(selectedCol.name)
        ? 'data'
        : 'texto'
    : null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={[
          'w-full rounded-2xl border px-4 py-3 text-sm text-left flex items-center justify-between gap-3 transition-all bg-card',
          open ? 'border-[#379890]/50 ring-1 ring-[#379890]/20' : 'border-[#143230]/10',
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:border-[#379890]/20',
        ].join(' ')}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {value ? (
            <>
              <span className="font-semibold text-[#143230] truncate">
                {selectedSemantic?.label || value}
              </span>
              {typeTag && (
                <span className="shrink-0 rounded-full bg-[#143230]/6 px-2 py-0.5 text-[10px] font-black uppercase text-muted-foreground">
                  {typeTag}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {value && nullable && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-[#143230]/8 hover:text-muted-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 right-0 rounded-2xl border border-[#143230]/10 bg-card shadow-[0_20px_50px_-16px_rgba(20,50,48,0.22)] overflow-hidden">
          <div className="border-b border-[#143230]/8 px-3 py-2.5 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar coluna..."
              className="w-full text-sm outline-none placeholder:text-muted-foreground bg-transparent"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {nullable && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                  setSearch('');
                }}
                className={[
                  'w-full px-4 py-2.5 text-left text-sm transition-colors border-b border-[#143230]/5',
                  !value
                    ? 'bg-[#379890]/8 text-[#2c7f78] font-bold'
                    : 'text-muted-foreground hover:bg-[#f7f8f4]',
                ].join(' ')}
              >
                {nullLabel}
              </button>
            )}

            {groups.map((group) => (
              <div key={group.key}>
                <div
                  className="sticky top-0 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest bg-[#f7f8f4]"
                  style={{ color: group.accent }}
                >
                  {group.label}
                </div>
                {group.cols.map((col) => {
                  const sem = getColumnSemantic(table, col.name);
                  const active = value === col.name;
                  const colType = isNumericCol(col.type)
                    ? 'num'
                    : isTemporalCol(col.name)
                      ? 'data'
                      : 'texto';
                  return (
                    <button
                      key={col.name}
                      type="button"
                      onClick={() => {
                        onChange(col.name);
                        setOpen(false);
                        setSearch('');
                      }}
                      className={[
                        'w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 transition-colors',
                        active ? 'bg-[#379890]/10' : 'hover:bg-[#f7f8f4]',
                      ].join(' ')}
                    >
                      <div className="min-w-0">
                        <p
                          className={`text-sm truncate ${active ? 'font-black text-[#2c7f78]' : 'font-semibold text-[#143230]'}`}
                        >
                          {sem.label}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground truncate">{col.name}</p>
                      </div>
                      <span
                        className={[
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase',
                          active
                            ? 'bg-[#379890]/20 text-[#2c7f78]'
                            : 'bg-[#143230]/6 text-muted-foreground',
                        ].join(' ')}
                      >
                        {colType}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}

            {groups.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma coluna encontrada
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
