'use client';

import { useChat } from 'ai/react';
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, User, Database, Sparkles, Globe } from 'lucide-react';

export default function AIChat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="bg-card rounded-pill p-10 border border-white/5 flex flex-col h-full shadow-2xl relative overflow-hidden"
    >
      {/* Visual background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-neon-cyan/5 blur-[100px] -mr-32 -mt-32" />

      <div className="flex items-center justify-between mb-8 z-10">
        <div className="flex flex-col gap-1">
           <h2 className="text-xl font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-neon-cyan" /> Terminal de IA
           </h2>
           <span className="text-[9px] font-black text-stone-600 uppercase tracking-widest">Base de dados 46k documentos</span>
        </div>
        <div className="flex items-center gap-3">
           <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-neon-cyan animate-pulse' : 'bg-green-500'}`} />
           <span className="text-[9px] font-black text-stone-600 uppercase tracking-widest">{isLoading ? 'Processando' : 'Online'}</span>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 space-y-6 mb-8 overflow-y-auto pr-4 custom-scrollbar min-h-0 z-10"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-10">
             <Bot className="w-12 h-12 text-stone-600 mb-6" strokeWidth={1.5} />
             <p className="text-[11px] font-black uppercase tracking-[0.2em] leading-relaxed">
                Faça uma pergunta operacional sobre a base Netturbo.<br/> 
                <span className="text-neon-cyan">Ex: &quot;Quantos contratos em Sumaré?&quot;</span>
             </p>
           </div>
        ) : (
          messages.map((m, i) => {
            const isAi = m.role === 'assistant';
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`flex gap-4 ${!isAi ? 'justify-end' : 'justify-start'}`}
              >
                {isAi && (
                  <div className="w-10 h-10 rounded-[18px] bg-secondary border border-white/5 flex items-center justify-center shrink-0 mt-1 shadow-lg">
                    <Bot className="w-5 h-5 text-neon-cyan" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] px-8 py-6 rounded-pill text-sm leading-relaxed shadow-xl ${
                    !isAi
                      ? "bg-neon-cyan text-black font-[1000] rounded-tr-[10px]"
                      : "bg-secondary text-stone-300 font-medium border border-white/5 rounded-tl-[10px]"
                  }`}
                >
                  {m.content}
                  {isAi && (
                    <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2 text-[8px] font-black text-stone-600 uppercase tracking-widest">
                         <Database className="w-3.5 h-3.5" /> Consultada em 4ms
                      </div>
                      <div className="flex items-center gap-2 text-[8px] font-black text-neon-cyan/50 uppercase tracking-widest">
                         <Globe className="w-3.5 h-3.5" /> RAG-ID: #V7.2
                      </div>
                    </div>
                  )}
                </div>
                {!isAi && (
                  <div className="w-10 h-10 rounded-[18px] bg-neon-cyan/20 border border-neon-cyan/20 flex items-center justify-center shrink-0 mt-1 shadow-lg shadow-neon-cyan/5">
                    <User className="w-5 h-5 text-neon-cyan" />
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      <form 
        onSubmit={handleSubmit}
        className="relative group z-10"
      >
        <div className="absolute -inset-1 bg-neon-cyan/10 rounded-[40px] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Pergunta operacional..."
          className="w-full h-16 pl-8 pr-16 rounded-pill bg-background border border-white/10 text-sm font-bold text-foreground placeholder:text-stone-700 focus:outline-none focus:border-neon-cyan/40 focus:ring-4 focus:ring-neon-cyan/5 transition-all shadow-inner"
        />
        <button
          type="submit"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-neon-cyan text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl shadow-neon-cyan/10"
        >
          <Send className="w-4 h-4" strokeWidth={3} />
        </button>
      </form>
    </motion.div>
  );
}
