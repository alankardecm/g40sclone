'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Zap, Globe, Command, CornerDownLeft, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-[#143230]/18 px-4 pt-[15vh] backdrop-blur-sm transition-all duration-300">
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.96, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#143230]/8 bg-white shadow-[0_30px_70px_-32px_rgba(20,50,48,0.28)]"
          >
            <div className="flex items-center gap-4 border-b border-[#143230]/8 bg-[#f7f8f4] px-5 py-4">
              <Search className="h-5 w-5 text-stone-500" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca inteligente: manuais, contratos ou comandos..."
                className="flex-1 bg-transparent text-lg font-medium text-[#143230] outline-none placeholder:text-stone-400"
              />
              <div className="flex items-center gap-1.5 rounded-md border border-[#143230]/10 bg-white px-2 py-1 text-[10px] font-bold text-stone-500">
                <Command className="h-3 w-3" /> K
              </div>
            </div>

            <div className="max-h-[50vh] space-y-1 overflow-y-auto p-2">
              {!query ? (
                <div className="space-y-4 p-4 py-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#379890]/12 shadow-lg">
                    <Zap className="h-6 w-6 text-[#379890]" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-[#143230]">Busca global com RAG</h3>
                    <p className="mx-auto max-w-xs text-[11px] text-stone-500">
                      Pesquise nos manuais técnicos, contratos e procedimentos operacionais.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  <div className="mb-2 flex items-center justify-between px-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Resultados da inteligencia</span>
                    <span className="text-[9px] text-[#379890]">3 manuais encontrados</span>
                  </div>

                  {[
                    { icon: Zap, label: 'Manual de Configuracao EDD Datacom', type: 'Procedimento', color: '#379890' },
                    { icon: FileText, label: 'Contrato 0021-X (Parceiro Corp)', type: 'Contrato', color: '#5b90c7' },
                    { icon: Globe, label: 'POP Campinas - Status de Link', type: 'Infraestrutura', color: '#6aa84f' },
                  ].map((res, i) => (
                    <div key={i} className="group flex cursor-pointer items-center gap-3 rounded-xl border border-transparent p-3 transition-all hover:border-[#143230]/8 hover:bg-[#f6faf8]">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#143230]/8 bg-[#f5f7f3]">
                        <res.icon className="h-5 w-5" style={{ color: res.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#143230]">{res.label}</p>
                        <p className="text-[10px] text-stone-500">{res.type}</p>
                      </div>
                      <CornerDownLeft className="h-4 w-4 text-stone-400 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-6 border-t border-[#143230]/8 bg-[#f7f8f4] px-5 py-3 text-[10px] font-bold tracking-widest text-stone-600">
              <div className="flex items-center gap-2"><span className="rounded border border-[#143230]/10 bg-white px-1.5 py-0.5 text-stone-500">↑↓</span> Navegar</div>
              <div className="flex items-center gap-2"><span className="rounded border border-[#143230]/10 bg-white px-1.5 py-0.5 text-stone-500">Enter</span> Abrir</div>
              <div className="flex items-center gap-2"><span className="rounded border border-[#143230]/10 bg-white px-1.5 py-0.5 text-stone-500">Esc</span> Sair</div>
              <div className="ml-auto flex items-center gap-2 uppercase text-stone-500">
                <div className="h-1.5 w-1.5 rounded-full bg-[#379890] animate-pulse" /> RAG ativo
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
