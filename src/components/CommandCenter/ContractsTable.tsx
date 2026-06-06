'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ChevronRight, Filter } from 'lucide-react';

type ContractRow = {
  cliente?: string;
  bairro?: string;
  cidade_do_cliente?: string;
  situacao?: string;
  valor?: string | number;
};

const parseCurrency = (v: string | number | null | undefined) => {
  if (typeof v === 'number') return v;
  const s = String(v || '').trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const statusStyles: Record<string, string> = {
  Ativo: "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20",
  Pendente: "bg-neon-orange/10 text-neon-orange border border-neon-orange/20",
  Cancelado: "bg-neon-pink/10 text-neon-pink border border-neon-pink/20",
};

export default function ContractsTable() {
  const [data, setData] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      let res: ContractRow[] | null = null;
      if (isSupabaseConfigured()) {
        const { data: supabaseRes } = await supabase.from('contracts').select('*').limit(8);
        res = supabaseRes;
      } else {
        try {
          const response = await fetch('/api/datalake/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              table: 'crm_funter',
              aggregation: 'none',
              limit: 8,
            }),
          });
          const payload = await response.json();
          if (payload.ok && payload.rawRows) {
            res = payload.rawRows.map((row: any) => ({
              cliente: row.cliente,
              bairro: row.cidade || 'Unidades',
              cidade_do_cliente: row.cidade,
              situacao: row.estagio === 'Normal' ? 'Ativo' : row.estagio || 'Ativo',
              valor: row.valor,
            }));
          }
        } catch (err) {
          console.error('Erro ao consultar contratos recentes do Data Lake:', err);
        }
      }
      if (res) setData(res);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-card rounded-pill p-12 border border-white/5 shadow-2xl flex flex-col h-full"
    >
      <div className="flex items-center justify-between mb-10">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-black tracking-tighter text-foreground uppercase">Base Operacional</h2>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Contratos Recentes (Real-time)</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-background/50 border border-white/5 rounded-2xl px-6 py-3 text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 cursor-pointer hover:bg-card/5 transition-all">
            <Filter className="w-3.5 h-3.5" /> Filtrar
          </div>
          <div className="bg-background/50 border border-white/5 rounded-2xl px-6 py-3 text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 cursor-pointer hover:bg-card/5 transition-all">
            Ver Todos <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground border-b border-white/5">
              <th className="pb-6 pr-4">Cliente / Contrato</th>
              <th className="pb-6 pr-4">Cargo / Plano</th>
              <th className="pb-6 pr-4">Status</th>
              <th className="pb-6 text-right">Valor Mensal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {loading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={4} className="py-6 h-12 bg-card/5 rounded-[20px] mb-2" />
                </tr>
              ))
            ) : (
              data.map((c, i) => {
                const situacaoKey = c.situacao || 'Ativo';
                return (
                  <tr key={i} className="group hover:bg-card/[0.01] transition-all cursor-pointer">
                    <td className="py-7 pr-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-foreground group-hover:text-neon-cyan transition-colors line-clamp-1">{c.cliente}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mt-1">ID: #482{i}</span>
                      </div>
                    </td>
                    <td className="py-7 pr-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-muted-foreground">{c.bairro || 'Unidades'}</span>
                        <span className="text-[10px] font-black text-foreground uppercase tracking-widest mt-1">{c.cidade_do_cliente}</span>
                      </div>
                    </td>
                    <td className="py-7 pr-4">
                      <span className={`text-[9px] font-[1000] px-4 py-1.5 rounded-full uppercase tracking-widest ${statusStyles[situacaoKey] || statusStyles.Ativo}`}>
                        {situacaoKey}
                      </span>
                    </td>
                    <td className="py-7 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-black text-white">{fmt(parseCurrency(c.valor))}</span>
                        <span className="text-[9px] font-black text-neon-cyan/50 tracking-widest uppercase">Mes</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
