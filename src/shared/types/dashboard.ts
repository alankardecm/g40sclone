export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'metric' | 'table';
export type AggregationType = 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max' | 'none' | 'ratio' | 'csat';
export type FilterOperator = 'eq' | 'contains' | 'neq' | 'gte' | 'lte' | 'gt' | 'lt' | 'in';
export type TimeBucket = 'none' | 'day' | 'month' | 'year';
// sm = 1 col compacto (KPI), md = 1 col padrão, lg = 2 cols, full = largura total
export type WidgetSize = 'sm' | 'md' | 'lg' | 'full';

export type WidgetConfig = {
  id: string;
  title: string;
  chartType: ChartType;
  table: string;
  xColumn: string;
  metric?: string;
  aggregation: AggregationType;
  limit: number;
  color?: string;
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
  size?: WidgetSize;
};

export type DashboardLayout = {
  id: string;
  name: string;
  description?: string;
  widgets: WidgetConfig[];
  createdAt: string;
  updatedAt: string;
};

export type FilterWarning = {
  column: string;
  operator: string;
  value: string;
  existingValues: string[];
};

export type CsatBreakdown = {
  base?: number;
  promotores?: number;
  neutros?: number;
  detratores?: number;
};

export type QueryResult = {
  ok: boolean;
  data: Array<{ label: string; value: number } & CsatBreakdown>;
  rawRows?: Array<Record<string, unknown>>;
  rawColumns?: string[];
  queryLabel?: string;
  error?: string;
  filterWarning?: FilterWarning;
  configWarning?: string;
};
