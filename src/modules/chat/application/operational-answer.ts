import type { OperationalAnswer } from '@/shared/types/chat';

export function buildOperationalZabbixAnswer(
  zabbixContext: string,
  retrievalQuery: string
): OperationalAnswer | null {
  const executiveMatch = zabbixContext.match(/RESPOSTA_EXECUTIVA:\s*(SIM|NAO)/i);
  if (!executiveMatch) return null;

  const clientMatch = zabbixContext.match(/CLIENTE\/ALCANCE IDENTIFICADO:\s*(.+)/i);
  const evidenceMatch = zabbixContext.match(/EVIDENCIA_PRINCIPAL:\s*(.+)/i);
  const situationMatch = zabbixContext.match(/SITUACAO_CLIENTE:\s*(.+)/i);
  const classificationMatch = zabbixContext.match(/CLASSIFICACAO OPERACIONAL:\s*(.+)/i);

  const clientLabel = clientMatch?.[1]?.trim() || 'cliente';
  const evidence = evidenceMatch?.[1]?.trim() || '';
  const situation = situationMatch?.[1]?.trim() || '';
  const classification = classificationMatch?.[1]?.trim() || '';
  const isAlarmQuestion = /cliente|alarme|alarmes|status|pppoe|down|offline|caiu|desastre|evento|eventos/i.test(
    retrievalQuery
  );

  if (!isAlarmQuestion) return null;

  const hasAlarm = executiveMatch[1].toUpperCase() === 'SIM';
  const answer = hasAlarm
    ? `Sim, o ${clientLabel} possui alarme ativo ou evento critico no recorte consultado.`
    : `Nao, nao encontrei alarmes ativos ou eventos criticos para o ${clientLabel} no recorte consultado.`;

  const parts = [answer];
  if (evidence) parts.push(`Evidencia: ${evidence}`);
  if (classification) parts.push(`Classificacao: ${classification}`);
  if (situation) parts.push(`Situacao: ${situation}`);

  return {
    answer: parts.join('\n'),
    confidence: hasAlarm ? 0.97 : 0.9,
    needsClarification: false,
    clarifyingQuestion: '',
    nextStep: hasAlarm
      ? 'Abrir o host/trigger no Zabbix para validar impacto e tempo de indisponibilidade.'
      : 'Se houver um alerta esperado, valide o nome do cliente, host ou janela de tempo consultada.',
    sourceHint: 'Zabbix ao vivo',
  };
}
