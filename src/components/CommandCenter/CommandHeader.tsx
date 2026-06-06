'use client';

import { Search, Bell, ChevronDown, Users } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CommandHeader() {
  return (
    <header className="flex items-center justify-between py-12 px-12 z-20">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col"
      >
        <h1 className="text-4xl font-[1000] tracking-[-0.05em] leading-tight text-foreground uppercase">
          Hello, <span className="text-neon-cyan italic">Alan Moreira</span>
        </h1>
        <p className="text-muted-foreground font-bold tracking-widest text-[10px] uppercase mt-2">
          {process.env.NEXT_PUBLIC_APP_NAME || 'AM OS'} Operation — Command Center
        </p>
      </motion.div>
      
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-6"
      >
        <div className="relative group">
           <div className="absolute -inset-1 bg-neon-cyan/10 rounded-2xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
           <div className="relative flex items-center bg-card/80 border border-white/5 rounded-2xl px-6 py-3 shadow-xl backdrop-blur-md">
              <Search className="w-4 h-4 text-muted-foreground mr-4" />
              <input 
                placeholder="Busca Global..." 
                className="bg-transparent text-xs font-bold outline-none placeholder:text-foreground w-48"
              />
           </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-2xl bg-card border border-white/5 flex items-center justify-center text-muted-foreground relative cursor-pointer hover:bg-card/5 transition-all group">
              <Bell className="w-5 h-5 group-hover:text-neon-cyan" />
              <div className="absolute top-3 right-3 w-2 h-2 bg-neon-pink rounded-full shadow-[0_0_10px_rgba(241,91,181,0.8)]" />
           </div>
           
           <div className="flex items-center gap-4 bg-card border border-white/5 p-1.5 rounded-2xl pr-4 cursor-pointer hover:border-white/10 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-neon-cyan/10 flex items-center justify-center">
                 <Users className="w-5 h-5 text-neon-cyan" />
              </div>
              <div className="flex flex-col">
                 <span className="text-[10px] font-black text-foreground">Admin</span>
                 <span className="text-[8px] font-bold text-muted-foreground uppercase">SuperUser</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-foreground ml-2 group-hover:text-white transition-colors" />
           </div>
        </div>
      </motion.div>
    </header>
  );
}
