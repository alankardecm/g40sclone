'use client';

import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Activity, PieChart } from 'lucide-react';

export default function AnalyticsWidgets() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="bg-card rounded-pill p-10 border border-white/5 shadow-2xl flex flex-col items-center text-center group hover:border-neon-cyan/20 transition-all"
      >
        <div className="w-16 h-16 rounded-[24px] bg-neon-cyan/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
           <BarChart3 className="w-8 h-8 text-neon-cyan" />
        </div>
        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Crescimento Rede</h4>
        <p className="text-2xl font-black text-foreground">+24.8%</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="bg-card rounded-pill p-10 border border-white/5 shadow-2xl flex flex-col items-center text-center group hover:border-neon-orange/20 transition-all"
      >
        <div className="w-16 h-16 rounded-[24px] bg-neon-orange/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
           <TrendingUp className="w-8 h-8 text-neon-orange" />
        </div>
        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Conversão Leads</h4>
        <p className="text-2xl font-black text-foreground">18%</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        className="bg-card rounded-pill p-10 border border-white/5 shadow-2xl flex flex-col items-center text-center group hover:border-neon-pink/20 transition-all"
      >
        <div className="w-16 h-16 rounded-[24px] bg-neon-pink/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
           <Activity className="w-8 h-8 text-neon-pink" />
        </div>
        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Latência Média</h4>
        <p className="text-2xl font-black text-foreground">12ms</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.8 }}
        className="bg-card rounded-pill p-10 border border-white/5 shadow-2xl flex flex-col items-center text-center group hover:border-neon-blue/20 transition-all"
      >
        <div className="w-16 h-16 rounded-[24px] bg-neon-blue/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
           <PieChart className="w-8 h-8 text-neon-blue" />
        </div>
        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Market Share</h4>
        <p className="text-2xl font-black text-foreground">42%</p>
      </motion.div>
    </div>
  );
}
