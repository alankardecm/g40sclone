// Lógica ÚNICA de CSAT — compartilhada pelo dashboard (/api/datalake/query),
// pelo bot de WhatsApp (evolution-bot) e por qualquer outro consumidor.
// Replica o KPI_CS do Power BI: classificação SÓ por texto da resposta
// (no Power Query a nota virou texto e o fallback numérico nunca dispara),
// base = Promotores+Neutros+Detratores, e usa a pesquisa ATIVA mais recente da área.
import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/infrastructure/datalake/mysql-client';

type Pool = ReturnType<typeof getMysqlPool>;

// Classificação por texto (igual ao bucket do Power Query). Retorna NULL quando
// não há palavra-chave (ex: "Regular", comentários soltos) → excluído da base.
export const CSAT_BUCKET_SQL = `CASE
  WHEN LOWER(resposta_texto) REGEXP 'insatisf|ruim|n[ãa]o' THEN 'Detrator'
  WHEN LOWER(resposta_texto) REGEXP 'muito|completamente|excelente|bom|satisfeito' THEN 'Promotor'
  WHEN LOWER(resposta_texto) REGEXP 'neutro|parcialmente' THEN 'Neutro'
  ELSE NULL END`;

// Pesquisa ATIVA mais recente da área (ex: "suporte" -> "CSAT-Suporte-V33.2"),
// excluindo versões de contingência antigas.
export async function resolveActiveSurvey(pool: Pool, escapedTable: string, areaKw: string): Promise<string> {
  if (!areaKw) return '';
  const [sv] = await pool.query<RowDataPacket[]>(
    `SELECT nome_pesquisa FROM ${escapedTable}
       WHERE ativo = 1 AND LOWER(nome_pesquisa) LIKE ?
       GROUP BY nome_pesquisa ORDER BY MAX(data_resposta) DESC LIMIT 1`,
    [`%${areaKw.toLowerCase()}%`],
  );
  return String((sv as RowDataPacket[])[0]?.nome_pesquisa ?? '');
}

export type CsatSummary = {
  area: string;
  survey: string;
  value: number;
  base: number;
  promotores: number;
  neutros: number;
  detratores: number;
};

// CSAT de UMA área num período (KPI). Mesma fonte/regra do dashboard e do PBI.
export async function getCsatSummary(opts: {
  area: string;
  dateFrom?: string;
  dateTo?: string;
  table?: string;
}): Promise<CsatSummary> {
  const table = opts.table || 'csat_pesquisas';
  const pool = getMysqlPool();
  const escapedTable = mysql.escapeId(table);
  const areaKw = (opts.area || '').trim().toLowerCase();
  const survey = await resolveActiveSurvey(pool, escapedTable, areaKw);

  const wheres = ['ativo = 1'];
  const params: string[] = [];
  if (survey) { wheres.push('nome_pesquisa = ?'); params.push(survey); }
  else if (areaKw) { wheres.push('LOWER(nome_pesquisa) LIKE ?'); params.push(`%${areaKw}%`); }
  if (opts.dateFrom) { wheres.push('data_resposta >= ?'); params.push(opts.dateFrom); }
  if (opts.dateTo) {
    wheres.push('data_resposta <= ?');
    params.push(/^\d{4}-\d{2}-\d{2}$/.test(opts.dateTo) ? `${opts.dateTo} 23:59:59` : opts.dateTo);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ROUND(SUM(b='Promotor')/NULLIF(SUM(b IS NOT NULL),0)*100,1) AS value,
            SUM(b IS NOT NULL) AS base, SUM(b='Promotor') AS promotores,
            SUM(b='Neutro') AS neutros, SUM(b='Detrator') AS detratores
       FROM (SELECT ${CSAT_BUCKET_SQL} AS b FROM ${escapedTable} WHERE ${wheres.join(' AND ')}) t`,
    params,
  );
  const r = (rows as RowDataPacket[])[0] ?? {};
  return {
    area: areaKw,
    survey,
    value: Number(r.value ?? 0),
    base: Number(r.base ?? 0),
    promotores: Number(r.promotores ?? 0),
    neutros: Number(r.neutros ?? 0),
    detratores: Number(r.detratores ?? 0),
  };
}

// Texto formatado para WhatsApp (negrito *, itálico _).
export function formatCsatReply(periodLabel: string, s: CsatSummary, target = 80): string {
  const areaCap = s.area ? s.area.charAt(0).toUpperCase() + s.area.slice(1) : 'área';
  if (!s.base) {
    return `Não encontrei pesquisas de CSAT de *${areaCap}*${periodLabel ? ` em ${periodLabel}` : ''}. Confira a área (suporte, financeiro ou comercial) e o período.`;
  }
  const pct = s.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const metaTxt = s.value >= target
    ? `✅ na/acima da meta de ${target}%`
    : `⚠️ ${(target - s.value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% abaixo da meta de ${target}%`;
  return [
    `📊 *CSAT ${areaCap}${periodLabel ? ` — ${periodLabel}` : ''}*`,
    `*${pct}%* (${metaTxt})`,
    '',
    `▲ ${s.promotores.toLocaleString('pt-BR')} promotores`,
    `● ${s.neutros.toLocaleString('pt-BR')} neutros`,
    `▼ ${s.detratores.toLocaleString('pt-BR')} detratores`,
    `Base: ${s.base.toLocaleString('pt-BR')} pesquisas válidas`,
    s.survey ? `_Pesquisa: ${s.survey}_` : '',
  ].filter(Boolean).join('\n');
}
