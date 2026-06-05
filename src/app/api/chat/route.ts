import { generateAssistantResponse } from '@/modules/chat/application/assistant-response';
import {
  buildAdaptiveRetrievalQuery,
  buildRecentConversation,
} from '@/modules/chat/application/conversation-context';
import { buildOperationalZabbixAnswer } from '@/modules/chat/application/operational-answer';
import { buildProcedureAnswerFromRagContext } from '@/modules/chat/application/procedure-answer';
import { buildRagContext } from '@/modules/rag/application/build-rag-context';
import { buildZabbixContext } from '@/modules/zabbix/application/build-zabbix-context';
import { buildZabbixDecisionContext } from '@/modules/zabbix/application/build-zabbix-decision-context';
import type { ChatMessage } from '@/shared/types/chat';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { messages, sessionTopic, sessionSummary } = (await req.json()) as {
    messages: ChatMessage[];
    sessionTopic?: string;
    sessionSummary?: string;
  };

  const normalizedMessages = messages || [];
  const recentConversation = buildRecentConversation(normalizedMessages);
  const retrievalQuery = buildAdaptiveRetrievalQuery(normalizedMessages, sessionTopic, sessionSummary);
  const themeContext = sessionTopic?.trim() || sessionSummary?.trim() || 'Sem tema explicitado.';

  const [ragContext, zabbixContext] = await Promise.all([
    buildRagContext(retrievalQuery),
    buildZabbixContext(retrievalQuery),
  ]);

  const deterministicProcedureAnswer = buildProcedureAnswerFromRagContext(ragContext, retrievalQuery);
  if (deterministicProcedureAnswer) {
    return Response.json({
      answer: deterministicProcedureAnswer.answer,
      confidence: deterministicProcedureAnswer.confidence,
      needsClarification: deterministicProcedureAnswer.needsClarification,
      clarifyingQuestion: deterministicProcedureAnswer.clarifyingQuestion,
      nextStep: deterministicProcedureAnswer.nextStep,
      sourceHint: deterministicProcedureAnswer.sourceHint,
      provider: ragContext.provider,
      diagnostics: [...ragContext.diagnostics, 'Resposta procedural montada diretamente a partir dos passos do contexto.'],
      sources: ragContext.sources,
    });
  }

  const operationalZabbixAnswer = zabbixContext
    ? buildOperationalZabbixAnswer(zabbixContext, retrievalQuery)
    : null;

  const zabbixDecisionContext = buildZabbixDecisionContext(operationalZabbixAnswer);

  const assistantResponse = await generateAssistantResponse({
    messages: normalizedMessages,
    recentConversation,
    themeContext,
    ragContext: ragContext.context,
    ragProvider: ragContext.provider,
    ragDiagnostics: ragContext.diagnostics,
    zabbixContext,
    zabbixDecisionContext,
  });

  return Response.json({
    answer: assistantResponse.answer,
    confidence: assistantResponse.confidence,
    needsClarification: assistantResponse.needsClarification,
    clarifyingQuestion: assistantResponse.clarifyingQuestion,
    nextStep: assistantResponse.nextStep,
    sourceHint: assistantResponse.sourceHint,
    provider: ragContext.provider,
    diagnostics: ragContext.diagnostics,
    sources: ragContext.sources,
  });
}
