'use client';

import { motion } from 'framer-motion';
import { Users, ShieldCheck, DollarSign } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

type ContractStatsRow = {
  valor?: string | number;
  situacao?: string;
};

const parseCurrency = (v: string | number | null | undefined) => {
  if (typeof v === 'number') return v;
  const s = String(v || '').trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { 
  style: 'currency', 
  currency: 'BRL', 
  notation: 'compact',
  maximumFractionDigits: 1 
}).format(v);

export default function KPICards() {
  const [stats, setStats] = useState({
    activeClients: 0,
    mrr: 0,
    churn: '1.2%',
    uptime: '99.9%'
  });

  useEffect(() => {
    async function loadStats() {
      let rows: ContractStatsRow[] = [];
      if (isSupabaseConfigured()) {
        const { data } = await supabase.from('contracts').select('valor, situacao');
        if (data) rows = data as ContractStatsRow[];
      } else {
        try {
          const response = await fetch('/api/datalake/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'crm_funter',
              aggregation: 'none',
              limit: 3000,
            }),
          });
          const payload = await response.json();
          if (payload.ok && payload.rawRows) {
            rows = payload.rawRows.map((row: any) => ({
              valor: row.valor,
              situacao: row.estagio === 'Normal' ? 'Ativo' : row.estagio,
            }));
          }
        } catch (err) {
          console.error('Erro ao consultar KPIs do Data Lake:', err);
        }
      }

      if (rows.length > 0) {
        const active = rows.filter(c => (c.situacao || '').toLowerCase() !== 'cancelado');
        const totalVal = active.reduce((s, c) => s + parseCurrency(c.valor), 0);
        setStats(prev => ({
          ...prev,
          activeClients: active.length,
          mrr: totalVal
        }));
      }
    }
    loadStats();
  }, []);

  const kpis = [
    {
      label: "Clientes Ativos",
      value: stats.activeClients.toLocaleString('pt-BR'),
      change: "+3.2%",
      icon: Users,
      bg: "bg-neon-cyan",
    },
    {
      label: "Receita Mensal (MRR)",
      value: fmt(stats.mrr),
      change: "+12.8%",
      icon: DollarSign,
      bg: "bg-neon-orange",
    },
    {
      label: "Disponibilidade Rede",
      value: stats.uptime,
      change: "Filtro: NOC",
      icon: ShieldCheck,
      bg: "bg-neon-pink",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: i * 0.1 }}
          className={`${kpi.bg} rounded-pill p-12 relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform active:scale-95 shadow-2xl`}
        >
          <div className="absolute top-8 right-8 w-16 h-16 rounded-[24px] bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform duration-500">
            <kpi.icon className="w-8 h-8 text-black/40" strokeWidth={3} />
          </div>
          
          <p className="text-xs font-black text-black/60 uppercase tracking-[0.2em] mb-2">
            {kpi.label}
          </p>
          <h3 className="text-5xl font-[1000] text-black tracking-[-0.06em] leading-none mb-4">
            {kpi.value}
          </h3>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-black/40 animate-pulse" />
            <p className="text-[10px] font-black text-black/50 uppercase tracking-widest">
              {kpi.change} • Real-time
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
