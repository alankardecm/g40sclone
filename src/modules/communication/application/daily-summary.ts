import { summarizeDailyGroupWithGroq } from '@/lib/ai';
import type { DailySummaryInput, DailySummaryResult, SentimentLabel } from '@/shared/types/communication';

function buildLocalDailySummary(input: DailySummaryInput) {
  const primary = input.topKeywords[0]?.term || 'conversa';
  const secondary = input.topKeywords[1]?.term;
  const tone =
    input.negative > input.positive
      ? 'Pressao negativa moderada'
      : input.positive > input.negative
        ? 'Tendencia positiva'
        : 'Tom equilibrado';
  const focus = secondary ? `${primary} e ${secondary}` : primary;
  const urgencyText = input.urgentCount > 0 ? 'com alertas operacionais ativos' : 'sem alertas operacionais relevantes';
  return `${input.groupName}: ${tone}, foco em ${focus}, ${urgencyText}, ${input.totalMessages} mensagens no periodo.`;
}

export async function generateDailySummary(input: {
  groupName: string;
  date: string;
  totalMessages: number;
  positive: number;
  neutral: number;
  negative: number;
  urgentCount: number;
  topKeywords: Array<{ term: string; count: number }>;
  sampleMessages: Array<{
    author?: string;
    text: string;
    sentiment?: SentimentLabel;
    keywords?: string[];
    created_at?: string;
  }>;
  contextDocs?: string[];
}): Promise<DailySummaryResult> {
  const groqSummary = await summarizeDailyGroupWithGroq({
    groupName: input.groupName,
    date: input.date,
    messageCount: input.totalMessages,
    sentimentBreakdown: {
      positive: input.positive,
      neutral: input.neutral,
      negative: input.negative,
    },
    urgentCount: input.urgentCount,
    topKeywords: input.topKeywords,
    sampleMessages: input.sampleMessages,
    contextDocs: input.contextDocs,
  });

  const dominantSentiment =
    groqSummary?.sentiment ||
    (input.negative > input.positive && input.negative > input.neutral
      ? 'negative'
      : input.positive > input.negative && input.positive > input.neutral
        ? 'positive'
        : 'neutral');

  return {
    executiveSummary:
      groqSummary?.summary ||
      buildLocalDailySummary({
        groupName: input.groupName,
        totalMessages: input.totalMessages,
        positive: input.positive,
        neutral: input.neutral,
        negative: input.negative,
        urgentCount: input.urgentCount,
        topKeywords: input.topKeywords,
      }),
    sentimentLabel: dominantSentiment,
    primaryKeyword: groqSummary?.keywords?.[0] || input.topKeywords[0]?.term || '',
    urgencyLabel: input.urgentCount > 0 ? 'critica' : dominantSentiment === 'negative' ? 'alta' : 'baixa',
    summaryModelUsed: groqSummary ? 'groq-daily-v1' : 'local-rollup-v1',
  };
}
