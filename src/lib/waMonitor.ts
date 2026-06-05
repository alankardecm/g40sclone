export type SentimentLabel = 'positive' | 'neutral' | 'negative';

const POSITIVE_WORDS = [
  'sucesso',
  'ok',
  'concluida',
  'concluido',
  'bom',
  'boa',
  'aprovado',
  'resolveu',
  'feito',
  'finalizado',
];

const NEGATIVE_WORDS = [
  'erro',
  'falha',
  'queda',
  'caiu',
  'urgente',
  'problema',
  'atraso',
  'reclama',
  'travou',
  'pendencia',
];

const CRITICAL_WORDS = [
  'urgente',
  'erro',
  'falha',
  'queda',
  'pendencia',
];

const KEYWORD_RULES = [
  'prazo',
  'urgente',
  'erro',
  'queda',
  'link',
  'cliente',
  'sinal',
  'fibra',
  'olt',
  'reuniao',
  'pendencia',
  'liberacao',
];

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

export function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function detectSentiment(text: string) {
  const normalized = normalizeText(text);
  let score = 0;

  POSITIVE_WORDS.forEach((word) => {
    if (normalized.includes(word)) score += 0.18;
  });

  NEGATIVE_WORDS.forEach((word) => {
    if (normalized.includes(word)) score -= 0.24;
  });

  if (normalized.includes('!')) score -= 0.05;
  if (normalized.includes('?')) score -= 0.02;

  const hasCriticalWord = includesAny(normalized, CRITICAL_WORDS);
  const hasStrongNegative = includesAny(normalized, ['erro', 'falha', 'queda', 'pendencia']);

  if (normalized.length < 10 && !hasCriticalWord) {
    score *= 0.5;
  }

  if (hasStrongNegative) {
    score = Math.min(score, -0.6);
  }

  score = Math.max(-1, Math.min(1, Number(score.toFixed(2))));

  let sentiment: SentimentLabel = 'neutral';
  if (score >= 0.2) sentiment = 'positive';
  if (score <= -0.2 || hasStrongNegative) sentiment = 'negative';

  return { sentiment, sentimentScore: score };
}

export function extractKeywords(text: string) {
  const normalized = normalizeText(text);
  const found = KEYWORD_RULES.filter((word) => normalized.includes(word));
  return [...new Set(found)];
}

export function detectTopic(text: string) {
  const normalized = normalizeText(text);
  if (normalized.includes('reuniao')) return 'reuniao';
  if (normalized.includes('cliente')) return 'cliente';
  if (includesAny(normalized, ['erro', 'queda', 'sinal', 'fibra'])) return 'incidente';
  if (includesAny(normalized, ['prazo', 'pendencia'])) return 'operacao';
  return 'geral';
}

export function detectUrgency(keywords: string[], sentimentScore: number) {
  if (keywords.some((word) => CRITICAL_WORDS.includes(word))) return 'critica';
  if (sentimentScore <= -0.5) return 'alta';
  if (sentimentScore <= -0.2) return 'media';
  return 'baixa';
}

export function buildSummary(text: string, keywords: string[]) {
  const trimmed = text.trim();
  const summary = trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
  if (!keywords.length) return summary;
  return `${summary} [${keywords.slice(0, 3).join(', ')}]`;
}

export function buildFlags(keywords: string[], sentimentScore: number) {
  const flags: string[] = [];
  if (sentimentScore <= -0.2) flags.push('sentimento_negativo');
  if (keywords.includes('cliente')) flags.push('cliente_citado');
  if (keywords.includes('prazo')) flags.push('prazo_citado');
  if (keywords.includes('urgente')) flags.push('urgente');
  if (keywords.includes('erro') || keywords.includes('queda')) flags.push('incidente');
  if (keywords.some((word) => CRITICAL_WORDS.includes(word))) flags.push('palavra_critica');
  return flags;
}

export function splitConversationIdentifier(groupName?: string, groupId?: string) {
  return {
    conversationId: groupId || groupName || 'unknown',
    conversationName: groupName || groupId || 'Grupo desconhecido',
  };
}
