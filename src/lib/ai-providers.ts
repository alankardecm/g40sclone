// Registry central dos provedores de IA da cascata do Hub.
// Fonte única para: ordem da cascata, classificação free/pago, nome da env var
// e limites conhecidos do free tier (usados na seção "Chaves & Cotas de IA").
//
// Cascata atual (ver src/lib/ai.ts): NVIDIA → Groq → Gemini → OpenRouter → OpenAI

export type AiProviderId = 'nvidia' | 'groq' | 'gemini' | 'openrouter' | 'openai';

export type AiTier = 'free' | 'paid';

export interface AiProviderInfo {
  id: AiProviderId;
  /** Rótulo exibido na UI. Casa com o `provider` gravado em ai_token_usage. */
  label: string;
  /** Nome da variável de ambiente que guarda a chave. */
  envKey: string;
  /** Classificação de cobrança no uso atual da Netturbo. */
  tier: AiTier;
  /** Posição na cascata (1 = primeiro a ser tentado). */
  cascadeOrder: number;
  /** Modelo padrão usado pelo Hub neste provedor. */
  defaultModel: string;
  /** Limite conhecido do free tier (para exibição). Ajuste conforme o plano. */
  freeLimit?: { value: number; unit: string; window: string };
  /** Observação curta exibida no card. */
  notes?: string;
}

export const AI_PROVIDERS: AiProviderInfo[] = [
  {
    id: 'nvidia',
    label: 'NVIDIA',
    envKey: 'NVIDIA_API_KEY',
    tier: 'free',
    cascadeOrder: 1,
    defaultModel: 'meta/llama-3.1-8b-instruct',
    freeLimit: { value: 40, unit: 'req', window: 'minuto' },
    notes: '1º na cascata. NIM free tier (rate limit por minuto).',
  },
  {
    id: 'groq',
    label: 'Groq',
    envKey: 'GROQ_API_KEY',
    tier: 'free',
    cascadeOrder: 2,
    defaultModel: 'llama-3.3-70b-versatile',
    freeLimit: { value: 100000, unit: 'tokens', window: 'dia' },
    notes: '2º na cascata. Free tier: ~100k tokens/dia (TPD).',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    envKey: 'GOOGLE_API_KEY',
    tier: 'free',
    cascadeOrder: 3,
    defaultModel: 'gemini-2.0-flash',
    freeLimit: { value: 200, unit: 'req', window: 'dia' },
    notes: '3º na cascata. Free tier: limite diário de requisições.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    tier: 'free',
    cascadeOrder: 4,
    defaultModel: 'openrouter/free',
    freeLimit: { value: 50, unit: 'req', window: 'dia' },
    notes: '4º na cascata. Modelos :free (limite diário por conta).',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    tier: 'paid',
    cascadeOrder: 5,
    defaultModel: 'gpt-4o-mini',
    notes: 'Último recurso (pago). Também usado em Whisper e Vision.',
  },
];

/** Mapa rótulo/normalizado → provider, para casar com o campo `provider` do banco. */
export function normalizeProviderName(raw: string): AiProviderId | null {
  const v = raw.trim().toLowerCase();
  if (v.includes('nvidia')) return 'nvidia';
  if (v.includes('groq')) return 'groq';
  if (v.includes('gemini') || v.includes('google')) return 'gemini';
  if (v.includes('openrouter')) return 'openrouter';
  if (v.includes('openai')) return 'openai';
  return null;
}

/**
 * Extrai o tempo de espera (em segundos) de mensagens de erro 429 dos provedores.
 * Cobre os formatos observados em produção:
 *   - Groq:   "Please try again in 1m35.904s"
 *   - Gemini: "Please retry in 39.949736878s"  /  "retryDelay":"39s"
 *   - OpenAI: "Please try again in 20s"
 * Retorna null quando não encontra um tempo explícito.
 */
export function parseRetryAfterSeconds(message: string): number | null {
  if (!message) return null;

  // "try again in 1m35.904s" / "retry in 39.9s" / "try again in 20s"
  const phrase = message.match(
    /(?:try again|retry)\s+(?:in|after)\s+(?:(\d+)\s*m)?\s*([\d.]+)?\s*s/i
  );
  if (phrase) {
    const minutes = phrase[1] ? Number(phrase[1]) : 0;
    const seconds = phrase[2] ? Number(phrase[2]) : 0;
    const total = minutes * 60 + seconds;
    if (Number.isFinite(total) && total > 0) return total;
  }

  // Formato estruturado do Gemini: "retryDelay":"39s"
  const retryDelay = message.match(/retryDelay"?\s*:\s*"?(\d+)s/i);
  if (retryDelay) {
    const seconds = Number(retryDelay[1]);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }

  return null;
}
