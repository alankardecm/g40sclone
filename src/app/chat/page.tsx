'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import React from 'react';
import { useSession } from 'next-auth/react';
import {
  Bot, Send, Trash2, Sparkles, BookOpen, MessageSquare, ExternalLink,
  ZoomIn, X, Plus, PenLine, ChevronLeft, ChevronRight, Copy, Check,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';

type Mode = 'geral' | 'interno';

type Source = {
  title: string;
  source: string;
  score?: number;
  imageUrl?: string;
};

type Message = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
};

type Conversation = {
  id: string;
  title: string;
  mode: Mode;
  created_at: string;
  updated_at: string;
};

const QUICK_PROMPTS: Record<Mode, string[]> = {
  geral: [
    'Reescreva esse email de forma mais profissional:',
    'Explique de forma simples o que é:',
    'Me ajude a responder essa mensagem:',
    'Resuma o seguinte texto:',
  ],
  interno: [
    'Como configurar o ATA Grandstream HT818?',
    'Como acessar o Zabbix?',
    'Como configurar um F612?',
    'Quais são os passos para configurar SIP?',
  ],
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  if (diffH < 24) return `${diffH}h`;
  if (diffD < 7) return `${diffD}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-[#E6EAF3]/15 bg-[#1a1a1a]">
      <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-2">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          {lang || 'código'}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground transition-all hover:bg-card/10 hover:text-white"
        >
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-[12px] leading-relaxed text-gray-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function formatInline(text: string): React.ReactNode[] {
  // **bold** e `inline code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="rounded bg-[#E6EAF3]/15 px-1.5 py-0.5 font-mono text-[11px] text-[#3B82F6]">{part.slice(1, -1)}</code>;
    return part;
  });
}

function formatMessage(text: string): React.ReactNode[] {
  const segments = text.split(/(```[\s\S]*?```)/g);
  const result: React.ReactNode[] = [];

  segments.forEach((seg, i) => {
    if (seg.startsWith('```')) {
      const body = seg.slice(3);
      const newline = body.indexOf('\n');
      const lang = newline !== -1 ? body.slice(0, newline).trim() : '';
      const code = newline !== -1 ? body.slice(newline + 1).replace(/```$/, '').trimEnd() : body.replace(/```$/, '').trimEnd();
      result.push(<CodeBlock key={i} lang={lang} code={code} />);
    } else {
      seg.split('\n').forEach((line, li, arr) => {
        result.push(<span key={`${i}-${li}`}>{formatInline(line)}{li < arr.length - 1 && <br />}</span>);
      });
    }
  });

  return result;
}

export default function ChatPage() {
  const { data: session } = useSession();

  // Conversation list
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [convsLoading, setConvsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Active conversation messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Chat input
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('geral');

  // Title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  // Lightbox
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);

  // Hover state for conversation delete buttons
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Close lightbox on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Load conversations on mount
  useEffect(() => {
    if (!session?.user?.email) return;
    void loadConversations();
  }, [session]);

  const loadConversations = useCallback(async () => {
    setConvsLoading(true);
    try {
      const res = await fetch('/api/chat/conversations');
      const data = (await res.json()) as { conversations: Conversation[] };
      setConversations(data.conversations ?? []);
    } finally {
      setConvsLoading(false);
    }
  }, []);

  async function openConversation(conv: Conversation) {
    setActiveConvId(conv.id);
    setMode(conv.mode as Mode);
    setTitleInput(conv.title);
    setMessages([]);
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/chat/conversations/${conv.id}`);
      const data = (await res.json()) as { messages: Message[] };
      setMessages(data.messages ?? []);
    } finally {
      setMessagesLoading(false);
    }
  }

  async function createConversation() {
    const res = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const data = (await res.json()) as { conversation: Conversation };
    if (data.conversation) {
      setConversations((prev) => [data.conversation, ...prev]);
      await openConversation(data.conversation);
    }
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Excluir esta conversa?')) return;
    await fetch(`/api/chat/conversations/${id}`, { method: 'DELETE' });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
  }

  async function saveTitle() {
    if (!activeConvId || !titleInput.trim()) return;
    setEditingTitle(false);
    const trimmed = titleInput.trim();
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConvId ? { ...c, title: trimmed } : c))
    );
    await fetch(`/api/chat/conversations/${activeConvId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    });
  }

  function switchMode(newMode: Mode) {
    if (mode === newMode) return;
    setMode(newMode);
    setActiveConvId(null);
    setMessages([]);
  }

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    // Se não há conversa ativa, cria uma nova antes de enviar
    let convId = activeConvId;
    if (!convId) {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = (await res.json()) as { conversation: Conversation };
      if (!data.conversation) return;
      convId = data.conversation.id;
      setActiveConvId(convId);
      setConversations((prev) => [data.conversation, ...prev]);
      setTitleInput(data.conversation.title);
    }

    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const res = await fetch(`/api/chat/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });

      const data = (await res.json()) as { answer?: string; sources?: Source[]; title?: string };
      const answer = data.answer?.trim() || 'Não consegui gerar uma resposta. Tente novamente.';
      const sources = data.sources ?? [];

      setMessages((prev) => [...prev, { role: 'assistant', content: answer, sources }]);

      // Atualiza título da conversa se foi gerado automaticamente
      if (data.title) {
        setTitleInput(data.title);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId ? { ...c, title: data.title!, updated_at: new Date().toISOString() } : c
          )
        );
      } else {
        // Apenas atualiza updated_at para reordenar na lista
        setConversations((prev) => {
          const conv = prev.find((c) => c.id === convId);
          if (!conv) return prev;
          return [
            { ...conv, updated_at: new Date().toISOString() },
            ...prev.filter((c) => c.id !== convId),
          ];
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Erro de conexão. Verifique a API e tente novamente.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function applyQuickPrompt(prompt: string) {
    setInput(prompt + ' ');
    textareaRef.current?.focus();
  }

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const isInterno = mode === 'interno';

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground">
      <Sidebar />

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-4 -right-4 flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-lg text-foreground hover:bg-muted z-10"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="mb-2 text-center text-[11px] font-black uppercase tracking-[0.2em] text-white/70">
              {lightbox.title}
            </p>
            <img
              src={lightbox.url}
              alt={lightbox.title}
              className="max-h-[85vh] max-w-[88vw] rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Chat conversations sidebar */}
      <div
        className={`flex flex-col border-r border-[#E6EAF3]/8 bg-[#f8f9f5] transition-all duration-200 ${
          sidebarOpen ? 'w-[260px] min-w-[260px]' : 'w-0 min-w-0 overflow-hidden'
        }`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between gap-2 border-b border-[#E6EAF3]/8 px-4 py-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              Conversas
            </span>
            <p className={`mt-0.5 text-[9px] font-black uppercase tracking-widest ${
              isInterno ? 'text-[#3B82F6]' : 'text-muted-foreground'
            }`}>
              {isInterno ? 'Consulta Interna' : 'Geral'}
            </p>
          </div>
          <button
            onClick={() => void createConversation()}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3B82F6]/15 text-[#3B82F6] transition-all hover:bg-[#3B82F6]/25"
            title="Nova conversa"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Conversation list — filtrada pelo modo ativo */}
        <div className="flex-1 overflow-y-auto py-2">
          {convsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-2 w-2 animate-bounce rounded-full bg-[#3B82F6]/60 [animation-delay:0ms]" />
              <div className="mx-1 h-2 w-2 animate-bounce rounded-full bg-[#3B82F6]/60 [animation-delay:150ms]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-[#3B82F6]/60 [animation-delay:300ms]" />
            </div>
          ) : conversations.filter(c => c.mode === mode).length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[11px] text-muted-foreground">Nenhuma conversa ainda.</p>
              <button
                onClick={() => void createConversation()}
                className="mt-3 rounded-xl bg-[#3B82F6]/15 px-3 py-2 text-[11px] font-black text-[#3B82F6] transition-all hover:bg-[#3B82F6]/25"
              >
                Iniciar agora
              </button>
            </div>
          ) : (
            conversations.filter(c => c.mode === mode).map((conv) => {
              const isActive = conv.id === activeConvId;
              const isHovered = hoveredConvId === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => void openConversation(conv)}
                  onMouseEnter={() => setHoveredConvId(conv.id)}
                  onMouseLeave={() => setHoveredConvId(null)}
                  className={`group relative mx-2 flex cursor-pointer items-start justify-between gap-2 rounded-xl px-3 py-3 transition-all ${
                    isActive
                      ? 'bg-[#3B82F6]/15 text-[#5a8a1f]'
                      : 'text-muted-foreground hover:bg-[#3B82F6]/8'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-[#3B82F6]" />
                  )}
                  <div className="min-w-0 flex-1 pl-1">
                    <p className={`truncate text-[12px] font-bold leading-snug ${isActive ? 'text-[#3d6b00]' : ''}`}>
                      {conv.title}
                    </p>
                    <span className="text-[9px] text-muted-foreground">{formatRelativeDate(conv.updated_at)}</span>
                  </div>
                  {(isHovered || isActive) && (
                    <button
                      onClick={(e) => void deleteConversation(conv.id, e)}
                      className="shrink-0 flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-red-100 hover:text-red-500"
                      title="Excluir conversa"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main chat area */}
      <main className="flex flex-1 flex-col min-h-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-[#E6EAF3]/8 bg-card/80 px-5 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            {/* Toggle sidebar */}
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-muted hover:text-muted-foreground"
              title={sidebarOpen ? 'Ocultar conversas' : 'Mostrar conversas'}
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#3B82F6]/12 ring-1 ring-[#3B82F6]/20">
              <Bot className="h-4 w-4 text-[#3B82F6]" />
            </div>

            {/* Título editável inline */}
            {activeConvId ? (
              editingTitle ? (
                <input
                  ref={titleInputRef}
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={() => void saveTitle()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveTitle();
                    if (e.key === 'Escape') setEditingTitle(false);
                  }}
                  className="min-w-0 max-w-xs border-b border-[#3B82F6]/50 bg-transparent text-sm font-black text-[#E6EAF3] outline-none"
                  maxLength={120}
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    setTitleInput(activeConv?.title ?? '');
                    setEditingTitle(true);
                    setTimeout(() => titleInputRef.current?.select(), 30);
                  }}
                  className="group flex min-w-0 items-center gap-1.5"
                >
                  <span className="truncate text-sm font-black text-[#E6EAF3] max-w-[200px]">
                    {activeConv?.title ?? 'Conversa'}
                  </span>
                  <PenLine className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )
            ) : (
              <div>
                <h1 className="text-sm font-black tracking-[-0.03em] text-[#E6EAF3]">
                  Assistente {process.env.NEXT_PUBLIC_APP_NAME || 'AM OS'}
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {loading ? 'Consultando...' : 'Selecione ou inicie uma conversa'}
                </p>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Toggle modo */}
            <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-1">
              <button
                onClick={() => void switchMode('geral')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.15em] transition-all ${
                  !isInterno
                    ? 'bg-card text-[#E6EAF3] shadow-sm'
                    : 'text-muted-foreground hover:text-muted-foreground'
                }`}
              >
                <MessageSquare className="h-3 w-3" />
                Geral
              </button>
              <button
                onClick={() => void switchMode('interno')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.15em] transition-all ${
                  isInterno
                    ? 'bg-[#3B82F6] text-white shadow-sm'
                    : 'text-muted-foreground hover:text-muted-foreground'
                }`}
              >
                <BookOpen className="h-3 w-3" />
                Consulta Interna
              </button>
            </div>
          </div>
        </div>

        {/* Faixa de modo interno */}
        {isInterno && (
          <div className="border-b border-[#3B82F6]/20 bg-[#3B82F6]/6 px-6 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#3B82F6]">
              Consultando Google Drive
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="custom-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-8 lg:px-10">

          {/* Estado vazio — nenhuma conversa selecionada */}
          {!activeConvId && (
            <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#3B82F6]/12 ring-1 ring-[#3B82F6]/20">
                <Sparkles className="h-7 w-7 text-[#3B82F6]" />
              </div>
              <div>
                <h2 className="text-2xl font-[950] tracking-[-0.04em] text-[#E6EAF3]">
                  Como posso ajudar?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Selecione uma conversa ou inicie uma nova usando o botão{' '}
                  <strong className="text-[#3B82F6]">+</strong> na barra lateral.
                </p>
              </div>
              <button
                onClick={() => void createConversation()}
                className="flex items-center gap-2 rounded-2xl bg-[#3B82F6] px-6 py-3 text-sm font-black text-white shadow-md transition-all hover:bg-[#2563EB] hover:scale-105 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                Nova conversa
              </button>
            </div>
          )}

          {/* Carregando mensagens */}
          {activeConvId && messagesLoading && (
            <div className="flex flex-1 items-center justify-center gap-3 text-muted-foreground">
              <div className="h-2 w-2 animate-bounce rounded-full bg-[#3B82F6]/60 [animation-delay:0ms]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-[#3B82F6]/60 [animation-delay:150ms]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-[#3B82F6]/60 [animation-delay:300ms]" />
            </div>
          )}

          {/* Estado vazio — conversa aberta sem mensagens */}
          {activeConvId && !messagesLoading && messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#3B82F6]/12 ring-1 ring-[#3B82F6]/20">
                {isInterno ? <BookOpen className="h-6 w-6 text-[#3B82F6]" /> : <Sparkles className="h-6 w-6 text-[#3B82F6]" />}
              </div>
              <div>
                <h2 className="text-xl font-[950] tracking-[-0.03em] text-[#E6EAF3]">
                  {isInterno ? 'Consulta à base interna' : 'Conversa vazia'}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {isInterno
                    ? 'Pergunte sobre procedimentos, configurações e processos documentados no Google Drive.'
                    : 'Digite sua primeira mensagem abaixo para começar.'}
                </p>
              </div>
              <div className="grid w-full max-w-lg gap-3 sm:grid-cols-2">
                {QUICK_PROMPTS[mode].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => applyQuickPrompt(prompt)}
                    className="rounded-2xl border border-[#E6EAF3]/10 bg-card px-5 py-4 text-left text-[12px] font-bold text-[#E6EAF3] transition-all hover:border-[#3B82F6]/30 hover:bg-[#3B82F6]/5 hover:text-[#3B82F6]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages list */}
          {!messagesLoading && messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const hasSources = !isUser && msg.sources && msg.sources.length > 0;

            return (
              <div key={msg.id ?? i} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                  isUser ? 'bg-[#E6EAF3] text-white' : 'bg-[#3B82F6]/12 text-[#3B82F6]'
                }`}>
                  {isUser ? 'EU' : <Bot className="h-4 w-4" />}
                </div>

                <div className="flex max-w-[72%] flex-col gap-2">
                  <div className={`rounded-3xl px-5 py-4 text-sm leading-relaxed shadow-sm ${
                    isUser
                      ? 'rounded-tr-md bg-[#E6EAF3] text-white'
                      : 'rounded-tl-md border border-[#E6EAF3]/8 bg-card text-[#E6EAF3]'
                  }`}>
                    {formatMessage(msg.content)}
                  </div>

                  {hasSources && (
                    <div className="flex flex-col gap-2 pl-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">
                        Fontes ({msg.sources!.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources!.slice(0, 6).map((src, si) => (
                          <a
                            key={si}
                            href={src.source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded-full border border-[#3B82F6]/25 bg-[#3B82F6]/8 px-2.5 py-1 text-[10px] font-bold text-[#3B82F6] transition-colors hover:bg-[#3B82F6]/15"
                          >
                            <BookOpen className="h-2.5 w-2.5" />
                            {src.title.length > 30 ? src.title.slice(0, 30) + '…' : src.title}
                            <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                          </a>
                        ))}
                      </div>
                      {msg.sources!.some((s) => s.imageUrl) && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {msg.sources!.filter((s) => s.imageUrl).slice(0, 4).map((src, si) => (
                            <div
                              key={si}
                              className="group relative cursor-zoom-in overflow-hidden rounded-xl border border-border bg-background"
                              style={{ width: 120, height: 80 }}
                              onClick={() => setLightbox({ url: src.imageUrl!, title: src.title })}
                            >
                              <img
                                src={src.imageUrl}
                                alt={src.title}
                                className="h-full w-full object-contain transition-transform group-hover:scale-105"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                                <ZoomIn className="h-5 w-5 text-white opacity-0 drop-shadow group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#3B82F6]/12">
                <Bot className="h-4 w-4 text-[#3B82F6]" />
              </div>
              <div className="flex items-center gap-1.5 rounded-3xl rounded-tl-md border border-[#E6EAF3]/8 bg-card px-5 py-4 shadow-sm">
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#3B82F6]/60 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#3B82F6]/60 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#3B82F6]/60 [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#E6EAF3]/8 bg-card/80 px-6 py-5 backdrop-blur-xl lg:px-10">
          <div className={`flex items-end gap-3 rounded-3xl border p-3 shadow-[0_8px_30px_rgba(64,64,64,0.08)] transition-all ${
            isInterno
              ? 'border-[#3B82F6]/30 focus-within:border-[#3B82F6]/60 focus-within:shadow-[0_8px_30px_rgba(141,198,63,0.15)]'
              : 'border-[#E6EAF3]/12 focus-within:border-[#3B82F6]/40 focus-within:shadow-[0_8px_30px_rgba(141,198,63,0.12)]'
          } bg-card`}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
              }}
              placeholder={
                !activeConvId
                  ? 'Digite uma mensagem para iniciar uma conversa...'
                  : isInterno
                  ? 'Pergunte sobre um procedimento ou configuração...'
                  : 'Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)'
              }
              rows={1}
              className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-[#E6EAF3] outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[#3B82F6] text-white shadow-md transition-all hover:bg-[#2563EB] hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            {isInterno
              ? `Consulta Interna · Google Drive · Groq llama-3.3-70b`
              : `Assistente Geral · Groq llama-3.3-70b · Uso interno ${process.env.NEXT_PUBLIC_APP_NAME || 'AM OS'}`}
          </p>
        </div>
      </main>
    </div>
  );
}
