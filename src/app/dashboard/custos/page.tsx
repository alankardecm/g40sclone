import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { Bot, Activity, Wallet, Server, Gift, Layers3, Cpu, KeyRound, ShieldCheck, ShieldAlert, Clock, Zap } from 'lucide-react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { AI_PROVIDERS, normalizeProviderName, type AiProviderId } from '@/lib/ai-providers';

// ── Catálogo: onde cada API/provedor é usado e se é gratuita ────────────────
// (free-tier não gera cobrança real; só OpenAI/Anthropic são pagos de fato)
const PAID = new Set(['openai', 'anthropic']);

const PROVIDER_CATALOG: Record<string, { label: string; role: string; where: string }> = {
  nvidia:     { label: 'NVIDIA',     role: 'Primário (1ª tentativa da cascata)', where: 'Chat e geração de texto — primeira opção de todas as respostas.' },
  groq:       { label: 'Groq',       role: 'Fallback 1',                          where: 'Chat/texto quando o primário falha; sentimento e resumos do WhatsApp.' },
  gemini:     { label: 'Google Gemini', role: 'Fallback 2',                       where: 'Chat/texto (fallback).' },
  openrouter: { label: 'OpenRouter', role: 'Fallback 3',                          where: 'Chat/texto (fallback).' },
  openai:     { label: 'OpenAI',     role: 'Fallback final + serviços exclusivos', where: 'Transcrição de áudio (Whisper), análise de imagem, embeddings do RAG e último fallback do chat.' },
  anthropic:  { label: 'Anthropic',  role: 'Tarefas específicas',                 where: 'Automações/tarefas quando configurado.' },
};
const CASCADE_ORDER = ['nvidia', 'groq', 'gemini', 'openrouter', 'openai', 'anthropic'];

const OPERATION_CATALOG: Record<string, { label: string; modulo: string }> = {
  'chat-geral':       { label: 'Chat — modo Geral',                 modulo: 'Chat' },
  'chat-interno':     { label: 'Chat — Consulta Interna (RAG)',     modulo: 'Chat' },
  'sentimento':       { label: 'Análise de sentimento',             modulo: 'IA Comunicação (WhatsApp)' },
  'resumo-diario':    { label: 'Resumo diário dos grupos',          modulo: 'IA Comunicação (WhatsApp)' },
  'resumo-conversa':  { label: 'Resumo de conversa',                modulo: 'IA Comunicação (WhatsApp)' },
  'auditoria-ciclo':  { label: 'Auditoria de ciclo de atendimento', modulo: 'IA Comunicação (WhatsApp)' },
  'transcricao-audio':{ label: 'Transcrição de áudio → ata',        modulo: 'NetMeet / WhatsApp' },
  'analise-imagem':   { label: 'Análise de imagem',                 modulo: 'IA Comunicação' },
};

const BRL_RATE = 5.20;
const PERIODS: Record<string, { label: string; days: number }> = {
  hoje: { label: 'Hoje', days: 0 },
  '7':  { label: '7 dias', days: 7 },
  '30': { label: '30 dias', days: 30 },
};

function money(value: number, currency: 'USD' | 'BRL') {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'pt-BR', {
    style: 'currency', currency, maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);
}
const int = (n: number) => n.toLocaleString('pt-BR');
const isPaid = (p: string) => PAID.has(p.toLowerCase());

type UsageRow = {
  provider: string | null;
  model: string | null;
  project_name: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  estimated_cost_usd: number | string | null;
  created_at: string;
};

export default async function CustosDashboard({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/auth/signin');
  const isAuthorized =
    session.user.role === 'superadmin' || session.user.role === 'admin' || session.user.pages?.custos;
  if (!isAuthorized) redirect('/access-denied');

  const sp = await searchParams;
  const periodo = sp?.periodo && PERIODS[sp.periodo] ? sp.periodo : '30';
  const since = new Date();
  if (PERIODS[periodo].days === 0) since.setHours(0, 0, 0, 0);
  else since.setDate(since.getDate() - PERIODS[periodo].days);

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('ai_token_usage')
    .select('provider, model, project_name, tokens_input, tokens_output, estimated_cost_usd, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(5000);
  const rows = (data ?? []) as UsageRow[];

  // ── Agregações ──
  const norm = (s: string | null) => (s ?? '').toLowerCase().trim();
  let totalCalls = 0, tokensIn = 0, tokensOut = 0, realCostUsd = 0;

  type Agg = { calls: number; tIn: number; tOut: number; cost: number; ops: Set<string>; provs: Set<string> };
  const byProvider = new Map<string, Agg>();
  const byOperation = new Map<string, Agg>();
  const mk = (): Agg => ({ calls: 0, tIn: 0, tOut: 0, cost: 0, ops: new Set(), provs: new Set() });

  for (const r of rows) {
    const prov = norm(r.provider) || 'desconhecido';
    const op = norm(r.project_name) || 'desconhecido';
    const tin = r.tokens_input ?? 0, tout = r.tokens_output ?? 0;
    const cost = Number(r.estimated_cost_usd ?? 0) || 0;
    totalCalls++; tokensIn += tin; tokensOut += tout;
    if (isPaid(prov)) realCostUsd += cost;

    const p = byProvider.get(prov) ?? mk(); byProvider.set(prov, p);
    p.calls++; p.tIn += tin; p.tOut += tout; p.cost += cost; p.ops.add(op);

    const o = byOperation.get(op) ?? mk(); byOperation.set(op, o);
    o.calls++; o.tIn += tin; o.tOut += tout; o.cost += cost; o.provs.add(prov);
  }

  // Provedores: catálogo (na ordem da cascata) + extras vistos nos dados
  const providerKeys = [
    ...CASCADE_ORDER.filter((k) => PROVIDER_CATALOG[k]),
    ...[...byProvider.keys()].filter((k) => !PROVIDER_CATALOG[k] && k !== 'desconhecido'),
  ];
  const operations = [...byOperation.entries()].sort((a, b) => b[1].calls - a[1].calls);
  const activeProviders = new Set([...byProvider.keys()].filter((k) => k !== 'desconhecido')).size;

  // ── Chaves & cotas: status de conexão por provedor ──────────────────────────
  // Status capturado automaticamente dos 429 (ai_provider_quota_events);
  // inventário das chaves via presença de variável de ambiente.
  const nowMs = Date.now();
  const last24h = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  const { data: quotaRows } = await supabase
    .from('ai_provider_quota_events')
    .select('provider, retry_at, created_at')
    .gte('created_at', last24h)
    .order('created_at', { ascending: false });

  type QuotaAgg = { latestRetryAt: string | null; lastHitAt: string | null; hits24h: number };
  const quotaByProvider = new Map<AiProviderId, QuotaAgg>();
  for (const r of quotaRows ?? []) {
    const id = normalizeProviderName(r.provider ?? '');
    if (!id) continue;
    const cur = quotaByProvider.get(id) ?? { latestRetryAt: null, lastHitAt: null, hits24h: 0 };
    cur.hits24h += 1;
    if (!cur.lastHitAt) cur.lastHitAt = r.created_at; // primeira iteração = mais recente
    if (r.retry_at && (!cur.latestRetryAt || new Date(r.retry_at).getTime() > new Date(cur.latestRetryAt).getTime())) {
      cur.latestRetryAt = r.retry_at;
    }
    quotaByProvider.set(id, cur);
  }

  const keyOverview = AI_PROVIDERS.map((p) => {
    const rawKey = process.env[p.envKey];
    const configured = Boolean(rawKey && rawKey.trim().length > 0);
    const q = quotaByProvider.get(p.id);
    const retryAtMs = q?.latestRetryAt ? new Date(q.latestRetryAt).getTime() : 0;
    const outOfQuota = retryAtMs > nowMs;
    const minutesToRenew = outOfQuota ? Math.ceil((retryAtMs - nowMs) / 60000) : 0;
    return {
      ...p,
      configured,
      outOfQuota,
      renewAt: outOfQuota ? q!.latestRetryAt! : null,
      minutesToRenew,
      hits24h: q?.hits24h ?? 0,
      lastHitAt: q?.lastHitAt ?? null,
    };
  });
  const keysAtivas = keyOverview.filter((k) => k.configured).length;
  const keysSemCota = keyOverview.filter((k) => k.outOfQuota).length;

  const formatRenew = (minutes: number) => {
    if (minutes <= 0) return '—';
    if (minutes < 60) return `~${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `~${h}h ${m}min` : `~${h}h`;
  };
  const formatClock = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans antialiased">
      <Sidebar />
      <main className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-screen">
        <div className="px-12 py-10 flex flex-col gap-8">

          {/* Header + seletor de período */}
          <section className="rounded-[40px] border border-black/5 bg-card p-10 shadow-2xl">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-stone-600 mb-3">
              <Activity className="w-4 h-4 text-neon-cyan" />
              <span>Custos de IA · consumo real (Supabase)</span>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="space-y-4 max-w-3xl">
                <h1 className="text-4xl lg:text-5xl font-[1000] tracking-[-0.07em] leading-[0.95] uppercase">
                  Painel de custos das APIs de IA
                </h1>
                <p className="text-sm lg:text-base text-stone-600 leading-relaxed">
                  Consumo real registrado a cada chamada de IA. A arquitetura usa uma <strong className="text-stone-800">cascata
                  de provedores gratuitos</strong> (NVIDIA → Groq → Gemini → OpenRouter) e só cai na <strong className="text-stone-800">OpenAI
                  (paga)</strong> como último recurso ou para serviços exclusivos (transcrição, visão, embeddings).
                </p>
              </div>
              <div className="flex gap-2">
                {Object.entries(PERIODS).map(([key, p]) => (
                  <Link
                    key={key}
                    href={`/dashboard/custos?periodo=${key}`}
                    className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] border transition-colors ${
                      periodo === key
                        ? 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan'
                        : 'border-black/10 bg-black/[0.03] text-stone-600 hover:text-stone-800'
                    }`}
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* KPIs reais */}
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Custo real (pago)', value: money(realCostUsd, 'USD'), sub: `~ ${money(realCostUsd * BRL_RATE, 'BRL')}`, icon: Wallet, tone: 'text-neon-orange' },
              { label: 'Chamadas no período', value: int(totalCalls), sub: `${PERIODS[periodo].label.toLowerCase()}`, icon: Activity, tone: 'text-neon-cyan' },
              { label: 'Tokens processados', value: int(tokensIn + tokensOut), sub: `in ${int(tokensIn)} · out ${int(tokensOut)}`, icon: Cpu, tone: 'text-neon-cyan' },
              { label: 'Provedores ativos', value: String(activeProviders), sub: `${operations.length} funcionalidade(s)`, icon: Server, tone: 'text-neon-orange' },
            ].map((c) => (
              <div key={c.label} className="rounded-[30px] border border-black/5 bg-card p-7 shadow-2xl">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] mb-5">
                  <c.icon className={`w-5 h-5 ${c.tone}`} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-600">{c.label}</p>
                <p className="mt-2 text-3xl font-[950] tracking-[-0.06em]">{c.value}</p>
                <p className="mt-1 text-[11px] text-stone-600 font-mono">{c.sub}</p>
              </div>
            ))}
          </section>
          <p className="-mt-4 text-[11px] text-stone-600 flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5 text-emerald-600" /> Provedores gratuitos (free-tier) não geram cobrança — o custo real vem essencialmente da OpenAI.
          </p>

          {/* Por API / provedor */}
          <section className="rounded-[34px] border border-black/5 bg-card p-8 shadow-2xl">
            <div className="flex items-center justify-between gap-4 mb-7">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-stone-600 mb-1">Por API</p>
                <h2 className="text-2xl font-[950] tracking-[-0.05em] uppercase">Provedores e onde são usados</h2>
              </div>
              <Layers3 className="w-6 h-6 text-neon-cyan" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {providerKeys.map((key) => {
                const cat = PROVIDER_CATALOG[key];
                const agg = byProvider.get(key);
                const paid = isPaid(key);
                const ops = agg ? [...agg.ops].map((o) => OPERATION_CATALOG[o]?.label ?? o) : [];
                return (
                  <div key={key} className="rounded-[26px] border border-black/5 bg-black/[0.03] p-6 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-black uppercase tracking-[-0.03em]">{cat?.label ?? key}</h3>
                        <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-stone-600">{cat?.role ?? '—'}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] border ${
                        paid ? 'border-neon-orange/40 bg-neon-orange/10 text-neon-orange' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-600'
                      }`}>{paid ? 'Pago' : 'Grátis'}</span>
                    </div>

                    <p className="text-[12px] text-stone-600 leading-relaxed">{cat?.where ?? 'Uso registrado nas chamadas de IA.'}</p>

                    <div className="grid grid-cols-3 gap-2 rounded-[18px] border border-black/5 bg-black/[0.03] px-4 py-3 text-center">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-600">Chamadas</p>
                        <p className="text-sm font-black text-stone-900">{int(agg?.calls ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-600">Tokens</p>
                        <p className="text-sm font-black text-stone-900">{int((agg?.tIn ?? 0) + (agg?.tOut ?? 0))}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-600">Custo</p>
                        <p className={`text-sm font-black ${paid ? 'text-neon-orange' : 'text-emerald-600'}`}>
                          {paid ? money(agg?.cost ?? 0, 'USD') : 'grátis'}
                        </p>
                      </div>
                    </div>

                    {ops.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {ops.slice(0, 6).map((o, i) => (
                          <span key={i} className="rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-1 text-[9px] font-bold text-stone-600">{o}</span>
                        ))}
                      </div>
                    )}
                    {!agg && <p className="text-[10px] text-stone-600 italic">Sem uso no período selecionado.</p>}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Chaves & cotas — status de conexão (captura automática de 429) */}
          <section className="rounded-[34px] border border-black/5 bg-card p-8 shadow-2xl">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-stone-600 mb-1">Governança</p>
                <h2 className="text-2xl font-[950] tracking-[-0.05em] uppercase">Chaves &amp; cotas (status de conexão)</h2>
                <p className="mt-1 text-[12px] text-stone-600">
                  Status capturado automaticamente dos limites estourados (429). O tempo de renovação vem da própria resposta do provedor.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-[18px] border border-black/5 bg-black/[0.03] px-4 py-2.5 text-center">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-600">Chaves ativas</p>
                  <p className="mt-1 text-lg font-[950] text-neon-cyan">{keysAtivas}/{keyOverview.length}</p>
                </div>
                <div className="rounded-[18px] border border-black/5 bg-black/[0.03] px-4 py-2.5 text-center">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-600">Sem cota agora</p>
                  <p className={`mt-1 text-lg font-[950] ${keysSemCota > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{keysSemCota}</p>
                </div>
                <KeyRound className="w-6 h-6 text-neon-cyan" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {keyOverview.map((k) => {
                const tone = !k.configured
                  ? 'border-stone-600/40 bg-stone-500/5'
                  : k.outOfQuota
                    ? 'border-red-500/30 bg-red-500/[0.04]'
                    : 'border-emerald-500/20 bg-emerald-500/[0.03]';
                return (
                  <div key={k.id} className={`rounded-[24px] border ${tone} p-5 flex flex-col gap-3`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/[0.05] text-[10px] font-black text-stone-700">{k.cascadeOrder}</span>
                        <div className="min-w-0">
                          <h3 className="text-base font-black uppercase tracking-[-0.03em] truncate">{k.label}</h3>
                          <p className="font-mono text-[10px] text-stone-600">{k.envKey}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] border ${
                        k.tier === 'paid' ? 'border-neon-orange/40 bg-neon-orange/10 text-neon-orange' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-600'
                      }`}>{k.tier === 'paid' ? 'Pago' : 'Free'}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!k.configured ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-600/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-stone-600">
                          <ShieldAlert className="w-3.5 h-3.5" /> Sem chave
                        </span>
                      ) : k.outOfQuota ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-red-700">
                          <ShieldAlert className="w-3.5 h-3.5" /> Sem cota
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                          <ShieldCheck className="w-3.5 h-3.5" /> Com cota
                        </span>
                      )}
                      {k.outOfQuota && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1 text-[10px] font-bold text-stone-700">
                          <Clock className="w-3.5 h-3.5 text-neon-orange" />
                          renova {formatRenew(k.minutesToRenew)}{k.renewAt ? ` (${formatClock(k.renewAt)})` : ''}
                        </span>
                      )}
                    </div>

                    {k.tier === 'free' && k.freeLimit && (
                      <p className="inline-flex items-center gap-1.5 text-[11px] text-stone-600">
                        <Zap className="w-3 h-3 text-neon-cyan" /> Limite free:{' '}
                        <span className="font-bold text-stone-800">{int(k.freeLimit.value)} {k.freeLimit.unit}/{k.freeLimit.window}</span>
                      </p>
                    )}
                    {k.hits24h > 0 && (
                      <p className="text-[10px] text-stone-600">
                        {k.hits24h} estouro(s) de cota em 24h{k.lastHitAt ? ` · último ${formatClock(k.lastHitAt)}` : ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-6 text-[11px] text-stone-600 leading-relaxed">
              Status de cota gravado em <code className="text-stone-600">ai_provider_quota_events</code> (Supabase) a partir dos 429 capturados em{' '}
              <code className="text-stone-600">src/lib/ai.ts</code>. Limites do free-tier são estimativas configuráveis em{' '}
              <code className="text-stone-600">src/lib/ai-providers.ts</code>.
            </p>
          </section>

          {/* Por funcionalidade */}
          <section className="rounded-[34px] border border-black/5 bg-card p-8 shadow-2xl mb-16">
            <div className="flex items-center justify-between gap-4 mb-7">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-stone-600 mb-1">Por funcionalidade</p>
                <h2 className="text-2xl font-[950] tracking-[-0.05em] uppercase">Onde a IA é consumida</h2>
              </div>
              <Bot className="w-6 h-6 text-neon-orange" />
            </div>

            {operations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/5 text-[10px] font-black uppercase tracking-[0.25em] text-stone-600">
                      <th className="px-3 py-3">Funcionalidade</th>
                      <th className="px-3 py-3">Módulo</th>
                      <th className="px-3 py-3">Provedores usados</th>
                      <th className="px-3 py-3 text-right">Chamadas</th>
                      <th className="px-3 py-3 text-right">Tokens</th>
                      <th className="px-3 py-3 text-right">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.map(([op, agg]) => {
                      const cat = OPERATION_CATALOG[op];
                      const paidCost = [...agg.provs].some(isPaid) ? agg.cost : 0;
                      return (
                        <tr key={op} className="border-b border-black/5 last:border-b-0">
                          <td className="px-3 py-4 font-semibold text-stone-900">{cat?.label ?? op}</td>
                          <td className="px-3 py-4 text-stone-600">{cat?.modulo ?? '—'}</td>
                          <td className="px-3 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {[...agg.provs].map((p) => (
                                <span key={p} className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] border ${
                                  isPaid(p) ? 'border-neon-orange/30 text-neon-orange' : 'border-emerald-400/30 text-emerald-600'
                                }`}>{PROVIDER_CATALOG[p]?.label ?? p}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-4 text-right text-stone-700 font-mono">{int(agg.calls)}</td>
                          <td className="px-3 py-4 text-right text-stone-700 font-mono">{int(agg.tIn + agg.tOut)}</td>
                          <td className="px-3 py-4 text-right font-mono font-black text-stone-800">
                            {paidCost > 0 ? money(paidCost, 'USD') : <span className="text-emerald-600">grátis</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-black/10 bg-black/[0.02] px-8 py-12 text-center">
                <Bot className="h-8 w-8 text-stone-600 mx-auto mb-3" />
                <p className="text-sm text-stone-600">Nenhuma chamada de IA registrada em {PERIODS[periodo].label.toLowerCase()}.</p>
                <p className="mt-1 text-xs text-stone-600">Os registros são gravados automaticamente em <code className="text-stone-600">ai_token_usage</code> (Supabase) a cada uso.</p>
              </div>
            )}

            <p className="mt-6 text-[11px] text-stone-600 leading-relaxed">
              Fonte: tabela <code className="text-stone-600">ai_token_usage</code> (registro automático em <code className="text-stone-600">src/lib/ai.ts</code>).
              Câmbio estimado: 1 USD ≈ R$ {BRL_RATE.toFixed(2)}.
            </p>
          </section>

        </div>
      </main>
    </div>
  );
}
