import { z } from 'zod';

export const SentimentResultSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  score: z.number(),
  rationale: z.string().optional(),
});

export type SentimentResult = z.infer<typeof SentimentResultSchema>;

export const DailySummaryResultSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  score: z.number(),
  summary: z.string(),
  highlights: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  recommended_action: z.string().optional(),
  dominant_topic: z.string().optional(),
});

export type DailySummaryResult = z.infer<typeof DailySummaryResultSchema>;

export const GroupConversationBriefResultSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  score: z.number(),
  title: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  next_steps: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  dominant_topic: z.string().optional(),
  audio_script: z.string(),
});

export type GroupConversationBriefResult = z.infer<typeof GroupConversationBriefResultSchema>;

export const WaConversationLifecycleReviewSchema = z.object({
  protocol_mentions: z.array(z.object({
    protocol: z.string(),
    message_id: z.string(),
    evidence: z.string().optional(),
    confidence: z.number().optional(),
  })).optional(),
  session_reviews: z.array(z.object({
    session_id: z.string(),
    status: z.enum(['open', 'closed', 'uncertain']).optional(),
    close_reason: z.string().optional(),
    confidence: z.number().optional(),
    summary: z.string().optional(),
  })).optional(),
  missed_risks: z.array(z.string()).optional(),
});

export type WaConversationLifecycleReview = z.infer<typeof WaConversationLifecycleReviewSchema>;
