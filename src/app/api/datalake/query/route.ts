import { NextRequest, NextResponse } from 'next/server';
import { getMysqlPool, isMysqlConfigured, isSafeTableName, isTableAllowed } from '@/infrastructure/datalake/mysql-client';
import { auth } from '@/lib/auth';
import { getUserAllowedTables } from '@/lib/user-registry';
import { hasBypassToken } from '@/lib/dashboard-cors';
import type { RowDataPacket } from 'mysql2';
import mysql from 'mysql2';
import type { FilterOperator, FilterWarning, QueryResult, TimeBucket } from '@/shared/types/dashboard';
import { isIdentifierColumnName, isMoneyColumnName } from '@/lib/dashboard-widget-intelligence';
import { CSAT_BUCKET_SQL, resolveActiveSurvey } from '@/lib/csat';

const SAFE_AGGREGATIONS = ['count', 'count_distinct', 'sum', 'avg', 'min', 'max', 'none', 'ratio', 'csat'] as const;
const SAFE_TIME_BUCKETS = ['none', 'day', 'month', 'year'] as const;

type SafeAgg = (typeof SAFE_AGGREGATIONS)[number];

function isSafeAggregation(value: unknown): value is SafeAgg {
  return SAFE_AGGREGATIONS.includes(value as SafeAgg);
}

function isSafeTimeBucket(value: unknown): value is TimeBucket {
  return SAFE_TIME_BUCKETS.includes(value as TimeBucket);
}

function buildTimeExpression(column: string, bucket: TimeBucket) {
  if (bucket === 'day') return `DATE_FORMAT(${column}, '%Y-%m-%d')`;
  if (bucket === 'month') return `DATE_FORMAT(${column}, '%Y-%m')`;
  if (bucket === 'year') return `DATE_FORMAT(${column}, '%Y')`;
  return column;
}

function canFormatAsDate(column: string) {
  return /(data|dt_|_at$|competencia|vencimento|inicio|fim|conclusao|abertura|resposta|evento)/i.test(column);
}

async function getFilterDistinctValues(
  pool: ReturnType<typeof getMysqlPool>,
  escapedTable: string,
  column: string,
): Promise<string[]> {
  try {
    const escapedCol = mysql.escapeId(column);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT ${escapedCol} AS v FROM ${escapedTable} WHERE ${escapedCol} IS NOT NULL ORDER BY ${escapedCol} LIMIT 25`,
    );
    return (rows as Array<Record<string, unknown>>)
      .map((r) => String(r.v ?? ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isMysqlConfigured()) {
      return NextResponse.json<QueryResult>({ ok: false, data: [], error: 'MySQL nao configurado.' }, { status: 503 });
    }

    const body = (await request.json()) as {
      table?: string;
      xColumn?: string;
      metric?: string;
      aggregation?: string;
      limit?: number;
      filterColumn?: string;
      filterOperator?: FilterOperator;
      filterValue?: string;
      filter2Column?: string;
      filter2Operator?: FilterOperator;
      filter2Value?: string;
      dateColumn?: string;
      dateFrom?: string;
      dateTo?: string;
      timeBucket?: TimeBucket;
      numericBucketSize?: number;
      // ratio aggregation: SUM(CASE WHEN ratioColumn <op> ratioValue THEN 1 ELSE 0 END) / COUNT(*) * multiplier
      ratioColumn?: string;
      ratioValue?: string;
      ratioOperator?: string;
      ratioMultiplier?: number;
    };

    const {
      table = '',
      xColumn = '',
      metric = '',
      aggregation = 'count',
      limit = 20,
      filterColumn = '',
      filterOperator = 'eq',
      filterValue: rawFilterValue = '',
      filter2Column = '',
      filter2Operator = 'eq',
      filter2Value: rawFilter2Value = '',
      dateColumn = '',
      dateFrom = '',
      dateTo = '',
      timeBucket = 'none',
      numericBucketSize,
      ratioColumn = '',
      ratioValue = '',
      ratioOperator = 'eq',
      ratioMultiplier = 100,
    } = body;

    const filterValue = String(rawFilterValue ?? '');
    const filter2Value = String(rawFilter2Value ?? '');

    if (!table || !isSafeTableName(table) || !isTableAllowed(table)) {
      return NextResponse.json<QueryResult>({ ok: false, data: [], error: 'Tabela invalida ou nao permitida.' }, { status: 400 });
    }

    // Verifica permissão de tabela por usuário (bypass via token para testes)
    if (!hasBypassToken(request)) {
      const session = await auth();
      const userEmail = session?.user?.email ?? '';
      const userTables = await getUserAllowedTables(userEmail);
      if (userTables !== 'all' && !userTables.includes(table)) {
        return NextResponse.json<QueryResult>({ ok: false, data: [], error: 'Acesso negado a esta tabela.' }, { status: 403 });
      }
    }

    if (!isSafeAggregation(aggregation)) {
      return NextResponse.json<QueryResult>({ ok: false, data: [], error: 'Agregacao invalida.' }, { status: 400 });
    }

    if (!isSafeTimeBucket(timeBucket)) {
      return NextResponse.json<QueryResult>({ ok: false, data: [], error: 'Agrupamento temporal invalido.' }, { status: 400 });
    }

    const safeXColumn = isSafeTableName(xColumn) ? xColumn : '';
    // count_distinct de uma coluna identificadora (ex.: cod_cliente) é legítimo
    // (clientes únicos); só bloqueamos identificadores em SUM/AVG/etc.
    const safeMetric = metric && isSafeTableName(metric) && (aggregation === 'count_distinct' || !isIdentifierColumnName(metric)) ? metric : '';
    const safeFilterColumn = filterColumn && isSafeTableName(filterColumn) ? filterColumn : '';
    const safeFilter2Column = filter2Column && isSafeTableName(filter2Column) ? filter2Column : '';
    const safeDateColumn = dateColumn && isSafeTableName(dateColumn) ? dateColumn : '';
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 200);
    const safeNumericBucketSize =
      numericBucketSize && Number.isFinite(Number(numericBucketSize)) && Number(numericBucketSize) > 0
        ? Math.round(Number(numericBucketSize))
        : safeXColumn && isMoneyColumnName(safeXColumn)
          ? 100
          : 0;
    const aggregationFallback = aggregation !== 'none' && aggregation !== 'count' && aggregation !== 'count_distinct' && !safeMetric;
    const effectiveAggregation = aggregationFallback ? 'count' : aggregation;
    const configWarning = aggregationFallback
      ? `${aggregation.toUpperCase()} sem coluna numerica: usando COUNT(*) como fallback. Selecione uma coluna de valor no editor do widget.`
      : undefined;
    // Bug 2 fix: when xColumn is empty but timeBucket+dateColumn are set, auto-promote dateColumn as x-axis
    const autoPromotedDateAxis = !safeXColumn && timeBucket !== 'none' && !!safeDateColumn;
    const effectiveXColumn = autoPromotedDateAxis ? safeDateColumn : safeXColumn;
    const effectiveTimeBucket: TimeBucket = autoPromotedDateAxis
      ? timeBucket
      : effectiveXColumn && canFormatAsDate(effectiveXColumn)
        ? timeBucket === 'none' ? 'month' : timeBucket
        : 'none';

    const pool = getMysqlPool();
    const escapedTable = mysql.escapeId(table);

    // ── CSAT (replica o KPI_CS do Power BI) ────────────────────────────────
    // Fonte: csat_pesquisas. Classificação SÓ por texto da resposta (igual ao
    // Power Query do PBI, onde a nota é texto e o fallback numérico nunca dispara).
    // Base = Promotores+Neutros+Detratores; respostas sem palavra-chave saem fora.
    if (aggregation === 'csat') {
      // Áreas: filterValue pode ter 1 ("suporte") ou várias separadas por vírgula
      // ("suporte,financeiro,comercial") para comparação multi-série.
      const areasRaw = String(rawFilterValue || rawFilter2Value || '').trim().toLowerCase();
      const areas = areasRaw.split(',').map((s) => s.trim()).filter(Boolean);
      const bucket = CSAT_BUCKET_SQL;
      const pct = `ROUND(SUM(b = 'Promotor') / NULLIF(SUM(b IS NOT NULL), 0) * 100, 1)`;
      const breakdown = `SUM(b IS NOT NULL) AS base, SUM(b = 'Promotor') AS promotores, SUM(b = 'Neutro') AS neutros, SUM(b = 'Detrator') AS detratores`;
      const csatBucket: TimeBucket = isSafeTimeBucket(timeBucket) && timeBucket !== 'none' ? timeBucket : 'none';
      const labelExpr = buildTimeExpression(mysql.escapeId('data_resposta'), csatBucket === 'none' ? 'month' : csatBucket);
      const mapRow = (r: Record<string, unknown>) => ({
        value: Number(r.value ?? 0), base: Number(r.base ?? 0),
        promotores: Number(r.promotores ?? 0), neutros: Number(r.neutros ?? 0), detratores: Number(r.detratores ?? 0),
      });
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

      // Pesquisa ATIVA mais recente de uma área (lógica única em lib/csat)
      const activeSurvey = (kw: string) => resolveActiveSurvey(pool, escapedTable, kw);
      // Filtros de período comuns (data_resposta)
      const dateClauses: string[] = [];
      const dateParams: string[] = [];
      if (dateFrom) { dateClauses.push('data_resposta >= ?'); dateParams.push(dateFrom); }
      if (dateTo) { dateClauses.push('data_resposta <= ?'); dateParams.push(/^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? `${dateTo} 23:59:59` : dateTo); }
      const areaWhere = (survey: string, kw: string) => {
        const w = ['ativo = 1']; const p: string[] = [];
        if (survey) { w.push('nome_pesquisa = ?'); p.push(survey); }
        else if (kw) { w.push('LOWER(nome_pesquisa) LIKE ?'); p.push(`%${kw}%`); }
        w.push(...dateClauses); p.push(...dateParams);
        return { sql: `WHERE ${w.join(' AND ')}`, params: p };
      };

      // ── COMPARAÇÃO MULTI-ÁREA: uma linha por área no mesmo gráfico ──
      if (areas.length > 1 && csatBucket !== 'none') {
        const built = await Promise.all(areas.map(async (a) => {
          const survey = await activeSurvey(a);
          const { sql, params: p } = areaWhere(survey, a);
          const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT label, ${pct} AS value, ${breakdown}
               FROM (SELECT ${labelExpr} AS label, ${bucket} AS b FROM ${escapedTable} ${sql}) t
              GROUP BY label ORDER BY label ASC`,
            p,
          );
          return { area: a, survey, rows: rows as Array<Record<string, unknown>> };
        }));
        const labelSet = new Set<string>();
        built.forEach((s) => s.rows.forEach((r) => labelSet.add(String(r.label ?? ''))));
        const labels = [...labelSet].sort();
        const series = built.map((s) => {
          const byLabel = new Map(s.rows.map((r) => [String(r.label ?? ''), r]));
          return {
            name: cap(s.area),
            survey: s.survey,
            data: labels.map((l) => (byLabel.has(l) ? Number(byLabel.get(l)!.value ?? 0) : null)),
            breakdown: labels.map((l) => (byLabel.has(l) ? mapRow(byLabel.get(l)!) : null)),
          };
        });
        return NextResponse.json({ ok: true, multi: true, labels, series });
      }

      // ── ÁREA ÚNICA: série mensal ou KPI ──
      const kw = areas[0] ?? '';
      const survey = await activeSurvey(kw);
      const { sql: whereSqlCsat, params } = areaWhere(survey, kw);
      if (csatBucket !== 'none') {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT label, ${pct} AS value, ${breakdown}
             FROM (SELECT ${labelExpr} AS label, ${bucket} AS b FROM ${escapedTable} ${whereSqlCsat}) t
            GROUP BY label ORDER BY label ASC LIMIT ${safeLimit}`,
          params,
        );
        const data = (rows as Array<Record<string, unknown>>).map((r) => ({ label: String(r.label ?? ''), ...mapRow(r) }));
        return NextResponse.json<QueryResult>({ ok: true, data, queryLabel: survey || kw });
      }
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${pct} AS value, ${breakdown} FROM (SELECT ${bucket} AS b FROM ${escapedTable} ${whereSqlCsat}) t`,
        params,
      );
      const r0 = (rows as Array<Record<string, unknown>>)[0] ?? {};
      return NextResponse.json<QueryResult>({ ok: true, data: [{ label: survey || 'CSAT', ...mapRow(r0) }], queryLabel: survey || kw });
    }

    const whereClauses: string[] = [];
    const whereParams: string[] = [];

    function buildFilterClause(column: string, operator: string, value: string): { sql: string; params: string[] } {
      const escaped = mysql.escapeId(column);
      // 'in': lista separada por vírgula (os valores não contêm vírgula) -> IN (?,?,..)
      if (operator === 'in') {
        const vals = value.split(',').map((v) => v.trim()).filter(Boolean);
        if (vals.length === 0) return { sql: '1=1', params: [] };
        return { sql: `${escaped} IN (${vals.map(() => '?').join(',')})`, params: vals };
      }
      if (operator === 'contains') return { sql: `${escaped} LIKE ?`, params: [`%${value}%`] };
      if (operator === 'neq') return { sql: `${escaped} != ?`, params: [value] };
      if (operator === 'gte') return { sql: `${escaped} >= ?`, params: [value] };
      if (operator === 'lte') return { sql: `${escaped} <= ?`, params: [value] };
      if (operator === 'gt') return { sql: `${escaped} > ?`, params: [value] };
      if (operator === 'lt') return { sql: `${escaped} < ?`, params: [value] };
      return { sql: `${escaped} = ?`, params: [value] };
    }

    if (safeFilterColumn && filterValue) {
      const { sql, params } = buildFilterClause(safeFilterColumn, filterOperator, filterValue);
      whereClauses.push(sql);
      whereParams.push(...params);
    }

    if (safeFilter2Column && filter2Value) {
      const { sql, params } = buildFilterClause(safeFilter2Column, filter2Operator, filter2Value);
      whereClauses.push(sql);
      whereParams.push(...params);
    }

    if (safeDateColumn && dateFrom) {
      whereClauses.push(`${mysql.escapeId(safeDateColumn)} >= ?`);
      whereParams.push(dateFrom);
    }

    if (safeDateColumn && dateTo) {
      whereClauses.push(`${mysql.escapeId(safeDateColumn)} <= ?`);
      // Bug 1 fix: extend bare date to end-of-day so DATETIME rows are not excluded
      whereParams.push(/^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? `${dateTo} 23:59:59` : dateTo);
    }

    const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

    if (effectiveAggregation === 'none') {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM ${escapedTable}${whereSql} LIMIT ${safeLimit}`,
        whereParams
      );

      const rawColumns = rows.length > 0 ? Object.keys(rows[0] as object) : [];

      return NextResponse.json<QueryResult>({
        ok: true,
        data: [],
        rawRows: rows as Array<Record<string, unknown>>,
        rawColumns,
      });
    }

    const safeRatioColumn = ratioColumn && isSafeTableName(ratioColumn) ? ratioColumn : '';
    const safeRatioMultiplier = Number.isFinite(Number(ratioMultiplier)) ? Number(ratioMultiplier) : 100;
    const SAFE_RATIO_OPS: Record<string, string> = { eq:'=', neq:'!=', gte:'>=', lte:'<=', gt:'>', lt:'<' };
    const safeRatioOp = SAFE_RATIO_OPS[ratioOperator] ?? '=';

    function buildRatioExpr(): string {
      if (!safeRatioColumn) return 'COUNT(*) AS value';
      const ec = mysql.escapeId(safeRatioColumn);
      return `ROUND(SUM(CASE WHEN ${ec} ${safeRatioOp} ? THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) * ${safeRatioMultiplier}, 2) AS value`;
    }

    if (!effectiveXColumn) {
      const isRatio = effectiveAggregation === 'ratio';
      const selectExpr = isRatio
        ? buildRatioExpr()
        : effectiveAggregation === 'count'
          ? 'COUNT(*) AS value'
          : effectiveAggregation === 'count_distinct' && safeMetric
            ? `COUNT(DISTINCT ${mysql.escapeId(safeMetric)}) AS value`
            : safeMetric
              ? `${effectiveAggregation.toUpperCase()}(${mysql.escapeId(safeMetric)}) AS value`
              : 'COUNT(*) AS value';
      const ratioParams = isRatio && safeRatioColumn ? [String(ratioValue)] : [];

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${selectExpr} FROM ${escapedTable}${whereSql}`,
        [...ratioParams, ...whereParams]
      );

      const mainValue = Number(rows[0]?.value ?? 0);

      let filterWarning: FilterWarning | undefined;
      if (mainValue === 0 && safeFilterColumn && filterOperator === 'eq' && filterValue) {
        const existingValues = await getFilterDistinctValues(pool, escapedTable, safeFilterColumn);
        if (existingValues.length > 0 && !existingValues.some((v) => v.toLowerCase() === String(filterValue).toLowerCase())) {
          filterWarning = { column: safeFilterColumn, operator: filterOperator, value: String(filterValue), existingValues };
        }
      }

      return NextResponse.json<QueryResult>({
        ok: true,
        data: [{ label: 'resultado', value: mainValue }],
        filterWarning,
        // Bug 2 fix: warn when timeBucket is configured but there's no axis to group by
        configWarning: configWarning ?? (timeBucket !== 'none' ? 'Agrupamento Temporal requer um Eixo ou Coluna de Período' : undefined),
      });
    }

    const escapedX = mysql.escapeId(effectiveXColumn);
    const isNumericBucket = safeNumericBucketSize > 0;
    const labelExpression = isNumericBucket
      ? `FLOOR(${escapedX} / ${safeNumericBucketSize}) * ${safeNumericBucketSize}`
      : buildTimeExpression(escapedX, effectiveTimeBucket);

    const isRatioWithX = effectiveAggregation === 'ratio';
    const ratioParamsX = isRatioWithX && safeRatioColumn ? [String(ratioValue)] : [];

    const selectExpr = isRatioWithX
      ? `${labelExpression} AS label, ${buildRatioExpr()}`
      : effectiveAggregation === 'count'
        ? `${labelExpression} AS label, COUNT(*) AS value`
        : effectiveAggregation === 'count_distinct' && safeMetric
          ? `${labelExpression} AS label, COUNT(DISTINCT ${mysql.escapeId(safeMetric)}) AS value`
          : safeMetric
            ? `${labelExpression} AS label, ${effectiveAggregation.toUpperCase()}(${mysql.escapeId(safeMetric)}) AS value`
            : `${labelExpression} AS label, COUNT(*) AS value`;

    const orderBySql = isNumericBucket || effectiveTimeBucket !== 'none' ? 'label ASC' : 'value DESC';

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${selectExpr}
       FROM ${escapedTable}${whereSql}
       GROUP BY 1
       ORDER BY ${orderBySql}
       LIMIT ${safeLimit}`,
      [...ratioParamsX, ...whereParams]
    );

    const data = (rows as Array<Record<string, unknown>>).map((row) => ({
      label: isNumericBucket
        ? `${Number(row.label).toLocaleString('pt-BR')} – ${(Number(row.label) + safeNumericBucketSize - 1).toLocaleString('pt-BR')}`
        : String(row.label ?? ''),
      value: Number(row.value ?? 0),
    }));

    let filterWarning: FilterWarning | undefined;
    if (data.length === 0 && safeFilterColumn && filterOperator === 'eq' && filterValue) {
      const existingValues = await getFilterDistinctValues(pool, escapedTable, safeFilterColumn);
      if (existingValues.length > 0 && !existingValues.some((v) => v.toLowerCase() === String(filterValue).toLowerCase())) {
        filterWarning = { column: safeFilterColumn, operator: filterOperator, value: String(filterValue), existingValues };
      }
    }

    return NextResponse.json<QueryResult>({ ok: true, data, filterWarning, configWarning });
  } catch (error) {
    return NextResponse.json<QueryResult>(
      { ok: false, data: [], error: error instanceof Error ? error.message : 'Erro na query.' },
      { status: 500 }
    );
  }
}
