'use client';

import Sidebar from '@/components/Sidebar';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeekData, WeeklyProtocolsResponse } from '@/app/api/datalake/weekly-protocols/route';

// ── Constantes ─────────────────────────────────────────────────────────────────

// Dom → Sáb (ordem natural da semana)
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

// ── Tipos ──────────────────────────────────────────────────────────────────────

type ChartPoint = { day: string; total: number; anomaly: boolean };

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildWeekPoints(week: WeekData, anomalies: Record<string, boolean>, isCurrent: boolean): ChartPoint[] {
  return DAY_LABELS.map((day) => ({
    day,
    total: week.days[day as keyof typeof week.days] ?? 0,
    anomaly: isCurrent && !!anomalies[day],
  }));
}

// ── Tooltip customizado ────────────────────────────────────────────────────────

type TooltipProps = {
  active?: boolean;
  label?: string;
  payload?: Array<{ value: number }>;
  anomalies: Record<string, boolean>;
  isCurrent: boolean;
};

function WeekTooltip({ active, label, payload, anomalies, isCurrent }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const val = payload[0].value;
  const isAnomaly = isCurrent && anomalies[label];

  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-stone-700">{label}</p>
      <p className="text-stone-500 mt-0.5">
        {val} protocolo{val !== 1 ? 's' : ''}
      </p>
      {isAnomaly && (
        <p className="text-red-500 font-semibold mt-1">↑ +20% acima da média</p>
      )}
    </div>
  );
}

// ── Card de semana ─────────────────────────────────────────────────────────────

type WeekCardProps = {
  week: WeekData;
  anomalies: Record<string, boolean>;
  index: number;
};

function WeekCard({ week, anomalies, index }: WeekCardProps) {
  const points = buildWeekPoints(week, anomalies, week.isCurrent);
  const total = points.reduce((s, p) => s + p.total, 0);
  const hasAnomaly = week.isCurrent && points.some((p) => p.anomaly);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07 }}
      className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${
        week.isCurrent
          ? 'border-[#8DC63F]/40 ring-1 ring-[#8DC63F]/20'
          : 'border-stone-200'
      }`}
    >
      {/* Cabeçalho do card */}
      <div className={`flex items-center justify-between px-5 py-3 border-b ${
        week.isCurrent ? 'border-[#8DC63F]/20 bg-[#8DC63F]/5' : 'border-stone-100 bg-stone-50'
      }`}>
        <div>
          <p className={`text-[11px] font-bold uppercase tracking-widest ${
            week.isCurrent ? 'text-[#8DC63F]' : 'text-stone-500'
          }`}>
            {week.label}
            {week.isCurrent && <span className="ml-2 normal-case tracking-normal font-semibold">(atual)</span>}
          </p>
          <p className="text-xs text-stone-400 mt-0.5">
            {total} protocolo{total !== 1 ? 's' : ''} no período
          </p>
        </div>
        {hasAnomaly && (
          <div className="flex items-center gap-1.5 rounded-full bg-red-50 border border-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-500">
            <AlertTriangle className="h-3 w-3" />
            Anomalia
          </div>
        )}
      </div>

      {/* Gráfico de barras */}
      <div className="px-3 pt-4 pb-3">
        {total === 0 ? (
          <div className="flex h-36 items-center justify-center text-xs text-stone-300">
            sem dados
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={points} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: '#a8a29e' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#d6d3d1' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={
                  <WeekTooltip
                    anomalies={anomalies}
                    isCurrent={week.isCurrent}
                  />
                }
                cursor={{ fill: '#f5f5f4' }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {points.map((p) => (
                  <Cell
                    key={p.day}
                    fill={
                      p.anomaly
                        ? '#ef4444'
                        : week.isCurrent
                        ? '#8DC63F'
                        : '#d6d3d1'
                    }
                    fillOpacity={week.isCurrent ? 1 : 0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function ProtocolosSemanalPage() {
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [equipes, setEquipes] = useState<string[]>([]);
  const [anomalies, setAnomalies] = useState<Record<string, boolean>>({});
  const [equipe, setEquipe] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (selectedEquipe: string) => {
    setLoading(true);
    setError('');
    try {
      const qs = selectedEquipe ? `?equipe=${encodeURIComponent(selectedEquipe)}` : '';
      const res = await fetch(`/api/datalake/weekly-protocols${qs}`);
      const data: WeeklyProtocolsResponse = await res.json();

      if (!data.ok || !data.weeks) {
        setError(data.error ?? 'Erro ao carregar dados.');
        return;
      }

      setWeeks(data.weeks);
      setEquipes(data.equipes ?? []);
      setAnomalies((data.anomalies as Record<string, boolean>) ?? {});
    } catch {
      setError('Falha na requisição.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(equipe);
  }, [fetchData, equipe]);

  const anomalyDays = Object.entries(anomalies).filter(([, v]) => v).map(([k]) => k);

  // Exibe semanas da mais recente para a mais antiga
  const weeksDesc = [...weeks].reverse();

  return (
    <div className="flex h-screen bg-stone-50">
      <Sidebar />

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8DC63F]/10">
              <TrendingUp className="h-5 w-5 text-[#8DC63F]" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-sm font-bold uppercase tracking-widest text-stone-800">
                Protocolos Semanais
              </h1>
              <p className="text-[11px] text-stone-400">
                Últimas 4 semanas · Dom → Sáb · anomalia &gt;20% acima da média
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#8DC63F]/40"
              value={equipe}
              onChange={(e) => setEquipe(e.target.value)}
            >
              <option value="">Todas as equipes</option>
              {equipes.map((eq) => (
                <option key={eq} value={eq}>{eq}</option>
              ))}
            </select>

            <button
              onClick={() => fetchData(equipe)}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 shadow-sm hover:bg-stone-50 disabled:opacity-40 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Banner de anomalia */}
          {anomalyDays.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3"
            >
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-700">
                  Volume anômalo na semana atual
                </p>
                <p className="text-xs text-red-500 mt-0.5">
                  Dias com +20% acima da média das semanas anteriores:{' '}
                  <strong>{anomalyDays.join(', ')}</strong>
                </p>
              </div>
            </motion.div>
          )}

          {/* Estado de carregamento / erro */}
          {loading && (
            <div className="flex h-48 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
            </div>
          )}

          {!loading && error && (
            <div className="flex h-48 items-center justify-center text-sm text-red-500">
              {error}
            </div>
          )}

          {!loading && !error && weeks.length === 0 && (
            <div className="flex h-48 items-center justify-center text-sm text-stone-400">
              Nenhum dado encontrado para o período.
            </div>
          )}

          {/* Grid de cards — semana atual primeiro */}
          {!loading && !error && weeksDesc.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {weeksDesc.map((week, idx) => (
                <WeekCard
                  key={week.weekKey}
                  week={week}
                  anomalies={anomalies}
                  index={idx}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
