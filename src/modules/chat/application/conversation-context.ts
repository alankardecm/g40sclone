import type { ChatMessage } from '@/shared/types/chat';

export function buildRecentConversation(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-4)
    .map((message) => {
      const label = message.role === 'user' ? 'COLABORADOR' : 'ASSISTENTE';
      return `${label}: ${message.content?.trim() || ''}`;
    })
    .join('\n');
}

export function buildAdaptiveRetrievalQuery(
  messages: ChatMessage[],
  sessionTopic?: string,
  sessionSummary?: string
) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content?.trim() || '';
  const normalized = lastUserMessage
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const isLikelyFollowUp =
    normalized.length <= 80 &&
    /^(e|e o|e a|desde quando|quando|qual|qual o|qual a|isso|esse|essa|ele|ela|tem|esta|estao|ainda|continua|permanece|segue|e agora|e quanto)/.test(
      normalized
    ) &&
    !/^(como\s+configurar|como\s+instalar|como\s+acessar|como\s+alterar|como\s+ajustar|como\s+fazer|como\s+trocar|como\s+abrir|como\s+fechar)/.test(
      normalized
    );

  if (isLikelyFollowUp) {
    const hint = [sessionTopic?.trim(), sessionSummary?.trim()].filter(Boolean).join(' | ');
    if (hint) {
      return `${lastUserMessage}\nCONTEXTO ANTERIOR: ${hint}`;
    }
  }

  return lastUserMessage;
}

export function normalizeAssistantText(value: string) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
