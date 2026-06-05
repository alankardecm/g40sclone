'use client';

import { useEffect, useState } from 'react';
import { Bot, Database, Search, Send, X, ZoomIn } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type RagSource = {
  title: string;
  source: string;
  score?: number;
  imageUrl?: string;
};

type RagSession = {
  sessionId: string;
  messages: ChatMessage[];
  topic: string;
  summary: string;
};

const CHAT_SESSION_KEY = 'g4os-rag-session-v1';
const INITIAL_PROMPT = '';

const BASE_MESSAGES: ChatMessage[] = [
  {
    role: 'assistant',
    content: 'Olá! Consulte qualquer procedimento, configuração ou processo documentado no Google Drive. Pode perguntar.',
  },
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferTopic(message: string) {
  const normalized = normalizeText(message);
  const stopwords = new Set(['como', 'quais', 'qual', 'para', 'no', 'na', 'os', 'as', 'de', 'do', 'da', 'o', 'a', 'um', 'uma', 'preciso', 'faz', 'fazer', 'sobre', 'essa', 'esse', 'pode', 'me', 'e', 'em', 'por']);
  const meaningful = normalized.split(' ').filter((t) => t.length > 2 && !stopwords.has(t));
  return meaningful.slice(0, 4).join(' ') || 'consulta geral';
}

function buildSessionSummary(topic: string, userMessage: string, assistantMessage: string) {
  return `Tema: ${topic}. Ultima pergunta: ${userMessage.trim().slice(0, 140)}. Ultima resposta: ${assistantMessage.trim().slice(0, 180)}.`;
}

function normalizeAssistantText(value: string) {
  return value.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function createSessionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `rag-session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function deduplicateSources(sources: RagSource[]): RagSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const key = s.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterSources(sources: RagSource[]): RagSource[] {
  const deduped = deduplicateSources(sources);
  // Se tem score (Pinecone), filtra os mais relevantes
  const hasScores = deduped.some((s) => typeof s.score === 'number');
  if (hasScores) {
    return deduped
      .filter((s) => typeof s.score !== 'number' || s.score >= 0.5)
      .slice(0, 6);
  }
  // BookStack: retorna todos (já são poucos e relevantes)
  return deduped.slice(0, 8);
}

export default function RagExplorer() {
  const [sessionId, setSessionId] = useState(() => createSessionId());
  const [messages, setMessages] = useState<ChatMessage[]>(BASE_MESSAGES);
  const [input, setInput] = useState(INITIAL_PROMPT);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pinecone' | 'empty' | 'error'>('idle');
  const [statusDetail, setStatusDetail] = useState('Pronto para consultar o Google Drive.');
  const [sources, setSources] = useState<RagSource[]>([]);
  const [sessionTopic, setSessionTopic] = useState('consulta geral');
  const [sessionSummary, setSessionSummary] = useState('Tema: consulta geral. Aguardando primeira troca.');
  const [hydrated, setHydrated] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    try {
      const rawSession = window.localStorage.getItem(CHAT_SESSION_KEY);
      if (!rawSession) return;
      const parsed = JSON.parse(rawSession) as RagSession;
      if (typeof parsed?.sessionId === 'string' && parsed.sessionId.trim()) setSessionId(parsed.sessionId.trim());
      if (Array.isArray(parsed?.messages) && parsed.messages.length > 0) setMessages(parsed.messages);
      if (typeof parsed?.topic === 'string' && parsed.topic.trim()) setSessionTopic(parsed.topic);
      if (typeof parsed?.summary === 'string' && parsed.summary.trim()) setSessionSummary(parsed.summary);
    } catch {
      window.localStorage.removeItem(CHAT_SESSION_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CHAT_SESSION_KEY, JSON.stringify({
      sessionId,
      messages: messages.slice(-20),
      topic: sessionTopic,
      summary: sessionSummary,
    } satisfies RagSession));
  }, [messages, hydrated, sessionId, sessionTopic, sessionSummary]);

  // Fecha lightbox com Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxImage(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const headerBadge =
    status === 'pinecone' ? 'Base consultada' :
    status === 'empty'   ? 'Sem contexto'    :
    status === 'error'   ? 'Erro'            : 'Pronto';

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || searching) return;

    const nextTopic = inferTopic(trimmed);
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];

    setMessages(nextMessages);
    setSessionTopic(nextTopic);
    setInput('');
    setSearching(true);
    setStatus('idle');
    setStatusDetail('Consultando Google Drive...');
    setSources([]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messages: nextMessages, sessionTopic: nextTopic, sessionSummary }),
      });

      const payload = (await response.json()) as {
        answer?: string;
        provider?: 'pinecone' | 'empty';
        diagnostics?: string[];
        sources?: RagSource[];
      };

      const assistantMessage = normalizeAssistantText(
        payload.answer?.trim() || 'Não encontrei informações suficientes na base.',
      );

      setMessages((current) => [...current, { role: 'assistant', content: assistantMessage }]);
      setSources(filterSources(payload.sources || []));
      setStatus(payload.provider || 'empty');
      setStatusDetail(payload.diagnostics?.[0] || 'Resposta gerada com base no Google Drive.');
      setSessionSummary(buildSessionSummary(nextTopic, trimmed, assistantMessage));
    } catch (error) {
      setStatus('error');
      setStatusDetail(error instanceof Error ? error.message : 'Falha desconhecida');
      setMessages((current) => [...current, { role: 'assistant', content: 'Não foi possível executar a busca neste momento.' }]);
    } finally {
      setSearching(false);
    }
  }

  function clearSession() {
    setSessionId(createSessionId());
    setMessages(BASE_MESSAGES);
    setSources([]);
    setStatus('idle');
    setStatusDetail('Sessão limpa. Pronto para nova consulta.');
    setSessionTopic('consulta geral');
    setSessionSummary('Tema: consulta geral. Aguardando primeira troca.');
    setInput('');
    window.localStorage.removeItem(CHAT_SESSION_KEY);
  }

  const quickPrompts = [
    'Como configurar o ATA Grandstream HT818?',
    'Como acessar o Zabbix?',
    'Como configurar um F612?',
  ];

  const sourcesWithImages = sources.filter((s) => s.imageUrl);
  const sourcesTextOnly = sources.filter((s) => !s.imageUrl);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-bg text-foreground">
      <Sidebar />

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-4 -right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-lg text-gray-700 hover:bg-gray-100 z-10"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="mb-2 text-center text-[11px] font-black uppercase tracking-[0.2em] text-white/70">
              {lightboxImage.title}
            </p>
            <img
              src={lightboxImage.url}
              alt={lightboxImage.title}
              className="max-h-[85vh] max-w-[88vw] rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}

      <main className="custom-scrollbar flex flex-1 flex-col gap-8 overflow-y-auto px-8 py-10 lg:px-12">
        <header className="flex items-start justify-between gap-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              <span>Base de Conhecimento</span>
              <span className="text-primary">Google Drive</span>
            </div>
            <h1 className="text-4xl font-[950] leading-tight tracking-[-0.05em] text-foreground">
              {process.env.NEXT_PUBLIC_APP_NAME || 'G4OS'} <span className="text-primary italic">Assistant</span>
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Consulte procedimentos, configurações e processos documentados na wiki interna.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="rounded-[28px] border border-border/70 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground shadow-sm">
              {headerBadge}
            </div>
            <button
              onClick={clearSession}
              className="rounded-full border border-border bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            >
              Limpar sessão
            </button>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
          {/* Chat */}
          <div className="flex min-h-[700px] flex-col rounded-[36px] border border-border/70 bg-card p-5 shadow-[0_28px_70px_rgba(42,57,52,0.10)]">
            <div className="flex items-center justify-between gap-4 rounded-[28px] border border-border/70 bg-white px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-[-0.03em] text-foreground">{process.env.NEXT_PUBLIC_APP_NAME || 'G4OS'} Assistant</h2>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground truncate max-w-xs">{statusDetail}</p>
                </div>
              </div>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                {headerBadge}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="rounded-full border border-border bg-white px-3 py-1.5 text-[11px] font-bold text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="custom-scrollbar mt-4 flex max-h-[480px] flex-1 flex-col gap-4 overflow-y-auto rounded-[28px] border border-border/70 bg-gradient-to-br from-white via-[#f7fbfa] to-[#eef6f4] p-4 pr-3">
              {messages.map((message, index) => {
                const isUser = message.role === 'user';
                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={`max-w-[80%] break-words rounded-[24px] border p-4 shadow-sm ${
                      isUser
                        ? 'ml-auto rounded-br-md border-primary/20 bg-primary text-white'
                        : 'rounded-bl-md border-border bg-white text-foreground'
                    }`}
                  >
                    <div className={`mb-1.5 text-[9px] font-black uppercase tracking-[0.3em] ${isUser ? 'text-white/70' : 'text-muted-foreground'}`}>
                      {isUser ? 'Você' : (process.env.NEXT_PUBLIC_APP_NAME || 'G4OS')}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-[30px] border border-border/70 bg-white/80 p-3 shadow-sm">
              <div className="flex items-center gap-3 rounded-[26px] border border-border bg-white p-3 shadow-sm focus-within:border-primary/40">
                <Search className="ml-3 h-4 w-4 text-muted-foreground" />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void sendMessage(); } }}
                  placeholder="Faça uma pergunta técnica..."
                  className="flex-1 bg-transparent px-2 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={searching}
                  className="inline-flex h-11 items-center gap-2 rounded-[20px] bg-primary px-6 text-[11px] font-[1000] uppercase tracking-[0.25em] text-white shadow transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50"
                >
                  {searching ? 'Buscando...' : 'Enviar'}
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Fontes */}
          <div className="flex flex-col gap-4">
            <div className="neon-card flex flex-col gap-4 p-6">
              <div className="flex items-center gap-3">
                <Database className="h-4 w-4 text-primary" />
                <h4 className="text-[11px] font-[1000] uppercase tracking-[0.3em] text-muted-foreground">
                  Fontes usadas
                  {sources.length > 0 && <span className="ml-2 text-primary">({sources.length})</span>}
                </h4>
              </div>

              <div className="space-y-3">
                {sources.length === 0 ? (
                  <div className="rounded-[20px] border border-border bg-white p-4 text-sm text-muted-foreground">
                    As fontes aparecem aqui após cada resposta.
                  </div>
                ) : (
                  <>
                    {/* Fontes com imagem */}
                    {sourcesWithImages.map((source, index) => (
                      <div key={`img-${index}`} className="rounded-[20px] border border-border bg-white p-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-foreground leading-tight">{source.title}</p>
                        {typeof source.score === 'number' && (
                          <p className="mt-0.5 text-[10px] text-primary font-bold">{source.score.toFixed(2)}</p>
                        )}
                        {source.imageUrl && (
                          <div
                            className="group relative mt-2 cursor-zoom-in overflow-hidden rounded-[14px] border border-border bg-gray-50"
                            onClick={() => setLightboxImage({ url: source.imageUrl!, title: source.title })}
                          >
                            <img
                              src={source.imageUrl}
                              alt={source.title}
                              className="h-36 w-full object-contain transition-transform duration-200 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                              <ZoomIn className="h-6 w-6 text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Fontes sem imagem */}
                    {sourcesTextOnly.map((source, index) => (
                      <div key={`txt-${index}`} className="rounded-[20px] border border-border bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-foreground leading-tight truncate">{source.title}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{source.source}</p>
                          </div>
                          {typeof source.score === 'number' && (
                            <span className="shrink-0 text-[10px] font-black text-primary">{source.score.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
