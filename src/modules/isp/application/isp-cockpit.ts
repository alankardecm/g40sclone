// Agregador do Cockpit ISP: reúne NOC (Zabbix), churn e CSAT numa visão única.
// Cada fonte degrada graciosamente: se um serviço não está configurado ou falha,
// o snapshot daquela seção vem com `state` apropriado e o resto continua.
import { getZabbixSummary, getActiveProblems, SEVERITY_LABEL } from '@/lib/zabbix';
import { isMysqlConfigured } from '@/infrastructure/datalake/mysql-client';
import { getChurnTotals } from '@/modules/datalake/application/churn';
import { getCsatSummary } from '@/lib/csat';
import type {
  IspCockpit, NocSnapshot, ChurnSnapshot, CsatSnapshot, CsatAreaSnapshot,
} from '@/shared/types/isp';

export type IspCockpitData = Omit<IspCockpit, 'copilot'>;

const CSAT_AREAS = ['suporte', 'financeiro', 'comercial'];

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function isUnconfigured(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /nao configurado|não configurado|not configured/i.test(msg);
}

async function buildNoc(): Promise<NocSnapshot> {
  try {
    const [summary, problems] = await Promise.all([getZabbixSummary(), getActiveProblems(8)]);
    const topProblems = problems.slice(0, 6).map((p) => ({
      name: p.name,
      severity: p.severity,
      severityLabel: SEVERITY_LABEL[p.severity] ?? p.severity,
      host: p.hosts?.[0]?.name ?? '—',
      since: new Date(Number(p.clock) * 1000).toISOString(),
    }));
    return {
      state: 'ok',
      totalProblems: summary.totalProblems,
      disasters: summary.disasters,
      highSeverity: summary.highSeverity,
      hostsUp: summary.hostsUp,
      hostsDown: summary.hostsDown,
      totalHosts: summary.totalHosts,
      topProblems,
    };
  } catch (err) {
    return {
      state: isUnconfigured(err) ? 'unconfigured' : 'error',
      error: err instanceof Error ? err.message : 'Falha ao consultar o Zabbix.',
      totalProblems: 0, disasters: 0, highSeverity: 0,
      hostsUp: 0, hostsDown: 0, totalHosts: 0, topProblems: [],
    };
  }
}

async function buildChurn(from: string, to: string): Promise<ChurnSnapshot> {
  if (!isMysqlConfigured()) {
    return { state: 'unconfigured', churnClientes: 0, demandaProtocolos: 0, demandaClientes: 0, retidosClientes: 0, taxaRetencao: 0 };
  }
  try {
    const t = await getChurnTotals({ from, to });
    return { state: 'ok', ...t };
  } catch (err) {
    return {
      state: 'error',
      error: err instanceof Error ? err.message : 'Falha ao calcular churn.',
      churnClientes: 0, demandaProtocolos: 0, demandaClientes: 0, retidosClientes: 0, taxaRetencao: 0,
    };
  }
}

async function buildCsat(from: string, to: string): Promise<CsatSnapshot> {
  if (!isMysqlConfigured()) {
    return { state: 'unconfigured', areas: [] };
  }
  try {
    const results = await Promise.all(
      CSAT_AREAS.map((area) => getCsatSummary({ area, dateFrom: from, dateTo: to })),
    );
    const areas: CsatAreaSnapshot[] = results
      .filter((r) => r.base > 0)
      .map((r) => ({ area: r.area, value: r.value, base: r.base, detratores: r.detratores }));
    return { state: 'ok', areas };
  } catch (err) {
    return {
      state: 'error',
      error: err instanceof Error ? err.message : 'Falha ao calcular CSAT.',
      areas: [],
    };
  }
}

export async function buildIspCockpit(opts: { from?: string; to?: string } = {}): Promise<IspCockpitData> {
  const from = opts.from || daysAgoISO(30);
  const to = opts.to || new Date().toISOString().slice(0, 10);

  const [noc, churn, csat] = await Promise.all([
    buildNoc(),
    buildChurn(from, to),
    buildCsat(from, to),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    periodo: { from, to },
    noc,
    churn,
    csat,
  };
}
