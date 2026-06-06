'use client';

import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, Legend, Tooltip, XAxis, YAxis,
  ResponsiveContainer, CartesianGrid, ReferenceLine, LabelList,
} from 'recharts';
import type { ChartType, CsatBreakdown } from '@/shared/types/dashboard';

const COLORS = ['#379890', '#3f7d78', '#5b90c7', '#6aa84f', '#d4a23a', '#bf6f8d', '#7ab8b1', '#8f7edc'];
const GOOD = '#2f9e6f'; // verde — acima/na meta
const BAD = '#d4574e';  // vermelho — abaixo da meta

type DataPoint = { label: string; value: number } & CsatBreakdown;

type Props = {
  chartType: ChartType;
  data: DataPoint[];
  rawRows?: Array<Record<string, unknown>>;
  rawColumns?: string[];
  color?: string;
  height?: number;
  /** Unidade do valor; '%' ativa o modo CSAT (meta, rótulos, tooltip rico). */
  valueUnit?: string;
  /** Linha de meta (ex: 80 para CSAT). */
  meta?: number;
};

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    notation: Math.abs(value) >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatAxisLabel(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-');
    return `${month}/${year}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year.slice(2)}`;
  }
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

// Componente estático (fora do render) — recharts injeta active/payload/label;
// valueUnit/meta são passados explicitamente onde o <Tooltip> é declarado.
function ChartTooltip({ active, payload, label, valueUnit = '', meta }: {
  active?: boolean;
  payload?: Array<{ value: number; payload?: DataPoint }>;
  label?: string;
  valueUnit?: string;
  meta?: number;
}) {
  if (!active || !payload?.length) return null;
  const isPct = valueUnit === '%';
  const value = payload[0].value;
  const p = payload[0].payload;
  const hasBreakdown = p && p.base != null;
  return (
    <div className="rounded-xl border border-[#143230]/8 bg-card px-4 py-2.5 text-xs shadow-2xl">
      <p className="font-black text-muted-foreground">{label ? formatAxisLabel(label) : ''}</p>
      <p className="mt-0.5 font-mono text-base font-black" style={{ color: meta != null ? (value >= meta ? GOOD : BAD) : '#379890' }}>
        {isPct ? fmtPct(value) : value.toLocaleString('pt-BR')}
      </p>
      {hasBreakdown && (
        <div className="mt-1.5 space-y-0.5 border-t border-[#143230]/6 pt-1.5 text-[11px]">
          <p className="text-muted-foreground"><span className="font-black">{p!.base!.toLocaleString('pt-BR')}</span> pesquisas válidas</p>
          <p className="text-[#2f9e6f]">▲ {(p!.promotores ?? 0).toLocaleString('pt-BR')} promotores</p>
          <p className="text-muted-foreground">● {(p!.neutros ?? 0).toLocaleString('pt-BR')} neutros</p>
          <p className="text-[#d4574e]">▼ {(p!.detratores ?? 0).toLocaleString('pt-BR')} detratores</p>
          {meta != null && (
            <p className="pt-0.5 text-muted-foreground">Meta {meta}% — {value >= meta ? 'atingida' : `faltam ${fmtPct(meta - value)}`}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function WidgetChart({ chartType, data, rawRows, rawColumns, color, height = 220, valueUnit = '', meta }: Props) {
  const primaryColor = color || '#379890';
  const tickStyle = { fill: '#617472', fontSize: 10, fontWeight: 700 };
  const isPct = valueUnit === '%';
  const tooltip = <ChartTooltip valueUnit={valueUnit} meta={meta} />;
  // Eixo Y em %: domínio fixo 0–100 com folga, formatador com sufixo.
  const yTickFormatter = isPct ? (v: number) => `${v}%` : formatCompactNumber;
  const yDomain: [number, number] | undefined = isPct ? [0, 100] : undefined;
  const colorByMeta = (v: number) => (meta != null ? (v >= meta ? GOOD : BAD) : primaryColor);

  if (chartType === 'metric') {
    const point = data.length === 1 ? data[0] : undefined;
    const total = point ? point.value : data.reduce((acc, d) => acc + d.value, 0);
    const valueColor = meta != null ? (total >= meta ? GOOD : BAD) : '#379890';
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5 py-6">
        <p className="text-5xl font-black" style={{ color: valueColor }}>
          {isPct ? fmtPct(total) : total.toLocaleString('pt-BR')}
        </p>
        {point?.base != null ? (
          <>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {point.base.toLocaleString('pt-BR')} pesquisas válidas
            </p>
            <div className="mt-1 flex items-center gap-3 text-[11px] font-bold">
              <span className="text-[#2f9e6f]">▲ {(point.promotores ?? 0).toLocaleString('pt-BR')}</span>
              <span className="text-muted-foreground">● {(point.neutros ?? 0).toLocaleString('pt-BR')}</span>
              <span className="text-[#d4574e]">▼ {(point.detratores ?? 0).toLocaleString('pt-BR')}</span>
            </div>
            {meta != null && (
              <p className="mt-1 text-[10px] font-black uppercase tracking-widest" style={{ color: valueColor }}>
                Meta {meta}% · {total >= meta ? 'atingida' : `${fmtPct(meta - total)} abaixo`}
              </p>
            )}
          </>
        ) : (
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {data.length === 1 ? 'resultado' : `${data.length} series somadas`}
          </p>
        )}
      </div>
    );
  }

  if (chartType === 'table') {
    const cols = rawColumns ?? (data.length > 0 ? ['label', 'value'] : []);
    const rows = rawRows ?? data.map((d) => ({ label: d.label, value: d.value }));

    if (cols.length === 0) {
      return <p className="py-8 text-center text-xs text-muted-foreground">Sem dados</p>;
    }

    return (
      <div className="max-h-[220px] overflow-auto rounded-xl border border-[#143230]/8 bg-card">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-[#f5f7f3]">
            <tr>
              {cols.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-black uppercase tracking-wider text-muted-foreground">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-[#143230]/6 hover:bg-[#f6faf8]">
                {cols.map((col) => (
                  <td key={col} className="max-w-[140px] truncate px-3 py-2 text-foreground">
                    {String((row as Record<string, unknown>)[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={70}
            label={({ label, percent }) => `${label}: ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={tooltip} />
          <Legend formatter={(value) => <span style={{ color: '#617472', fontSize: 10, fontWeight: 700 }}>{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 18, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,50,48,0.08)" />
          <XAxis dataKey="label" tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={formatAxisLabel} />
          <YAxis tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={yTickFormatter} domain={yDomain} width={isPct ? 40 : 48} />
          <Tooltip content={tooltip} cursor={{ fill: 'rgba(20,50,48,0.04)' }} />
          {meta != null && (
            <ReferenceLine y={meta} stroke="#d4a23a" strokeDasharray="5 4" strokeWidth={1.5}
              label={{ value: `Meta ${meta}%`, position: 'right', fill: '#b8881f', fontSize: 9, fontWeight: 700 }} />
          )}
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={colorByMeta(d.value)} />)}
            {isPct && <LabelList dataKey="value" position="top" formatter={(v: number) => fmtPct(v)} style={{ fill: '#617472', fontSize: 9, fontWeight: 700 }} />}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 18, right: 12, left: 8, bottom: 4 }}>
          <defs>
            <linearGradient id={`areaGrad-${primaryColor}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primaryColor} stopOpacity={0.28} />
              <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,50,48,0.08)" />
          <XAxis dataKey="label" tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={formatAxisLabel} />
          <YAxis tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={yTickFormatter} domain={yDomain} width={isPct ? 40 : 48} />
          <Tooltip content={tooltip} />
          {meta != null && (
            <ReferenceLine y={meta} stroke="#d4a23a" strokeDasharray="5 4" strokeWidth={1.5}
              label={{ value: `Meta ${meta}%`, position: 'right', fill: '#b8881f', fontSize: 9, fontWeight: 700 }} />
          )}
          <Area type="monotone" dataKey="value" stroke={primaryColor} fill={`url(#areaGrad-${primaryColor})`} strokeWidth={2}
            dot={isPct ? (props) => <DotByMeta {...props} meta={meta} /> : { r: 3, fill: primaryColor }}>
            {isPct && <LabelList dataKey="value" position="top" formatter={(v: number) => fmtPct(v)} style={{ fill: '#617472', fontSize: 9, fontWeight: 700 }} />}
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 18, right: 12, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(20,50,48,0.08)" />
        <XAxis dataKey="label" tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={formatAxisLabel} />
        <YAxis tick={tickStyle} tickLine={false} axisLine={false} tickFormatter={yTickFormatter} domain={yDomain} width={isPct ? 40 : 48} />
        <Tooltip content={tooltip} />
        {meta != null && (
          <ReferenceLine y={meta} stroke="#d4a23a" strokeDasharray="5 4" strokeWidth={1.5}
            label={{ value: `Meta ${meta}%`, position: 'right', fill: '#b8881f', fontSize: 9, fontWeight: 700 }} />
        )}
        <Line type="monotone" dataKey="value" stroke={primaryColor} strokeWidth={2.5}
          dot={isPct ? (props) => <DotByMeta {...props} meta={meta} /> : { r: 3, fill: primaryColor }}
          activeDot={{ r: 5 }}>
          {isPct && <LabelList dataKey="value" position="top" formatter={(v: number) => fmtPct(v)} style={{ fill: '#617472', fontSize: 9, fontWeight: 700 }} />}
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}

// Ponto colorido conforme a meta (verde ≥ meta, vermelho < meta).
function DotByMeta(props: { cx?: number; cy?: number; value?: number; meta?: number }) {
  const { cx, cy, value, meta } = props;
  if (cx == null || cy == null) return <g />;
  const fill = meta != null && value != null ? (value >= meta ? GOOD : BAD) : '#379890';
  return <circle cx={cx} cy={cy} r={4} fill={fill} stroke="#fff" strokeWidth={1.5} />;
}
