import { NextRequest, NextResponse } from 'next/server';
import { getMysqlPool, isMysqlConfigured, isTableAllowed } from '@/infrastructure/datalake/mysql-client';
import { auth } from '@/lib/auth';
import { getUserAllowedTables } from '@/lib/user-registry';
import { hasBypassToken } from '@/lib/dashboard-cors';
import type { RowDataPacket } from 'mysql2';

// Painel determinístico de Cancelamentos & Churn (Dashboard Avançado).
// Fonte: crm_solicitacoes (base operacional de protocolos: tem protocolo, tipo,
// status, cod_cliente, data_abertura, data_conclusao), classificado por `tipo`.
//
// REGRAS DE NEGÓCIO — ajuste estas listas se o CS mudar a régua:
const TABLE = 'crm_solicitacoes';

// Churn EFETIVO = baixa real do cliente (clientes únicos, por data_conclusao).
// FORA: "Contratos Financeiro - Cancelamento Last Mile" (fornecedor, não cliente).
const CHURN_TIPOS = [
  'Faturamento - Efetivar Cancelamento',
  'Faturamento - Cancelar e Efetuar Retirada',
  'Cancelamento de Faturamento',
];

// DEMANDA = pedido/tratativa de cancelamento (volume de protocolos, por data_abertura).
const DEMANDA_TIPOS = [
  'Cancelamento - Relacionamento',
  'Cancelamento Distrato - Relacionamento',
  'Intenção de Cancelamento - Calculo - Pro Rata/Taxa ADM',
];

// RETIDOS = cliente que reverteu o cancelamento (save). NÃO é churn.
const RETIDO_TIPOS = ['Cancelamento Revertido - Relacionamento'];

// EXCLUÍDOS de tudo: 'NOC - Cancelamento', 'NOC - Cancelamento (Voz)' (protocolos técnicos),
// 'Contratos Financeiro - Cancelamento Last Mile' (fornecedor last mile).

const ph = (arr: string[]) => arr.map(() => '?').join(',');

type MonthRow = { mes: string; v: number };

export async function GET(request: NextRequest) {
  try {
    if (!isMysqlConfigured()) {
      return NextResponse.json({ ok: false, error: 'MySQL nao configurado.' }, { status: 503 });
    }
    if (!isTableAllowed(TABLE)) {
      return NextResponse.json({ ok: false, error: 'Tabela nao permitida.' }, { status: 400 });
    }

    // Auth: bypass por token (uso externo) ou sessão + permissão de tabela.
    if (!hasBypassToken(request)) {
      const session = await auth();
      if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
      const userTables = await getUserAllowedTables(session.user?.email ?? '');
      if (userTables !== 'all' && !userTables.includes(TABLE)) {
        return NextResponse.json({ ok: false, error: 'Acesso negado a esta tabela.' }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';

    const pool = getMysqlPool();

    // Cláusula de período opcional sobre a coluna de data informada.
    const dateClause = (col: string, params: string[]) => {
      const parts: string[] = [];
      if (from) { parts.push(`${col} >= ?`); params.push(from); }
      if (to) { parts.push(`${col} <= ?`); params.push(/^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to} 23:59:59` : to); }
      return parts.length ? ' AND ' + parts.join(' AND ') : '';
    };

    // Série mensal: agg por mês da coluna de data (apenas linhas com data preenchida).
    async function series(tipos: string[], dateCol: string, distinct: boolean): Promise<MonthRow[]> {
      const params = [...tipos];
      const dc = dateClause(dateCol, params);
      const agg = distinct ? 'COUNT(DISTINCT cod_cliente)' : 'COUNT(*)';
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT DATE_FORMAT(${dateCol}, '%Y-%m') AS mes, ${agg} AS v
           FROM ${TABLE}
          WHERE tipo IN (${ph(tipos)}) AND ${dateCol} IS NOT NULL${dc}
          GROUP BY mes ORDER BY mes`,
        params,
      );
      return (rows as Array<Record<string, unknown>>).map((r) => ({ mes: String(r.mes ?? ''), v: Number(r.v ?? 0) }));
    }

    // Total no período (DISTINCT correto sobre todo o intervalo, não soma de mensais).
    async function total(tipos: string[], dateCol: string, expr: string): Promise<number> {
      const params = [...tipos];
      const dc = dateClause(dateCol, params);
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${expr} AS v FROM ${TABLE}
          WHERE tipo IN (${ph(tipos)}) AND ${dateCol} IS NOT NULL${dc}`,
        params,
      );
      return Number((rows as Array<Record<string, unknown>>)[0]?.v ?? 0);
    }

    const [churnS, demandaS, retidoS, churnTot, demandaProt, demandaCli, retidosTot] = await Promise.all([
      series(CHURN_TIPOS, 'data_conclusao', true),
      series(DEMANDA_TIPOS, 'data_abertura', false),
      series(RETIDO_TIPOS, 'data_conclusao', true),
      total(CHURN_TIPOS, 'data_conclusao', 'COUNT(DISTINCT cod_cliente)'),
      total(DEMANDA_TIPOS, 'data_abertura', 'COUNT(*)'),
      total(DEMANDA_TIPOS, 'data_abertura', 'COUNT(DISTINCT cod_cliente)'),
      total(RETIDO_TIPOS, 'data_conclusao', 'COUNT(DISTINCT cod_cliente)'),
    ]);

    // Une os meses das três séries em uma linha por mês.
    const churnMap = new Map(churnS.map((r) => [r.mes, r.v]));
    const demandaMap = new Map(demandaS.map((r) => [r.mes, r.v]));
    const retidoMap = new Map(retidoS.map((r) => [r.mes, r.v]));
    const meses = [...new Set([...churnMap.keys(), ...demandaMap.keys(), ...retidoMap.keys()])]
      .filter(Boolean)
      .sort();
    const byMonth = meses.map((mes) => ({
      mes,
      churn: churnMap.get(mes) ?? 0,
      demanda: demandaMap.get(mes) ?? 0,
      retidos: retidoMap.get(mes) ?? 0,
    }));

    return NextResponse.json({
      ok: true,
      totals: {
        churn_clientes: churnTot,
        demanda_protocolos: demandaProt,
        demanda_clientes: demandaCli,
        retidos_clientes: retidosTot,
      },
      byMonth,
      regras: { churn: CHURN_TIPOS, demanda: DEMANDA_TIPOS, retidos: RETIDO_TIPOS },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro ao calcular cancelamentos.' },
      { status: 500 },
    );
  }
}
