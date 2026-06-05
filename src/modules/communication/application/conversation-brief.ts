import { summarizeConversationBrief } from '@/lib/ai';
import type { ConversationBriefInput } from '@/shared/types/communication';

function formatSentiment(value: string | null | undefined) {
  const map: Record<string, string> = {
    positive: 'Positivo',
    neutral: 'Neutro',
    negative: 'Negativo',
  };
  return map[String(value || '').toLowerCase()] ?? 'Neutro';
}

function buildLocalConversationBrief(input: ConversationBriefInput) {
  const sentiment =
    input.sentimentBreakdown.negative > input.sentimentBreakdown.positive
      ? 'negative'
      : input.sentimentBreakdown.positive > input.sentimentBreakdown.negative
        ? 'positive'
        : 'neutral';
  const topKeyword = input.topKeywords[0]?.term || 'operacao';
  const secondKeyword = input.topKeywords[1]?.term;
  const topParticipant = input.topParticipants[0]?.name || 'time';
  const title = `${input.groupName}: resumo dos ultimos ${input.days} dias`;
  const topicText = secondKeyword ? `${topKeyword} e ${secondKeyword}` : topKeyword;
  const riskText =
    input.urgentCount > 0
      ? `Foram identificados ${input.urgentCount} sinais de urgencia no periodo.`
      : 'Nao houve sinais relevantes de urgencia no periodo.';
  const summary = [
    `O grupo ${input.groupName} teve ${input.messageCount} mensagens nos ultimos ${input.days} dias, com participacao de ${input.participantCount} pessoas.`,
    `O assunto dominante girou em torno de ${topicText}.`,
    `O sentimento predominante foi ${formatSentiment(sentiment)}.`,
    riskText,
    `${topParticipant} aparece entre os participantes mais ativos do periodo.`,
  ].join(' ');

  return {
    sentiment,
    score: sentiment === 'negative' ? -0.2 : sentiment === 'positive' ? 0.2 : 0,
    title,
    summary,
    highlights: [
      `${input.messageCount} mensagens analisadas`,
      `${input.participantCount} participantes ativos`,
      `Tema dominante: ${topicText}`,
    ],
    risks: input.urgentCount > 0 ? [riskText] : [],
    next_steps: [
      'Validar os pontos recorrentes do periodo com o time responsavel.',
      'Usar o CSV completo quando for necessario aprofundar casos especificos.',
    ],
    keywords: input.topKeywords.slice(0, 5).map((item) => item.term),
    dominant_topic: topKeyword,
    audio_script: `Resumo do grupo ${input.groupName}. Nos ultimos ${input.days} dias tivemos ${input.messageCount} mensagens com ${input.participantCount} participantes. O tema mais recorrente foi ${topicText}. O sentimento geral ficou em ${formatSentiment(sentiment)}. ${riskText} Esse foi o panorama principal do periodo.`,
    model_used: 'local-conversation-brief-v1',
  };
}

export async function generateConversationBrief(input: ConversationBriefInput & {
  sampleMessages: Array<{
    author?: string;
    text: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    keywords?: string[];
    created_at?: string;
  }>;
  contextDocs?: string[];
}) {
  const aiBrief = await summarizeConversationBrief({
    groupName: input.groupName,
    days: input.days,
    messageCount: input.messageCount,
    participantCount: input.participantCount,
    sentimentBreakdown: input.sentimentBreakdown,
    urgentCount: input.urgentCount,
    topKeywords: input.topKeywords,
    topParticipants: input.topParticipants,
    sampleMessages: input.sampleMessages,
    contextDocs: input.contextDocs,
  });

  return aiBrief || buildLocalConversationBrief(input);
}

