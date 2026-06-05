import type { WidgetConfig } from '@/shared/types/dashboard';
import { getColumnSemantic, getTableSemantic } from '@/lib/datalake-semantics';

export type ColumnInfo = { name: string; type: string };

const STARTER_WIDGET_COLORS = ['#379890', '#5b90c7', '#6aa84f', '#d4a23a'];

const DIMENSION_PRIORITY = [
  /status|situacao|estagio|prioridade|severidade/i,
  /cidade|bairro|uf|estado/i,
  /tipo|categoria|etiqueta|canal|origem/i,
  /vendedor|atendente|responsavel|equipe|agente/i,
  /plano|produto|servico|nome_pesquisa/i,
  /cliente|fornecedor/i,
];

const METRIC_PRIORITY = [
  /valor_total|valor|receita|faturamento|custo|preco|ticket|mrr|arr/i,
  /sla_segundos|tempo|duracao|mttr/i,
  /nota|score|resposta_valor/i,
  /quantidade|qtd|total|volume/i,
];

const TEMPORAL_PRIORITY = [
  /data_evento/i,
  /data_abertura/i,
  /dt_cadastro|data_cadastro/i,
  /data_resposta/i,
  /data_entrada/i,
  /data_inicio/i,
  /data_conclusao|data_fechamento|data_fim/i,
  /created_at|updated_at/i,
  /data_ingestao/i,
  /mes|ano|periodo|competencia/i,
];

export function generateWidgetId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isMoneyColumnName(name: string) {
  return /(valor|preco|receita|faturamento|custo|ticket|mrr|arr|saldo|desconto|mensalidade|salario|verba|orcamento|fatura)/i.test(name);
}

export function isIdentifierColumnName(name: string) {
  const normalized = name.toLowerCase();
  return (
    /^id($|_)/.test(normalized) ||
    /(^|_)id_/.test(normalized) ||
    /_id$/.test(normalized) ||
    /^cod(_|igo)/.test(normalized) ||
    /protocolo|uuid|chave|telefone_raw|cpf|cnpj|documento/.test(normalized)
  );
}

export function isNumericColumnType(type: string) {
  return /int|decimal|float|double|numeric|bigint|smallint|tinyint/i.test(type);
}

export function isTemporalColumnName(name: string) {
  return /(data|dt_|_at$|mes|ano|periodo|competencia|vencimento|inicio|fim|conclusao|abertura|resposta)/i.test(name);
}

export function isAnalyticMetricColumn(column: ColumnInfo) {
  if (!isNumericColumnType(column.type)) return false;
  if (isIdentifierColumnName(column.name)) return false;
  return METRIC_PRIORITY.some((pattern) => pattern.test(column.name));
}

export function isUsefulDimensionColumn(table: string, column: ColumnInfo) {
  if (isIdentifierColumnName(column.name) || isTemporalColumnName(column.name)) return false;
  if (/json|text/i.test(column.type) && !/(mttr|descricao|pergunta|resposta)/i.test(column.name)) return false;
  const semantic = getColumnSemantic(table, column.name);
  return semantic.category === 'dimension' || semantic.category === 'status';
}

function pickByPriority(columns: ColumnInfo[], patterns: RegExp[]) {
  for (const pattern of patterns) {
    const found = columns.find((column) => pattern.test(column.name));
    if (found) return found;
  }
  return columns[0];
}

export function pickDimensionColumn(table: string, columns: ColumnInfo[]) {
  const candidates = columns.filter((column) => isUsefulDimensionColumn(table, column));
  return pickByPriority(candidates, DIMENSION_PRIORITY);
}

export function pickMetricColumn(columns: ColumnInfo[]) {
  const candidates = columns.filter((column) => isAnalyticMetricColumn(column));
  return pickByPriority(candidates, METRIC_PRIORITY);
}

export function pickTemporalColumn(columns: ColumnInfo[]) {
  const candidates = columns.filter((column) => isTemporalColumnName(column.name));
  return pickByPriority(candidates, TEMPORAL_PRIORITY);
}

export function pickStatusColumn(columns: ColumnInfo[]) {
  return columns.find((column) => /status|situacao|estagio|ativo|cancelado/i.test(column.name));
}

function makeWidget(input: Omit<WidgetConfig, 'id' | 'limit' | 'color'> & { idPrefix: string; limit?: number; color?: string }): WidgetConfig {
  return {
    id: generateWidgetId(input.idPrefix),
    title: input.title,
    chartType: input.chartType,
    table: input.table,
    xColumn: input.xColumn,
    metric: input.metric ?? '',
    aggregation: input.aggregation,
    limit: input.limit ?? 12,
    color: input.color,
    filterColumn: input.filterColumn ?? '',
    filterOperator: input.filterOperator ?? 'eq',
    filterValue: input.filterValue ?? '',
    dateColumn: input.dateColumn ?? '',
    dateFrom: input.dateFrom ?? '',
    dateTo: input.dateTo ?? '',
    timeBucket: input.timeBucket ?? 'none',
  };
}

export function buildStarterWidgets(table: string, columns: ColumnInfo[]): WidgetConfig[] {
  const tableSemantic = getTableSemantic(table);
  const dimension = pickDimensionColumn(table, columns);
  const metric = pickMetricColumn(columns);
  const temporal = pickTemporalColumn(columns);
  const status = pickStatusColumn(columns);
  const widgets: WidgetConfig[] = [];

  widgets.push(makeWidget({
    idPrefix: 'total',
    title: `${tableSemantic.label} | Total de registros`,
    chartType: 'metric',
    table,
    xColumn: '',
    metric: '',
    aggregation: 'count',
    limit: 1,
    color: STARTER_WIDGET_COLORS[0],
  }));

  if (status || dimension) {
    const column = status ?? dimension;
    if (column) {
      widgets.push(makeWidget({
        idPrefix: 'distribution',
        title: `${tableSemantic.label} | Registros por ${getColumnSemantic(table, column.name).label}`,
        chartType: 'bar',
        table,
        xColumn: column.name,
        metric: '',
        aggregation: 'count',
        limit: 12,
        color: STARTER_WIDGET_COLORS[1],
      }));
    }
  }

  if (temporal) {
    widgets.push(makeWidget({
      idPrefix: 'trend',
      title: `${tableSemantic.label} | Volume mensal`,
      chartType: 'line',
      table,
      xColumn: temporal.name,
      metric: '',
      aggregation: 'count',
      limit: 18,
      color: STARTER_WIDGET_COLORS[2],
      timeBucket: 'month',
    }));
  }

  if (metric && dimension) {
    widgets.push(makeWidget({
      idPrefix: 'metric',
      title: `${tableSemantic.label} | ${getColumnSemantic(table, metric.name).label} por ${getColumnSemantic(table, dimension.name).label}`,
      chartType: 'bar',
      table,
      xColumn: dimension.name,
      metric: metric.name,
      aggregation: 'sum',
      limit: 12,
      color: STARTER_WIDGET_COLORS[3],
    }));
  }

  if (widgets.length < 4) {
    widgets.push(makeWidget({
      idPrefix: 'raw',
      title: `${tableSemantic.label} | Amostra de dados`,
      chartType: 'table',
      table,
      xColumn: '',
      metric: '',
      aggregation: 'none',
      limit: 25,
      color: STARTER_WIDGET_COLORS[widgets.length % STARTER_WIDGET_COLORS.length],
    }));
  }

  return widgets.slice(0, 4);
}
