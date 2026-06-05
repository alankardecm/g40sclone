import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { groqClient, openaiClient } from '@/infrastructure/ai/chat-clients';
import { normalizeAssistantText } from '@/modules/chat/application/conversation-context';
import { buildAssistantSystemPrompt } from '@/modules/chat/application/assistant-prompt';
import type { ChatMessage, StructuredAssistantResponse } from '@/shared/types/chat';

type LlmContext = {
  messages: ChatMessage[];
  recentConversation: string;
  themeContext: string;
  ragContext: string;
  ragProvider: string;
  ragDiagnostics: string[];
  zabbixContext?: string | null;
  zabbixDecisionContext?: string;
};

function parseStructuredAssistantResponse(content: string): StructuredAssistantResponse {
  let parsedAnswer = content;
  let parsedConfidence: number | undefined;
  let parsedNeedsClarification = false;
  let parsedClarifyingQuestion = '';
  let parsedNextStep = '';
  let parsedSourceHint = '';

  try {
    const parsed = JSON.parse(content) as {
      answer?: string;
      confidence?: number;
      needs_clarification?: boolean;
      clarifying_question?: string;
      next_step?: string;
      source_hint?: string;
    };

    parsedAnswer = normalizeAssistantText(parsed.answer?.trim() || parsedAnswer);
    parsedConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : undefined;
    parsedNeedsClarification = Boolean(parsed.needs_clarification);
    parsedClarifyingQuestion = normalizeAssistantText(parsed.clarifying_question?.trim() || '');
    parsedNextStep = normalizeAssistantText(parsed.next_step?.trim() || '');
    parsedSourceHint = normalizeAssistantText(parsed.source_hint?.trim() || '');
  } catch {
    parsedAnswer = normalizeAssistantText(parsedAnswer);
  }

  return {
    answer: parsedAnswer,
    confidence: parsedConfidence,
    needsClarification: parsedNeedsClarification,
    clarifyingQuestion: parsedClarifyingQuestion,
    nextStep: parsedNextStep,
    sourceHint: parsedSourceHint,
  };
}

export async function generateAssistantResponse(context: LlmContext) {
  const sharedPromptInput = {
    recentConversation: context.recentConversation,
    themeContext: context.themeContext,
    ragContext: context.ragContext,
    ragProvider: context.ragProvider,
    ragDiagnostics: context.ragDiagnostics,
    zabbixContext: context.zabbixContext,
    zabbixDecisionContext: context.zabbixDecisionContext,
  };

  try {
    const completion = await groqClient.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: buildAssistantSystemPrompt({
            ...sharedPromptInput,
            engineLabel: 'Groq',
          }),
        },
        ...((context.messages || []) as ChatCompletionMessageParam[]),
      ],
    });

    return parseStructuredAssistantResponse(completion.choices[0]?.message?.content || '');
  } catch (error) {
    console.error('ERRO NO GROQ, EXECUTANDO FALLBACK PARA OPENAI:', error);

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: buildAssistantSystemPrompt({
            ...sharedPromptInput,
            engineLabel: 'OpenAI Fallback',
          }),
        },
        ...((context.messages || []) as ChatCompletionMessageParam[]),
      ],
    });

    return parseStructuredAssistantResponse(completion.choices[0]?.message?.content || '');
  }
}
