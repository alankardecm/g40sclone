// Copilot do Cockpit ISP: lê o snapshot operacional (NOC + churn + CSAT) e devolve
// um resumo executivo + lista de prioridades de ação. Usa Groq quando disponível;
// caso contrário (sem chave ou erro), cai num resumo determinístico baseado em regras.
import { groqClient } from '@/infrastructure/ai/chat-clients';
import type { IspCopilot } from '@/shared/types/isp';
import type { IspCockpitData } from '@/modules/isp/application/isp-cockpit';

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const CSAT_META = 80;

function buildFallback(d: IspCockpitData): IspCopilot {
  const prioridades: string[] = [];

  if (d.noc.state === 'ok') {
    if (d.noc.disasters > 0) {
      prioridades.push(`NOC crítico: ${d.noc.disasters} desastre(s) ativos e ${d.noc.hostsDown} host(s) fora do ar — priorizar restauração agora.`);
    } else if (d.noc.highSeverity > 0) {
      prioridades.push(`NOC: ${d.noc.highSeverity} alerta(s) de severidade alta abertos — triar antes que virem incidente.`);
    }
  }
  if (d.churn.state === 'ok' && d.churn.demandaClientes > 0) {
    prioridades.push(`${d.churn.demandaClientes} cliente(s) pediram cancelamento no período (taxa de save atual ${d.churn.taxaRetencao}%) — acionar retenção proativa.`);
  }
  if (d.csat.state === 'ok') {
    d.csat.areas
      .filter((a) => a.value < CSAT_META || a.detratores > 0)
      .forEach((a) => prioridades.push(`CSAT de ${a.area} em ${a.value}% (meta ${CSAT_META}%), com ${a.detratores} detrator(es) — revisar atendimento da área.`));
  }
  if (prioridades.length === 0) {
    prioridades.push('Sem alertas críticos no momento. Manter monitoramento de NOC, churn e CSAT.');
  }

  const partes: string[] = [];
  if (d.noc.state === 'ok') partes.push(`${d.noc.totalProblems} problema(s) de rede`);
  if (d.churn.state === 'ok') partes.push(`${d.churn.churnClientes} baixa(s) no período`);
  if (d.csat.state === 'ok' && d.csat.areas.length) {
    const media = Math.round((d.csat.areas.reduce((s, a) => s + a.value, 0) / d.csat.areas.length) * 10) / 10;
    partes.push(`CSAT médio ${media}%`);
  }
  const resumo = partes.length
    ? `Panorama do período: ${partes.join(', ')}.`
    : 'Dados operacionais indisponíveis (verifique as conexões de Zabbix e MySQL).';

  return { source: 'fallback', resumo, prioridades };
}

export async function generateIspCopilot(d: IspCockpitData): Promise<IspCopilot> {
  if (!process.env.GROQ_API_KEY) return buildFallback(d);

  try {
    const contexto = JSON.stringify({
      periodo: d.periodo,
      noc: d.noc.state === 'ok'
        ? { problemas: d.noc.totalProblems, desastres: d.noc.disasters, altaSeveridade: d.noc.highSeverity, hostsForaDoAr: d.noc.hostsDown, topProblemas: d.noc.topProblems.map((p) => `${p.severityLabel}: ${p.name} (${p.host})`) }
        : d.noc.state,
      churn: d.churn.state === 'ok'
        ? { baixas: d.churn.churnClientes, pedidosCancelamento: d.churn.demandaClientes, retidos: d.churn.retidosClientes, taxaRetencaoPct: d.churn.taxaRetencao }
        : d.churn.state,
      csat: d.csat.state === 'ok' ? d.csat.areas : d.csat.state,
    });

    const completion = await groqClient.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Você é o copiloto operacional de um provedor de internet (ISP). Recebe um snapshot de NOC (rede), churn (cancelamentos) e CSAT (satisfação) e responde em português do Brasil, de forma objetiva e acionável. ' +
            'Responda APENAS um JSON com o formato: {"resumo": string (1-2 frases), "prioridades": string[] (3 a 5 itens, cada um uma ação concreta, ordenados por urgência)}. ' +
            'Foque no que impacta retenção, receita e disponibilidade. Não invente números que não estão no contexto.',
        },
        { role: 'user', content: `Snapshot atual:\n${contexto}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw) as { resumo?: string; prioridades?: unknown };
    const prioridades = Array.isArray(parsed.prioridades)
      ? parsed.prioridades.map((x) => String(x)).filter(Boolean).slice(0, 5)
      : [];
    if (!parsed.resumo || prioridades.length === 0) return buildFallback(d);
    return { source: 'ai', resumo: String(parsed.resumo), prioridades };
  } catch {
    return buildFallback(d);
  }
}
