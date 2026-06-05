'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import { 
  AlertCircle, 
  CheckCircle, 
  Activity, 
  MessageSquare, 
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  ShieldAlert
} from 'lucide-react';
import { motion } from 'framer-motion';

type ZabbixSummary = {
  totalProblems: number;
  disasters: number;
  highSeverity: number;
  totalHosts: number;
  hostsDown: number;
};

type ZabbixProblem = {
  eventid: string;
  name: string;
  severity: string;
  clock: string;
  hosts?: { name: string }[];
};

type WaInsight = {
  sentiment: 'positive' | 'neutral' | 'negative';
  sentiment_score: number;
  urgent: number;
  negative: number;
};

type WaConversation = {
  group_id: string;
  group_name: string;
  count: number;
  last_text: string;
  last_at: string;
  negative_count: number;
};

type ProblemApiRow = {
  eventid: string;
  name: string;
  severity: string;
  clock: string;
  hosts?: { name: string }[];
};

type AlertSeverity = 'high' | 'medium';

type AlertItemProps = {
  severity: AlertSeverity;
  title: string;
  time: string;
  host?: string;
};

type SocialInsightProps = {
  sentiment?: 'positive' | 'neutral' | 'negative';
  group: string;
  summary: string;
  urgency: 'Alta' | 'Moderada';
};

type CorrelatedIncident = {
  zabbixProblem: ZabbixProblem;
  relatedMessages: {
    id: string;
    text: string;
    sender: string;
    timestamp: number;
    sentiment: string;
    urgency: string;
  }[];
  impactScore: number;
  matchReason: string;
};

export default function Noc360Dashboard() {
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [zabbixSummary, setZabbixSummary] = useState<ZabbixSummary | null>(null);
  const [problems, setProblems] = useState<ZabbixProblem[]>([]);
  const [waInsight, setWaInsight] = useState<WaInsight | null>(null);
  const [waConversations, setWaConversations] = useState<WaConversation[]>([]);
  const [correlations, setCorrelations] = useState<CorrelatedIncident[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [zSummaryRes, zProbsRes, waRes, corrRes] = await Promise.all([
        fetch('/api/zabbix?view=summary'),
        fetch('/api/zabbix?view=problems&limit=10'),
        fetch('/api/wa-monitor/insights?days=1'),
        fetch('/api/monitoring/correlation?lookback=240'),
      ]);

      const zSummaryData = await zSummaryRes.json();
      const zProbsData = await zProbsRes.json();
      const waData = await waRes.json();
      const corrData = await corrRes.json();

      if (zSummaryData.ok) setZabbixSummary(zSummaryData.summary);
      if (zProbsData.ok) {
        setProblems(
          ((zProbsData.problems || []) as ProblemApiRow[]).filter((problem) => Number(problem.severity) >= 4)
        );
      }
      
      if (waData.ok) {
        setWaInsight(waData.summary);
        setWaConversations(waData.conversations || []);
      }

      if (corrData.ok) {
        setCorrelations(corrData.incidents || []);
      }

      setLastSync(new Date());
    } catch {
      // Keep the previous snapshot on screen if the refresh fails.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(timer);
  }, [fetchData]);

  const healthScore = useMemo(() => {
    if (!zabbixSummary || !waInsight) return 100;

    let score = 100;
    
    // Penalize for Zabbix Problems
    score -= (zabbixSummary.disasters * 15);
    score -= (zabbixSummary.highSeverity * 5);
    score -= (zabbixSummary.hostsDown * 2);

    // Penalize for WhatsApp Negativity
    score -= (waInsight.urgent * 10);
    score -= (waInsight.negative * 1);

    return Math.max(0, Math.min(100, score));
  }, [zabbixSummary, waInsight]);

  const correlationInsight = useMemo(() => {
    if (!zabbixSummary || !waInsight) return null;
    
    const infraIssues = zabbixSummary.totalProblems > 0;
    const socialIssues = waInsight.negative > 5 || waInsight.urgent > 0;

    if (infraIssues && socialIssues) {
      return "ALERTA: Alta correlação detectada entre falhas de rede e insatisfação no WhatsApp.";
    }
    if (infraIssues && !socialIssues) {
      return "ESTÁVEL: Falhas técnicas detectadas, mas sem impacto perceptível no sentimento social ainda.";
    }
    if (!infraIssues && socialIssues) {
      return "ATENÇÃO: Reclamações no WhatsApp sem causa técnica aparente no Zabbix.";
    }
    return "IDEAL: Infraestrutura estável e sentimento social positivo.";
  }, [zabbixSummary, waInsight]);

  return (
    <div title="NOC 360 Correlated Dashboard" className="flex flex-1 min-h-0 overflow-hidden bg-slate-950 text-white font-sans antialiased">
      <Sidebar />

      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col p-8">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase">
              {process.env.NEXT_PUBLIC_APP_NAME || 'G4OS'} HUB | <span className="text-blue-400">NOC 360</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1 uppercase tracking-widest font-bold">
              Observabilidade Correlacionada (Infra + Social)
            </p>
          </div>

          <div className="flex items-center gap-4">
            {lastSync && (
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Sync: {lastSync.toLocaleTimeString()}
              </span>
            )}
            <button 
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUNA 1: INFRAESTRUTURA */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                <Activity size={20} className="text-blue-400" /> Infraestrutura
              </h2>
              <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">Zabbix Realtime</span>
            </div>

            <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 text-center">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Alertas Ativos</p>
                  <p className="text-2xl font-black">{zabbixSummary?.totalProblems ?? '--'}</p>
                </div>
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 text-center">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Hosts Down</p>
                  <p className={`text-2xl font-black ${zabbixSummary?.hostsDown ? 'text-red-500' : 'text-green-500'}`}>
                    {zabbixSummary?.hostsDown ?? '--'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase px-1">Incidentes Graves</p>
                {problems.length === 0 ? (
                  <div className="flex items-center gap-2 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-bold">
                    <CheckCircle size={16} /> Sem problemas graves detectados.
                  </div>
                ) : (
                  problems.map(p => (
                    <AlertItem 
                      key={p.eventid}
                      severity={p.severity === '5' ? 'high' : 'medium'}
                      title={p.name}
                      time={new Date(Number(p.clock) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      host={p.hosts?.[0]?.name}
                    />
                  ))
                )}
              </div>
            </div>
          </section>

          {/* COLUNA 2: INTELIGÊNCIA SOCIAL */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                <MessageSquare size={20} className="text-green-400" /> Inteligência Social
              </h2>
              <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold">WhatsApp Insights</span>
            </div>

            <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6">
               <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 text-center">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Negatividade</p>
                  <p className={`text-2xl font-black ${waInsight?.negative ? 'text-red-400' : 'text-green-400'}`}>
                    {waInsight?.negative ?? '--'}
                  </p>
                </div>
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50 text-center">
                  <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Urgências</p>
                  <p className={`text-2xl font-black ${waInsight?.urgent ? 'text-orange-400' : 'text-green-400'}`}>
                    {waInsight?.urgent ?? '--'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase px-1">Grupos sob Tensão</p>
                {waConversations.filter(c => c.negative_count > 0).length === 0 ? (
                  <div className="flex items-center gap-2 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-bold">
                    <CheckCircle size={16} /> Clima operacional positivo.
                  </div>
                ) : (
                  waConversations.filter(c => c.negative_count > 0).slice(0, 4).map(c => (
                    <SocialInsight 
                      key={c.group_id}
                      sentiment="negative"
                      group={c.group_name}
                      summary={c.last_text}
                      urgency={c.negative_count > 2 ? 'Alta' : 'Moderada'}
                    />
                  ))
                )}
              </div>
            </div>
          </section>

          {/* COLUNA 3: CORRELAÇÃO E SAÚDE */}
          <section className="space-y-6">
             <div className="flex items-center justify-between">
              <h2 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                <ShieldAlert size={20} className="text-blue-400" /> Saúde 360
              </h2>
            </div>

            <div className="bg-blue-600/5 rounded-3xl border border-blue-500/20 p-8 h-full">
              <div className="text-center mb-10">
                <div className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-4">Score de Saúde Geral</div>
                <div className="relative inline-block">
                  <svg className="w-48 h-48">
                    <circle 
                      cx="96" cy="96" r="80" 
                      fill="none" 
                      stroke="rgba(59, 130, 246, 0.1)" 
                      strokeWidth="12" 
                    />
                    <motion.circle 
                      cx="96" cy="96" r="80" 
                      fill="none" 
                      stroke={healthScore < 50 ? '#ef4444' : healthScore < 80 ? '#f59e0b' : '#3b82f6'} 
                      strokeWidth="12" 
                      strokeDasharray="502.6"
                      initial={{ strokeDashoffset: 502.6 }}
                      animate={{ strokeDashoffset: 502.6 - (502.6 * healthScore / 100) }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-black">{healthScore}%</span>
                    <span className="text-[10px] font-bold uppercase tracking-tighter opacity-60">Funcional</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-900/50 p-5 rounded-3xl border border-slate-800/50">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Impacto em Clientes (Correlacionado)</p>
                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">{correlations.length} incidentes</span>
                  </div>
                  
                  {correlations.length === 0 ? (
                    <p className="text-sm text-slate-500 italic py-4 text-center">Nenhuma correlação crítica detectada nas últimas 4 horas.</p>
                  ) : (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {correlations.map((inc, i) => (
                        <div key={i} className="bg-slate-950/50 rounded-2xl border border-blue-500/20 p-4">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-xs font-black text-blue-400 uppercase tracking-tight truncate flex-1">{inc.zabbixProblem.name}</p>
                            <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-md font-black">{inc.impactScore}%</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-bold mb-3">@ {inc.zabbixProblem.hosts?.[0]?.name}</p>
                          
                          <div className="space-y-2">
                            {inc.relatedMessages.slice(0, 2).map((msg, mi) => (
                              <div key={mi} className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/50">
                                <p className="text-[11px] text-slate-300 leading-tight">&quot;{msg.text}&quot;</p>
                                <div className="flex items-center gap-2 mt-1 opacity-60">
                                  <span className="text-[8px] font-bold uppercase">{msg.sender}</span>
                                  <span className="text-[8px] font-medium">{new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              </div>
                            ))}
                            {inc.relatedMessages.length > 2 && (
                              <p className="text-[9px] text-blue-400/60 font-bold text-center mt-1">+ {inc.relatedMessages.length - 2} outras mensagens relacionadas</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp size={16} className="text-green-400" />
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase">Uptime</p>
                      <p className="text-xs font-bold">99.8%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <TrendingDown size={16} className="text-red-400" />
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase">Latency</p>
                      <p className="text-xs font-bold">+12ms</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

const AlertItem = ({ severity, title, time, host }: AlertItemProps) => (
  <div className="flex items-start gap-3 p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 transition-hover hover:border-slate-700">
    <AlertCircle className={severity === 'high' ? 'text-red-500' : 'text-yellow-500'} size={18} />
    <div className="min-w-0">
      <p className="text-xs font-black uppercase tracking-tight truncate">{title}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-slate-600 font-bold uppercase">{time}</span>
        <span className="text-[10px] text-blue-400/60 font-medium truncate">@ {host}</span>
      </div>
    </div>
  </div>
);

const SocialInsight = ({ group, summary, urgency }: SocialInsightProps) => (
  <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 transition-hover hover:border-slate-700">
    <div className="flex justify-between items-center mb-2">
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 truncate">{group}</span>
      <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase ${urgency === 'Alta' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
        {urgency}
      </span>
    </div>
    <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{summary}</p>
  </div>
);
