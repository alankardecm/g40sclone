'use client';

import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { 
  TrendingUp, Target, ChevronRight,
  ArrowUpRight, Sparkles, Filter
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { motion, AnimatePresence } from 'framer-motion';

type ContractRow = {
  cliente?: string;
  situacao?: string;
  valor?: string | number;
  cidade_do_cliente?: string;
  vendedor_1?: string;
  bairro?: string;
};

// ── Helpers ──────────────────────────────────────────────────────
function parseCurrency(value: string | number | null | undefined): number {
  const normalized = String(value || '').trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(v);
const fmtFull = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// ── Components ────────────────────────────────────────────────────
function KpiSmall({ label, val, trend, neg }: { label: string, val: string, trend: string, neg?: boolean }) {
  return (
    <div className="p-4 rounded-2xl glass border border-white/5 flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black">{val}</h3>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${neg ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
          {trend}
        </span>
      </div>
    </div>
  );
}

export default function CommercialDashboard() {
  const [data, setData] = useState<ContractRow[]>([]);
  const [explaining, setExplaining] = useState(false);

  useEffect(() => {
    async function load() {
      let res: ContractRow[] | null = null;
      if (isSupabaseConfigured()) {
        const { data: supabaseRes } = await supabase.from('contracts').select('*').limit(3000);
        res = supabaseRes;
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
            res = payload.rawRows.map((row: any) => ({
              cliente: row.cliente,
              situacao: row.estagio === 'Normal' ? 'Ativo' : row.estagio,
              valor: row.valor,
              cidade_do_cliente: row.cidade,
              vendedor_1: row.vendedor_1 || row.cod_vendedor,
              bairro: row.cidade,
            }));
          }
        } catch (err) {
          console.error('Erro ao consultar contratos do Data Lake:', err);
        }
      }
      if (res) setData(res);
    }
    load();
  }, []);

  const active = data.filter(c => (c.situacao || '').toLowerCase() !== 'cancelado');
  const totalVal = active.reduce((s, c) => s + parseCurrency(c.valor), 0);
  
  // Data for Chart (Revenue by City as proxy for time-series demo)
  const cityMap = new Map<string, number>();
  active.forEach(c => {
    const city = c.cidade_do_cliente || 'Outros';
    cityMap.set(city, (cityMap.get(city) || 0) + parseCurrency(c.valor));
  });
  const chartData = [...cityMap.entries()]
    .sort((a,b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  // Sellers ranking
  const sellerMap = new Map<string, number>();
  active.forEach(c => {
    const s = c.vendedor_1 || 'Sem Vendedor';
    sellerMap.set(s, (sellerMap.get(s) || 0) + parseCurrency(c.valor));
  });
  const sellers = [...sellerMap.entries()].sort((a,b) => b[1] - a[1]).slice(0, 6);
  const topSellerValue = sellers[0]?.[1] ?? 1;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-[#030303]">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-8 py-8">
        {/* Breadcrumb & Top Bar */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span className="hover:text-white cursor-pointer transition-colors">Painel Central</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white">Performance Comercial</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 rounded-xl glass border-white/5 text-xs font-semibold flex items-center gap-2 hover:bg-card/5 transition-all">
              <Filter className="w-3 h-3" /> Filtrar Período
            </button>
            <button 
              onClick={() => { setExplaining(true); setTimeout(() => setExplaining(false), 3000); }}
              className="px-4 py-2 rounded-xl border border-accent/20 bg-accent/10 text-accent text-xs font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(232,255,71,0.05)] hover:bg-accent/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" /> Explicar com IA
            </button>
          </div>
        </header>

        {/* Page Header */}
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tighter mb-1">Performance Comercial</h1>
            <p className="text-muted-foreground text-sm">Análise granular de receita, churn e produtividade da força de vendas.</p>
          </div>
          <div className="text-right">
             <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Total em Carteira</span>
             <h2 className="text-4xl font-black text-white">{fmt(totalVal)}</h2>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <KpiSmall label="Contratos Diretos" val={active.length.toLocaleString()} trend="+4.2%" />
          <KpiSmall label="Ticket Médio" val={fmt(active.length ? totalVal / active.length : 0)} trend="+R$ 1.2k" />
          <KpiSmall label="Taxa de Churn" val="1.8%" trend="-0.4%" neg />
          <KpiSmall label="Aprovação" val="92%" trend="Meta batida" />
        </div>

        {/* Main Chart Section */}
        <div className="grid grid-cols-3 gap-6 mb-8">
           {/* Revenue Area Chart */}
           <div className="col-span-2 glass rounded-3xl border border-white/5 p-8 relative">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-lg font-bold">Distribuição Geográfica de Receita</h3>
                  <p className="text-xs text-muted-foreground">Top cidades por volume de faturamento ativo</p>
                </div>
                <TrendingUp className="w-5 h-5 text-accent" />
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e8ff47" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#e8ff47" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" />
                    <XAxis 
                       dataKey="name" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fill: '#666', fontSize: 10, fontWeight: 600 }} 
                       dy={10}
                    />
                    <YAxis 
                       tickFormatter={fmt} 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fill: '#666', fontSize: 10, fontWeight: 600 }}
                    />
                    <Tooltip 
                       content={({ active, payload, label }) => {
                         if (active && payload?.length) {
                           return (
                             <div className="p-3 glass rounded-xl border border-white/10 shadow-2xl">
                               <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{label}</p>
                               <p className="text-sm font-black text-white">{fmtFull(Number(payload[0].value))}</p>
                             </div>
                           )
                         }
                         return null;
                       }}
                    />
                    <Area 
                       type="monotone" 
                       dataKey="value" 
                       stroke="#e8ff47" 
                       strokeWidth={3}
                       fillOpacity={1} 
                       fill="url(#colorVal)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
           </div>

           {/* Ranking de Vendedores */}
           <div className="glass rounded-3xl border border-white/5 p-8">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-lg font-bold">Liderança Comercial</h3>
                 <Target className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="space-y-6">
                {sellers.map((s, i) => (
                  <div key={i} className="group relative">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-xs font-semibold text-stone-300 group-hover:text-white transition-colors">{s[0]}</span>
                       <span className="text-xs font-black text-accent">{fmt(s[1])}</span>
                    </div>
                    <div className="h-1.5 w-full bg-card/[0.03] rounded-full overflow-hidden">
                       <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(s[1] / topSellerValue) * 100}%` }}
                          transition={{ duration: 1, delay: i * 0.1 }}
                          className="h-full bg-accent/40 group-hover:bg-accent transition-colors" 
                       />
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-10 py-3 rounded-xl border border-white/5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-white hover:bg-card/5 transition-all">
                Ver Ranking Completo
              </button>
           </div>
        </div>

        {/* AI Insight Placeholder */}
        <AnimatePresence>
          {explaining && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-8"
            >
              <div className="glass-accent p-6 rounded-3xl border border-accent/20 flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl grad-accent flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-accent mb-1 uppercase tracking-widest">Insight da Inteligência (RAG Ativa)</h4>
                  <p className="text-sm leading-relaxed text-stone-300">
                    Sua carteira em <span className="text-white font-bold">Campinas</span> cresceu 18% este mês, superando a média nacional. 
                    Cruzando com os manuais de &quot;Expansão de Rede V2&quot;, notei que as novas ativações no POP Centro 
                    estão com margem 12% acima do esperado. Recomendo focar a força de vendas de Curitiba no setor industrial conforme o procedimento ID-42.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Section: Recent Activities */}
        <div className="glass rounded-3xl border border-white/5 p-8 mb-12">
           <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6">Últimos Contratos Auditados</h3>
           <div className="space-y-1">
             {active.slice(0, 5).map((c, i) => (
               <div key={i} className="flex items-center justify-between p-4 rounded-2xl hover:bg-card/[0.02] transition-colors group">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-card/[0.03] flex items-center justify-center text-[10px] font-bold">
                       {c.cliente?.[0] || 'C'}
                    </div>
                    <div>
                       <p className="text-sm font-semibold">{c.cliente}</p>
                       <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">{c.vendedor_1} · {c.cidade_do_cliente}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-8">
                    <div className="text-right">
                       <p className="text-sm font-black">{fmtFull(parseCurrency(c.valor))}</p>
                       <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">Aprovado</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-foreground group-hover:text-accent transition-colors" />
                 </div>
               </div>
             ))}
           </div>
        </div>
      </main>
    </div>
  );
}
