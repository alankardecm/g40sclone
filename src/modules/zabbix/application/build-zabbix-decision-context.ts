import type { OperationalAnswer } from '@/shared/types/chat';

export function buildZabbixDecisionContext(operationalAnswer: OperationalAnswer | null) {
  if (!operationalAnswer) return '';

  return [
    'DECISAO_EXECUTIVA_SUGERIDA_DO_ZABBIX:',
    operationalAnswer.answer,
    `CONFIDENCE_SUGERIDA: ${operationalAnswer.confidence}`,
    `NEXT_STEP_SUGERIDO: ${operationalAnswer.nextStep}`,
  ].join('\n');
}
