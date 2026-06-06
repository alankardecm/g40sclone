'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, RefreshCw, Send, Sparkles, CheckCheck, MessageSquare, Inbox as InboxIcon, Clock,
} from 'lucide-react';
import type {
  InboxOverview, Conversation, ConversationSummary, ConversationCategory, ConversationStatus,
} from '@/shared/types/inbox';

const BRAND = '#379890';
const INK = '#143230';

const catStyle: Record<ConversationCategory, string> = {
  suporte: 'bg-blue-100 text-blue-700',
  cobranca: 'bg-amber-100 text-amber-700',
  retencao: 'bg-rose-100 text-rose-700',
  comercial: 'bg-emerald-100 text-emerald-700',
  geral: 'bg-slate-100 text-slate-600',
};
const catLabel: Record<ConversationCategory, string> = {
  suporte: 'Suporte', cobranca: 'Cobrança', retencao: 'Retenção', comercial: 'Comercial', geral: 'Geral',
};
const statusLabel: Record<ConversationStatus, string> = { aberto: 'Aberto', aguardando: 'Aguardando', resolvido: 'Resolvido' };
const hhmm = (iso: string) => { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

export default function ComunicacaoPage() {
  const [inbox, setInbox] = useState<InboxOverview | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [conversa, setConversa] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [aiTag, setAiTag] = useState<'ai' | 'fallback' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    try {
      const res = await fetch('/api/comms/inbox', { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setInbox(json.inbox as InboxOverview);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadInbox(); }, [loadInbox]);

  const openConversa = useCallback(async (id: string) => {
    setSelId(id); setConversa(null); setDraft(''); setAiTag(null);
    const res = await fetch(`/api/comms/conversations/${id}`, { cache: 'no-store' });
    const json = await res.json();
    if (json.ok) { setConversa(json.conversa as Conversation); loadInbox(); }
  }, [loadInbox]);

  const act = async (action: 'suggest' | 'reply' | 'resolve', texto?: string) => {
    if (!selId) return;
    if (action === 'suggest') setSuggesting(true);
    try {
      const res = await fetch(`/api/comms/conversations/${selId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, texto }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      if (action === 'suggest') { setDraft(json.suggestion.texto); setAiTag(json.suggestion.source); }
      else { setConversa(json.conversa as Conversation); if (action === 'reply') { setDraft(''); setAiTag(null); } loadInbox(); }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Erro.'); } finally { setSuggesting(false); }
  };

  const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <span style={{ color: BRAND }}>{icon}</span>
      <span className="text-lg font-black" style={{ color: INK }}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <Link href="/" className="flex items-center text-sm text-muted-foreground hover:text-[#379890] transition-colors">
              <ArrowLeft size={16} className="mr-1" /> Voltar para Home
            </Link>
            <h1 className="mt-2 text-3xl font-black uppercase" style={{ color: INK }}>Comunicação</h1>
            <p className="text-muted-foreground text-sm">Atendimento ao cliente no WhatsApp — com o agente de IA sugerindo respostas.</p>
          </div>
          <button onClick={() => { setLoading(true); loadInbox(); }} disabled={loading}
            className="flex items-center rounded-full bg-card px-4 py-2 text-sm font-bold border border-border shadow-sm hover:bg-background disabled:opacity-50 transition-all">
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </header>

        {err && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{err}</div>}

        {inbox && (
          <div className="mb-4 flex flex-wrap gap-2">
            <Stat icon={<InboxIcon size={15} />} label="abertas" value={inbox.stats.abertas} />
            <Stat icon={<Clock size={15} />} label="aguardando" value={inbox.stats.aguardando} />
            <Stat icon={<CheckCheck size={15} />} label="resolvidas hoje" value={inbox.stats.resolvidasHoje} />
            <Stat icon={<MessageSquare size={15} />} label="não lidas" value={inbox.stats.naoLidasTotal} />
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          {/* Lista */}
          <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="max-h-[68vh] overflow-y-auto divide-y divide-border">
              {loading && !inbox ? (
                [1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-muted/50 animate-pulse" />)
              ) : inbox?.conversas.map((c: ConversationSummary) => (
                <button key={c.id} onClick={() => openConversa(c.id)}
                  className={`w-full text-left p-3 hover:bg-background/60 transition-colors ${selId === c.id ? 'bg-background/80' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate" style={{ color: INK }}>{c.clienteNome}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{hhmm(c.ultimaMensagemEm)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">{c.previa}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${catStyle[c.categoria]}`}>{catLabel[c.categoria]}</span>
                    <span className="text-[10px] text-muted-foreground">· {statusLabel[c.status]}</span>
                    {c.naoLidas > 0 && <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: BRAND }}>{c.naoLidas}</span>}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Conversa */}
          <section className="rounded-2xl border border-border bg-card shadow-sm flex flex-col min-h-[68vh]">
            {!conversa ? (
              <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
                <MessageSquare size={40} className="opacity-30" />
                <p className="mt-2 text-sm">Selecione uma conversa</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border p-4">
                  <div>
                    <p className="font-bold" style={{ color: INK }}>{conversa.clienteNome}</p>
                    <p className="text-xs text-muted-foreground">{conversa.telefone} · {conversa.assunto}
                      {conversa.clienteId && <Link href={`/crm/clientes/${conversa.clienteId}`} className="ml-2 underline hover:text-[#379890]">ver no CRM</Link>}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${catStyle[conversa.categoria]}`}>{catLabel[conversa.categoria]}</span>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {conversa.mensagens.map((m) => (
                    <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.direction === 'out' ? 'text-white' : 'bg-background border border-border'}`}
                        style={m.direction === 'out' ? { background: BRAND } : {}}>
                        <p>{m.texto}</p>
                        <p className={`mt-1 text-[10px] ${m.direction === 'out' ? 'text-white/70' : 'text-muted-foreground'}`}>
                          {m.autor === 'ia' ? 'IA · ' : m.autor === 'agente' ? 'Você · ' : ''}{hhmm(m.hora)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border p-3">
                  {aiTag && <p className="mb-1 text-[11px]" style={{ color: BRAND }}>✦ Sugestão {aiTag === 'ai' ? 'da IA' : '(modelo)'} — revise antes de enviar</p>}
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
                    placeholder="Escreva uma resposta ou gere com a IA…"
                    className="w-full resize-none rounded-xl border border-border bg-background p-2.5 text-sm outline-none focus:border-[#379890]" />
                  <div className="mt-2 flex items-center gap-2">
                    <button onClick={() => act('suggest')} disabled={suggesting}
                      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:bg-background disabled:opacity-50">
                      <Sparkles size={14} style={{ color: BRAND }} className={suggesting ? 'animate-pulse' : ''} />
                      {suggesting ? 'Gerando…' : 'Sugerir com IA'}
                    </button>
                    <button onClick={() => act('reply', draft)} disabled={!draft.trim()}
                      className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40" style={{ background: BRAND }}>
                      <Send size={14} /> Enviar
                    </button>
                    <button onClick={() => act('resolve')} title="Marcar como resolvido"
                      className="ml-auto flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-background">
                      <CheckCheck size={14} /> Resolver
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        <footer className="mt-5 text-center text-xs text-muted-foreground">
          MVP com conversas de exemplo · pronto para ligar na Evolution API (WhatsApp).
        </footer>
      </div>
    </main>
  );
}
