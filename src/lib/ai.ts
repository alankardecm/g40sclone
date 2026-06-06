import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import OpenAI, { toFile } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  SentimentResultSchema,
  DailySummaryResultSchema,
  GroupConversationBriefResultSchema,
  WaConversationLifecycleReviewSchema,
  type WaConversationLifecycleReview,
  type GroupConversationBriefResult
} from '@/shared/schemas/ai-schemas';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeProviderName, parseRetryAfterSeconds } from '@/lib/ai-providers';

// Helper para salvar uso de tokens de IA em background no Supabase
async function logTokenUsage(params: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  operation?: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
    let cost = 0;
    const modelLower = params.model.toLowerCase();
    
    if (params.provider.toLowerCase() === 'openai') {
      if (modelLower.includes('whisper')) {
        cost = 0.006; // Custo fixo por chamada
      } else if (modelLower.includes('gpt-4o-mini')) {
        cost = ((params.inputTokens * 0.150) + (params.outputTokens * 0.600)) / 1000000;
      } else if (modelLower.includes('gpt-4o')) {
        cost = ((params.inputTokens * 2.500) + (params.outputTokens * 10.000)) / 1000000;
      } else {
        cost = ((params.inputTokens * 0.150) + (params.outputTokens * 0.600)) / 1000000;
      }
    } else if (params.provider.toLowerCase() === 'gemini' || modelLower.includes('gemini')) {
      cost = ((params.inputTokens * 0.075) + (params.outputTokens * 0.300)) / 1000000;
    } else if (params.provider.toLowerCase() === 'groq') {
      cost = ((params.inputTokens * 0.590) + (params.outputTokens * 0.790)) / 1000000;
    } else if (params.provider.toLowerCase() === 'nvidia') {
      if (modelLower.includes('8b')) {
        cost = ((params.inputTokens * 0.050) + (params.outputTokens * 0.080)) / 1000000;
      } else {
        cost = ((params.inputTokens * 0.590) + (params.outputTokens * 0.790)) / 1000000;
      }
    } else if (params.provider.toLowerCase() === 'openrouter') {
      cost = 0;
    } else {
      cost = ((params.inputTokens * 0.150) + (params.outputTokens * 0.600)) / 1000000;
    }

    await supabase.from('ai_token_usage').insert({
      project_name: params.operation ?? 'desconhecido',
      provider: params.provider,
      model: params.model,
      tokens_input: params.inputTokens,
      tokens_output: params.outputTokens,
      estimated_cost_usd: cost
    });
  } catch (err) {
    console.error('Failed to log token usage to Supabase:', err);
  }
}

export const model = new ChatOpenAI({
  modelName: 'gpt-4o',
  temperature: 0.1,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

export const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const groqApiKey = process.env.GROQ_API_KEY;
const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiModel = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
const googleApiKey = process.env.GOOGLE_API_KEY;
const nvidiaApiKey = process.env.NVIDIA_API_KEY;
const nvidiaWppModel = process.env.NVIDIA_WPP_MODEL || 'meta/llama-3.1-8b-instruct';
const nvidiaModel = process.env.NVIDIA_MODEL || nvidiaWppModel;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const openRouterModel = process.env.OPENROUTER_MODEL || 'openrouter/free';

const groqClient = groqApiKey
  ? new OpenAI({
    apiKey: groqApiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  })
  : null;

export const openAiClient = openAiApiKey
  ? new OpenAI({
    apiKey: openAiApiKey,
  })
  : null;

export async function transcribeAudio(audioBuffer: Buffer | Blob | File): Promise<string | null> {
  if (!openAiClient) return null;

  try {
    const transcription = await openAiClient.audio.transcriptions.create({
      file: await toFile(audioBuffer, 'audio.ogg', { type: 'audio/ogg' }),
      model: 'whisper-1',
      language: 'pt',
    });
    logTokenUsage({
      provider: 'OpenAI',
      model: 'whisper-1',
      inputTokens: 0,
      outputTokens: 0,
      operation: 'transcricao-audio',
    }).then();
    return transcription.text;
  } catch (err) {
    logAiPromptError('OpenAI Whisper', err);
    return null;
  }
}

export async function analyzeImage(imageBuffer: Buffer, prompt: string): Promise<string | null> {
  if (!openAiClient) return null;

  try {
    const base64Image = imageBuffer.toString('base64');
    const response = await openAiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content || null;
    if (response.usage) {
      logTokenUsage({
        provider: 'OpenAI',
        model: 'gpt-4o',
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        operation: 'analise-imagem',
      }).then();
    }
    return content;
  } catch (err) {
    logAiPromptError('OpenAI Vision', err);
    return null;
  }
}

const nvidiaClient = nvidiaApiKey
  ? new OpenAI({
    apiKey: nvidiaApiKey,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  })
  : null;

const openRouterClient = openRouterApiKey
  ? new OpenAI({
    apiKey: openRouterApiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || process.env.HUB_PUBLIC_URL || 'http://localhost:4100',
      'X-Title': process.env.NEXT_PUBLIC_APP_NAME || 'AM OS',
    },
  })
  : null;

const genAI = googleApiKey ? new GoogleGenerativeAI(googleApiKey) : null;

export type { GroupConversationBriefResult };

type ChatOptions = {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  operation?: string;
};

function extractJsonBlock(content: string) {
  const trimmed = content.trim();
  const direct = trimmed.match(/\{[\s\S]*\}/);
  return direct ? direct[0] : trimmed;
}

function parseJsonWithZod<T>(content: string, schema: z.ZodSchema<T>): T | null {
  try {
    const jsonStr = extractJsonBlock(content);
    const parsed = JSON.parse(jsonStr);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// Persiste um evento de cota/rate-limit (429) no Supabase, calculando quando a
// cota deve voltar a partir da mensagem do provedor (ex.: "try again in 15m27s").
// Alimenta a seção "Chaves & Cotas de IA" da aba Custos.
function logQuotaEvent(params: {
  provider: string;
  message: string;
  status?: unknown;
  model?: string;
  operation?: string;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const retrySeconds = parseRetryAfterSeconds(params.message);
    const retryAt = retrySeconds ? new Date(Date.now() + retrySeconds * 1000).toISOString() : null;
    const normalized = normalizeProviderName(params.provider);

    void supabase
      .from('ai_provider_quota_events')
      .insert({
        provider: normalized ?? params.provider,
        model: params.model ?? null,
        operation: params.operation ?? null,
        status_code: typeof params.status === 'number' ? params.status : 429,
        retry_after_seconds: retrySeconds,
        retry_at: retryAt,
        message: params.message.slice(0, 1000),
      })
      .then(({ error }) => {
        if (error) console.error('Failed to log quota event to Supabase:', error.message);
      });
  } catch (err) {
    console.error('Failed to log quota event to Supabase:', err);
  }
}

function logAiPromptError(provider: string, error: unknown, context?: { model?: string; operation?: string }) {
  const status = typeof error === 'object' && error !== null && 'status' in error ? (error as { status?: unknown }).status : undefined;
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : undefined;
  const message = error instanceof Error ? error.message : String(error);

  if (status === 429 || code === 'rate_limit_exceeded') {
    console.warn(`${provider} quota/rate limit na chamada de IA: ${message}`);
    logQuotaEvent({ provider, message, status, model: context?.model, operation: context?.operation });
    return;
  }

  console.error(`Error in ${provider} prompt:`, error);
}

async function runGroqJsonPrompt<T>(options: ChatOptions, schema: z.ZodSchema<T>): Promise<T | null> {
  if (!groqClient || !groqApiKey) return null;

  try {
    const response = await groqClient.chat.completions.create({
      model: groqModel,
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 1024,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    if (response.usage) {
      logTokenUsage({
        provider: 'Groq',
        model: groqModel,
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        operation: options.operation,
      }).then();
    }
    return parseJsonWithZod(content, schema);
  } catch (err) {
    logAiPromptError('Groq', err, { model: groqModel, operation: options.operation });
    return null;
  }
}

async function runOpenAiCompatibleJsonPrompt<T>(params: {
  provider: string;
  client: OpenAI | null;
  model: string;
  options: ChatOptions;
  schema: z.ZodSchema<T>;
}): Promise<T | null> {
  if (!params.client) return null;

  try {
    const response = await params.client.chat.completions.create({
      model: params.model,
      temperature: params.options.temperature ?? 0,
      max_tokens: params.options.maxTokens ?? 1024,
      messages: [
        { role: 'system', content: params.options.system },
        { role: 'user', content: params.options.user },
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    if (response.usage) {
      logTokenUsage({
        provider: params.provider,
        model: params.model,
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        operation: params.options.operation,
      }).then();
    }
    return parseJsonWithZod(content, params.schema);
  } catch (err) {
    logAiPromptError(params.provider, err, { model: params.model, operation: params.options.operation });
    return null;
  }
}

async function runNvidiaJsonPrompt<T>(options: ChatOptions, schema: z.ZodSchema<T>, model = nvidiaModel): Promise<T | null> {
  return runOpenAiCompatibleJsonPrompt({
    provider: 'NVIDIA',
    client: nvidiaClient,
    model,
    options,
    schema,
  });
}

async function runOpenRouterJsonPrompt<T>(options: ChatOptions, schema: z.ZodSchema<T>): Promise<T | null> {
  return runOpenAiCompatibleJsonPrompt({
    provider: 'OpenRouter',
    client: openRouterClient,
    model: openRouterModel,
    options,
    schema,
  });
}

async function runGeminiJsonPrompt<T>(options: ChatOptions, schema: z.ZodSchema<T>): Promise<T | null> {
  if (!genAI || !googleApiKey) return null;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(`${options.system}\n\n${options.user}`);
    const content = result.response.text();
    if (!content) return null;
    if (result.response.usageMetadata) {
      logTokenUsage({
        provider: 'Gemini',
        model: 'gemini-2.0-flash',
        inputTokens: result.response.usageMetadata.promptTokenCount ?? 0,
        outputTokens: result.response.usageMetadata.candidatesTokenCount ?? 0,
        operation: options.operation,
      }).then();
    }
    return parseJsonWithZod(content, schema);
  } catch (err) {
    logAiPromptError('Gemini', err, { model: 'gemini-2.0-flash', operation: options.operation });
    return null;
  }
}

async function runOpenAiJsonPrompt<T>(options: ChatOptions, schema: z.ZodSchema<T>): Promise<T | null> {
  if (!openAiClient || !openAiApiKey) return null;

  try {
    const response = await openAiClient.chat.completions.create({
      model: openAiModel,
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens ?? 1024,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user },
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    if (response.usage) {
      logTokenUsage({
        provider: 'OpenAI',
        model: openAiModel,
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        operation: options.operation,
      }).then();
    }
    return parseJsonWithZod(content, schema);
  } catch (err) {
    logAiPromptError('OpenAI', err, { model: openAiModel, operation: options.operation });
    return null;
  }
}

export function buildSentimentPrompt(text: string) {
  return {
    system:
      'Voce classifica sentimento de mensagens curtas de grupos internos de WhatsApp. Responda somente com JSON valido, sem markdown, sem comentario e sem texto extra. Os campos obrigatorios sao sentiment, score e rationale. sentiment deve ser positive, neutral ou negative. score deve variar de -1 a 1. Considere ofensas, pressao, incidentes e prazo como negativo. Considere resolucao, confirmacao e progresso como positivo.',
    user: JSON.stringify({
      task: 'classify_sentiment',
      text,
      output_format: {
        sentiment: 'positive | neutral | negative',
        score: 'number from -1 to 1',
        rationale: 'short explanation in Portuguese',
      },
    }),
  };
}

export function buildDailySummaryPrompt(input: {
  groupName: string;
  date: string;
  messageCount: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  urgentCount: number;
  topKeywords: Array<{ term: string; count: number }>;
  sampleMessages: Array<{
    author?: string;
    text: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    keywords?: string[];
    created_at?: string;
  }>;
  contextDocs?: string[];
}) {
  return {
    system:
      `Voce gera resumo diario operacional de um grupo interno de WhatsApp. Responda somente com JSON valido, sem markdown, sem comentario e sem texto extra. Use somente as evidencias fornecidas. Seja objetivo, claro e voltado para operacao. Os campos obrigatorios sao sentiment, score e summary. Pode incluir highlights, keywords, risks, recommended_action e dominant_topic. Nao invente fatos. Nao cite nomes de pessoas se nao forem relevantes.
      ${input.contextDocs?.length ? '\nUse o seguinte CONTEXTO TECNICO para enriquecer sua analise:\n' + input.contextDocs.join('\n---\n') : ''}`,
    user: JSON.stringify({
      task: 'generate_daily_summary',
      group_name: input.groupName,
      date: input.date,
      metrics: {
        message_count: input.messageCount,
        sentiment_breakdown: input.sentimentBreakdown,
        urgent_count: input.urgentCount,
        top_keywords: input.topKeywords,
      },
      sample_messages: input.sampleMessages,
      output_format: {
        sentiment: 'positive | neutral | negative',
        score: 'number from -1 to 1',
        summary: 'short executive summary in Portuguese',
        highlights: ['array of short bullet-like phrases'],
        keywords: ['array of 3 to 8 keywords'],
        risks: ['array of operational risks if any'],
        recommended_action: 'one short recommended action',
        dominant_topic: 'one short topic label',
      },
    }),
  };
}

export function buildConversationBriefPrompt(input: {
  groupName: string;
  days: number;
  messageCount: number;
  participantCount: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  urgentCount: number;
  topKeywords: Array<{ term: string; count: number }>;
  topParticipants: Array<{ name: string; count: number }>;
  sampleMessages: Array<{
    author?: string;
    text: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    keywords?: string[];
    created_at?: string;
  }>;
  contextDocs?: string[];
}) {
  return {
    system:
      `Voce gera um resumo consolidado das conversas de um grupo de WhatsApp para leitura rapida e narracao em audio. Responda somente com JSON valido, sem markdown, sem comentario e sem texto extra. Use apenas as evidencias fornecidas. Nao invente fatos. Seja claro, objetivo e operacional. O campo audio_script deve soar como um mini boletim falado em portugues do Brasil, com 45 a 90 segundos.
      ${input.contextDocs?.length ? '\nUse o seguinte CONTEXTO TECNICO para enriquecer sua analise e o script de audio:\n' + input.contextDocs.join('\n---\n') : ''}`,
    user: JSON.stringify({
      task: 'generate_group_conversation_brief',
      group_name: input.groupName,
      analysis_window_days: input.days,
      metrics: {
        message_count: input.messageCount,
        participant_count: input.participantCount,
        sentiment_breakdown: input.sentimentBreakdown,
        urgent_count: input.urgentCount,
        top_keywords: input.topKeywords,
        top_participants: input.topParticipants,
      },
      sample_messages: input.sampleMessages,
      output_format: {
        sentiment: 'positive | neutral | negative',
        score: 'number from -1 to 1',
        title: 'short title in Portuguese',
        summary: 'concise paragraph in Portuguese with the main storyline of the period',
        highlights: ['array of short bullet-like highlights'],
        risks: ['array of risks or tensions if any'],
        next_steps: ['array of recommended next steps if any'],
        keywords: ['array of 3 to 8 keywords'],
        dominant_topic: 'one short topic label',
        audio_script: 'podcast-like but concise spoken script in Portuguese for TTS',
      },
    }),
  };
}

export async function classifySentimentWithGroq(text: string) {
  const prompt = { ...buildSentimentPrompt(text), operation: 'sentimento' };
  const nvidiaResult = await runNvidiaJsonPrompt(prompt, SentimentResultSchema, nvidiaWppModel);
  if (nvidiaResult) return nvidiaResult;
  const groqResult = await runGroqJsonPrompt(prompt, SentimentResultSchema);
  if (groqResult) return groqResult;
  const geminiResult = await runGeminiJsonPrompt(prompt, SentimentResultSchema);
  if (geminiResult) return geminiResult;
  const openRouterResult = await runOpenRouterJsonPrompt(prompt, SentimentResultSchema);
  if (openRouterResult) return openRouterResult;
  return runOpenAiJsonPrompt(prompt, SentimentResultSchema);
}

export async function summarizeDailyGroupWithGroq(input: {
  groupName: string;
  date: string;
  messageCount: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  urgentCount: number;
  topKeywords: Array<{ term: string; count: number }>;
  sampleMessages: Array<{
    author?: string;
    text: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    keywords?: string[];
    created_at?: string;
  }>;
  contextDocs?: string[];
}) {
  const prompt = { ...buildDailySummaryPrompt(input), operation: 'resumo-diario' };
  const nvidiaResult = await runNvidiaJsonPrompt(prompt, DailySummaryResultSchema);
  if (nvidiaResult) return nvidiaResult;
  const groqResult = await runGroqJsonPrompt(prompt, DailySummaryResultSchema);
  if (groqResult) return groqResult;

  const geminiResult = await runGeminiJsonPrompt(prompt, DailySummaryResultSchema);
  if (geminiResult) return geminiResult;

  const openRouterResult = await runOpenRouterJsonPrompt(prompt, DailySummaryResultSchema);
  if (openRouterResult) return openRouterResult;

  return runOpenAiJsonPrompt(prompt, DailySummaryResultSchema);
}

export async function summarizeConversationBrief(input: {
  groupName: string;
  days: number;
  messageCount: number;
  participantCount: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  urgentCount: number;
  topKeywords: Array<{ term: string; count: number }>;
  topParticipants: Array<{ name: string; count: number }>;
  sampleMessages: Array<{
    author?: string;
    text: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    keywords?: string[];
    created_at?: string;
  }>;
  contextDocs?: string[];
}): Promise<GroupConversationBriefResult | null> {
  const prompt = { ...buildConversationBriefPrompt(input), operation: 'resumo-conversa' };
  const nvidiaResult = await runNvidiaJsonPrompt(prompt, GroupConversationBriefResultSchema);
  if (nvidiaResult) return nvidiaResult;

  // Try Groq first (Speed/Cost)
  const groqResult = await runGroqJsonPrompt(prompt, GroupConversationBriefResultSchema);
  if (groqResult) return groqResult;

  // Try Gemini 2.0 Flash (Resilience/Cost)
  const geminiResult = await runGeminiJsonPrompt(prompt, GroupConversationBriefResultSchema);
  if (geminiResult) return geminiResult;

  const openRouterResult = await runOpenRouterJsonPrompt(prompt, GroupConversationBriefResultSchema);
  if (openRouterResult) return openRouterResult;

  // Fallback to OpenAI
  return runOpenAiJsonPrompt(prompt, GroupConversationBriefResultSchema);
}

export async function reviewWaConversationLifecycleWithAi(input: {
  messages: Array<{
    id: string;
    group_name: string;
    author?: string | null;
    text: string;
    timestamp: number;
  }>;
  sessions: Array<{
    id: string;
    group_name: string;
    status: string;
    started_at: string;
    closed_at?: string | null;
    protocols: string[];
    message_ids: string[];
  }>;
}): Promise<WaConversationLifecycleReview | null> {
  const prompt = {
    system:
      'Voce audita conversas operacionais de WhatsApp. Responda somente com JSON valido. Use apenas as mensagens fornecidas. Procure protocolos, chamados, tickets, OS, notificacoes e numeros operacionais associados a atendimento. Nao invente protocolos. Se houver duvida, use confidence menor. Tambem revise se uma sessao parece aberta, fechada ou incerta com base em mensagens de encerramento ou pendencia.',
    user: JSON.stringify({
      task: 'review_whatsapp_conversation_lifecycle',
      rules: {
        protocol_examples: [
          '#protocolo 123456',
          'protocolo: 123456',
          'chamado 123456',
          'ticket 123456',
          'OS 123456',
          'notificacao 11307087',
        ],
        do_not_extract: [
          'telefone sem contexto de atendimento',
          'jid de grupo',
          'data',
          'hora',
          'coordenada geografica',
          'valor financeiro sem indicio de chamado',
        ],
      },
      detected_sessions: input.sessions,
      messages: input.messages.map((message) => ({
        ...message,
        text: message.text.slice(0, 320),
      })),
      output_format: {
        protocol_mentions: [
          {
            protocol: 'normalized protocol value',
            message_id: 'message id where it appears',
            evidence: 'short copied evidence from message',
            confidence: '0 to 1',
          },
        ],
        session_reviews: [
          {
            session_id: 'session id from detected_sessions',
            status: 'open | closed | uncertain',
            close_reason: 'short reason in Portuguese',
            confidence: '0 to 1',
            summary: 'short operational summary',
          },
        ],
        missed_risks: ['short alerts about ambiguous cases'],
      },
    }),
    maxTokens: 1800,
    temperature: 0,
    operation: 'auditoria-ciclo',
  };

  const groqResult = await runGroqJsonPrompt(prompt, WaConversationLifecycleReviewSchema);
  if (groqResult) return groqResult;

  const nvidiaResult = await runNvidiaJsonPrompt(prompt, WaConversationLifecycleReviewSchema);
  if (nvidiaResult) return nvidiaResult;

  const geminiResult = await runGeminiJsonPrompt(prompt, WaConversationLifecycleReviewSchema);
  if (geminiResult) return geminiResult;

  const openRouterResult = await runOpenRouterJsonPrompt(prompt, WaConversationLifecycleReviewSchema);
  if (openRouterResult) return openRouterResult;

  return runOpenAiJsonPrompt(prompt, WaConversationLifecycleReviewSchema);
}
