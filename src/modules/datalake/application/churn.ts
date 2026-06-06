// Totais de churn/retenção a partir da base operacional de protocolos (crm_solicitacoes).
// Fonte ÚNICA reutilizável — espelha as regras de negócio de /api/datalake/cancelamentos.
// Usado pelo Cockpit ISP (modules/isp). Ajuste as listas de `tipo` se o CS mudar a régua.
import { getMysqlPool } from '@/infrastructure/datalake/mysql-client';
import type { RowDataPacket } from 'mysql2';

const TABLE = 'crm_solicitacoes';

// Churn EFETIVO = baixa real do cliente (clientes únicos, por data_conclusao).
const CHURN_TIPOS = [
  'Faturamento - Efetivar Cancelamento',
  'Faturamento - Cancelar e Efetuar Retirada',
  'Cancelamento de Faturamento',
];
// DEMANDA = pedido/tratativa de cancelamento (por data_abertura).
const DEMANDA_TIPOS = [
  'Cancelamento - Relacionamento',
  'Cancelamento Distrato - Relacionamento',
  'Intenção de Cancelamento - Calculo - Pro Rata/Taxa ADM',
];
// RETIDOS = cliente que reverteu o cancelamento (save).
const RETIDO_TIPOS = ['Cancelamento Revertido - Relacionamento'];

const ph = (arr: string[]) => arr.map(() => '?').join(',');

export type ChurnTotals = {
  churnClientes: number;
  demandaProtocolos: number;
  demandaClientes: number;
  retidosClientes: number;
  taxaRetencao: number;
};

export async function getChurnTotals(opts: { from?: string; to?: string } = {}): Promise<ChurnTotals> {
  const { from = '', to = '' } = opts;
  const pool = getMysqlPool();

  const dateClause = (col: string, params: string[]) => {
    const parts: string[] = [];
    if (from) { parts.push(`${col} >= ?`); params.push(from); }
    if (to) { parts.push(`${col} <= ?`); params.push(/^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to} 23:59:59` : to); }
    return parts.length ? ' AND ' + parts.join(' AND ') : '';
  };

  async function total(tipos: string[], dateCol: string, expr: string): Promise<number> {
    const params = [...tipos];
    const dc = dateClause(dateCol, params);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${expr} AS v FROM ${TABLE}
        WHERE tipo IN (${ph(tipos)}) AND ${dateCol} IS NOT NULL${dc}`,
      params,
    );
    return Number((rows as RowDataPacket[])[0]?.v ?? 0);
  }

  const [churnClientes, demandaProtocolos, demandaClientes, retidosClientes] = await Promise.all([
    total(CHURN_TIPOS, 'data_conclusao', 'COUNT(DISTINCT cod_cliente)'),
    total(DEMANDA_TIPOS, 'data_abertura', 'COUNT(*)'),
    total(DEMANDA_TIPOS, 'data_abertura', 'COUNT(DISTINCT cod_cliente)'),
    total(RETIDO_TIPOS, 'data_conclusao', 'COUNT(DISTINCT cod_cliente)'),
  ]);

  const denom = retidosClientes + churnClientes;
  const taxaRetencao = denom > 0 ? Math.round((retidosClientes / denom) * 1000) / 10 : 0;

  return { churnClientes, demandaProtocolos, demandaClientes, retidosClientes, taxaRetencao };
}
