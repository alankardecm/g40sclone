import { classifySentimentWithGroq } from '@/lib/ai';
import {
  buildFlags,
  buildSummary,
  detectSentiment,
  detectTopic,
  detectUrgency,
  extractKeywords,
} from '@/lib/waMonitor';
import type { InboundMessageAnalysis } from '@/shared/types/communication';

export async function analyzeInboundMessage(text: string): Promise<InboundMessageAnalysis> {
  const localSentiment = detectSentiment(text);
  const groqSentiment = await classifySentimentWithGroq(text);
  const sentiment = groqSentiment?.sentiment || localSentiment.sentiment;
  const sentimentScore = typeof groqSentiment?.score === 'number' ? groqSentiment.score : localSentiment.sentimentScore;
  const keywords = extractKeywords(text);
  const topic = detectTopic(text);
  const urgency = detectUrgency(keywords, sentimentScore);
  const flags = buildFlags(keywords, sentimentScore);
  const summary = buildSummary(text, keywords);
  const modelUsed = groqSentiment ? 'ai-sentiment-v1' : 'heuristic-v1';

  return {
    sentiment,
    sentimentScore,
    keywords,
    topic,
    urgency,
    flags,
    summary,
    modelUsed,
  };
}
