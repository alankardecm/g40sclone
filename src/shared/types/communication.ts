export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export type InboundMessageAnalysis = {
  sentiment: SentimentLabel;
  sentimentScore: number;
  keywords: string[];
  topic: string;
  urgency: string;
  flags: string[];
  summary: string;
  modelUsed: string;
};

export type DailySummaryInput = {
  groupName: string;
  totalMessages: number;
  positive: number;
  neutral: number;
  negative: number;
  urgentCount: number;
  topKeywords: Array<{ term: string; count: number }>;
};

export type DailySummaryResult = {
  executiveSummary: string;
  sentimentLabel: SentimentLabel;
  primaryKeyword: string;
  urgencyLabel: string;
  summaryModelUsed: string;
};

export type ConversationBriefInput = {
  groupName: string;
  days: number;
  messageCount: number;
  participantCount: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  urgentCount: number;
  topKeywords: Array<{ term: string; count: number }>;
  topParticipants: Array<{ name: string; count: number }>;
};
