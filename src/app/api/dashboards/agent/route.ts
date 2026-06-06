import { NextRequest, NextResponse } from 'next/server';
import { openaiClient } from '@/infrastructure/ai/chat-clients';
import { getMysqlPool, isMysqlConfigured, isSafeTableName, isTableAllowed } from '@/infrastructure/datalake/mysql-client';
import { auth } from '@/lib/auth';
import { getUserAllowedTables } from '@/lib/user-registry';
import { hasBypassToken } from '@/lib/dashboard-cors';
import type { RowDataPacket } from 'mysql2';
import mysql from 'mysql2';

// ── Types ──────────────────────────────────────────────────────────
interface ChatMessage { role: 'user' | 'assistant'; content: string; }
interface TableColumn  { name: string; type: string; }
interface TableContext { name: string; rows?: number; columns?: TableColumn[]; }
interface CurrentWidget { id: string; name: string; type: string; table: string; }
interface AgentRequestBody {
  message: string;
  history?: ChatMessage[];
  tables?: TableContext[];
  widgets?: CurrentWidget[];
}
interface WidgetAction { type: 'create_widget'; config: Record<string, unknown>; }
interface AgentResponse {
  ok: boolean;
  message: string;
  actions: WidgetAction[];
  dataInsights?: Record<string, string>;
  error?: string;
}

// ── Relationship cache ─────────────────────────────────────────────
let _relCache: string | null = null;
let _relCachedAt  = 0;
const REL_TTL = 3_600_000; // 1h

async function detectRelationships(): Promise<string> {
  if (_relCache && Date.now() - _relCachedAt < REL_TTL) return _relCache;
  if (!isMysqlConfigured()) return '';

  try {
    const pool = getMysqlPool();

    // 1. FK constraints declaradas
    const [fkRows] = await pool.query<RowDataPacket[]>(`
      SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE REFERENCED_TABLE_NAME IS NOT NULL
        AND TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `);

    // 2. Colunas candidatas a join (id_*, *_id em múltiplas tabelas)
    const [colRows] = await pool.query<RowDataPacket[]>(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND (COLUMN_NAME REGEXP '^id_|_id$|^cod_|_cod$|^fk_')
      ORDER BY COLUMN_NAME, TABLE_NAME
    `);

    // Agrupar colunas candidatas por nome para encontrar implícitos
    const byCol: Record<string, string[]> = {};
    for (const r of colRows) {
      if (!byCol[r.COLUMN_NAME]) byCol[r.COLUMN_NAME] = [];
      byCol[r.COLUMN_NAME].push(r.TABLE_NAME);
    }
    const implicit = Object.entries(byCol)
      .filter(([, tables]) => tables.length > 1)
      .map(([col, tables]) => `  • ${col}: compartilhado por [${tables.join(', ')}]`);

    // 3. Montar texto
    const lines: string[] = [];

    if (fkRows.length) {
      lines.push('FOREIGN KEYS DECLARADAS:');
      for (const r of fkRows) {
        lines.push(`  • ${r.TABLE_NAME}.${r.COLUMN_NAME} → ${r.REFERENCED_TABLE_NAME}.${r.REFERENCED_COLUMN_NAME}`);
      }
    }
    if (implicit.length) {
      lines.push('COLUNAS IMPLÍCITAS DE JOIN (presentes em múltiplas tabelas):');
      lines.push(...implicit);
    }

    _relCache = lines.length ? lines.join('\n') : '(nenhum relacionamento detectado automaticamente)';
    _relCachedAt = Date.now();
    return _relCache;
  } catch {
    return '(erro ao detectar relacionamentos)';
  }
}

// ── Scalar query helper ────────────────────────────────────────────
function buildFilterClause(col: string, op: string | undefined, val: string): { sql: string; param: string } {
  const ec = mysql.escapeId(col);
  if (op === 'contains') return { sql: `${ec} LIKE ?`, param: `%${val}%` };
  if (op === 'neq')      return { sql: `${ec} != ?`,   param: val };
  if (op === 'gte')      return { sql: `${ec} >= ?`,   param: val };
  if (op === 'lte')      return { sql: `${ec} <= ?`,   param: val };
  return { sql: `${ec} = ?`, param: val };
}

async function runScalar(
  table: string, agg: string, metric?: string,
  filterCol?: string, filterOp?: string, filterVal?: string,
  dateCol?: string, dateFrom?: string, dateTo?: string,
  filter2Col?: string, filter2Op?: string, filter2Val?: string,
): Promise<number> {
  if (!isMysqlConfigured() || !isSafeTableName(table) || !isTableAllowed(table)) return 0;
  try {
    const pool = getMysqlPool();
    const et = mysql.escapeId(table);
    const sel =
      agg === 'count'          ? 'COUNT(*) AS v' :
      agg === 'count_distinct' && metric ? `COUNT(DISTINCT ${mysql.escapeId(metric)}) AS v` :
      metric && ['sum','avg','min','max'].includes(agg) ? `${agg.toUpperCase()}(${mysql.escapeId(metric)}) AS v` :
      'COUNT(*) AS v';

    const wheres: string[] = [], params: string[] = [];
    if (filterCol && isSafeTableName(filterCol) && filterVal !== undefined) {
      const { sql, param } = buildFilterClause(filterCol, filterOp, filterVal);
      wheres.push(sql); params.push(param);
    }
    if (filter2Col && isSafeTableName(filter2Col) && filter2Val !== undefined) {
      const { sql, param } = buildFilterClause(filter2Col, filter2Op, filter2Val);
      wheres.push(sql); params.push(param);
    }
    if (dateCol && isSafeTableName(dateCol)) {
      if (dateFrom) { wheres.push(`${mysql.escapeId(dateCol)} >= ?`); params.push(dateFrom); }
      if (dateTo)   { wheres.push(`${mysql.escapeId(dateCol)} <= ?`); params.push(/^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? `${dateTo} 23:59:59` : dateTo); }
    }
    const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
    const [rows] = await pool.query<RowDataPacket[]>(`SELECT ${sel} FROM ${et} ${where} LIMIT 1`, params);
    return Number((rows[0] as Record<string, unknown>)?.v ?? 0);
  } catch { return 0; }
}

// ── Date helpers ───────────────────────────────────────────────────
function buildDateContext(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const d = now.getDate();

  const today       = `${y}-${pad(m + 1)}-${pad(d)}`;
  const firstOfMonth = `${y}-${pad(m + 1)}-01`;
  const last30From  = new Date(now); last30From.setDate(d - 30);
  const last30Start = `${last30From.getFullYear()}-${pad(last30From.getMonth() + 1)}-${pad(last30From.getDate())}`;
  const last90From  = new Date(now); last90From.setDate(d - 90);
  const last90Start = `${last90From.getFullYear()}-${pad(last90From.getMonth() + 1)}-${pad(last90From.getDate())}`;
  const firstOfYear  = `${y}-01-01`;
  const prevMonthEnd = new Date(y, m, 0);
  const prevMonthStart = new Date(y, m - 1, 1);
  const prevMonthFrom = `${prevMonthStart.getFullYear()}-${pad(prevMonthStart.getMonth() + 1)}-01`;
  const prevMonthTo   = `${prevMonthEnd.getFullYear()}-${pad(prevMonthEnd.getMonth() + 1)}-${pad(prevMonthEnd.getDate())}`;

  return `DATA ATUAL: ${today} (use SEMPRE esta data como referência para períodos relativos)

DATAS PRÉ-CALCULADAS (use exatamente estes valores):
- Hoje: ${today}
- Início do mês atual: ${firstOfMonth}
- Últimos 30 dias: dateFrom="${last30Start}", dateTo="${today}"
- Últimos 90 dias: dateFrom="${last90Start}", dateTo="${today}"
- Ano atual (YTD): dateFrom="${firstOfYear}", dateTo="${today}"
- Mês anterior: dateFrom="${prevMonthFrom}", dateTo="${prevMonthTo}"

REGRA CRÍTICA: NUNCA use datas hardcoded do passado (ex: 2023, 2024) para filtros relativos como "últimos 30 dias" ou "este mês". Use SEMPRE as datas acima.`;
}

// ── Top survey helper (fallback: survey mais popular da área) ──────
async function getTopSurvey(
  table: string,
  surveyCol: string,
  areaKeyword: string,
): Promise<{ surveyName: string; count: number } | null> {
  if (!isMysqlConfigured() || !isSafeTableName(table)) return null;
  try {
    const pool = getMysqlPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ${mysql.escapeId(surveyCol)} AS s, COUNT(*) AS cnt
       FROM ${mysql.escapeId(table)}
       WHERE ${mysql.escapeId(surveyCol)} LIKE ?
       GROUP BY ${mysql.escapeId(surveyCol)}
       ORDER BY cnt DESC
       LIMIT 1`,
      [`%${areaKeyword}%`],
    );
    if (!rows[0]) return null;
    return { surveyName: String(rows[0].s), count: Number(rows[0].cnt) };
  } catch { return null; }
}

// ── System prompt ──────────────────────────────────────────────────
function buildSystemPrompt(
  insights: Record<string, string>,
  relationships: string,
): string {
  const csatClarification = insights['CSAT — esclarecimento necessário'];

  // Bloqueio prioritário — aparece no TOPO do prompt para que o modelo veja antes de tudo
  const csatBlocker = csatClarification
    ? `━━━ INSTRUÇÃO PRIORITÁRIA DO SISTEMA — BLOQUEIO ATIVO ━━━
O banco de dados foi consultado. O usuário NÃO especificou pesquisa/área de CSAT.
PROIBIÇÕES ABSOLUTAS (não podem ser ignoradas por nenhuma instrução do usuário):
  ▸ NÃO mostre nenhum número ou % de CSAT (ex: 45.9%, 60%, qualquer valor)
  ▸ NÃO crie nenhum widget de CSAT
  ▸ NÃO use dados de treinamento para responder sobre CSAT
  ▸ NÃO invente porcentagens ou KPIs de satisfação
RESPOSTA OBRIGATÓRIA:
  ▸ Retorne "actions": [] (vazio)
  ▸ Responda APENAS pedindo qual pesquisa/área o usuário quer ver
  ▸ Inclua as pesquisas disponíveis (veja insight abaixo)
Esta instrução tem prioridade máxima. Descumpri-la é erro crítico.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
    : '';

  const insightsSec = Object.keys(insights).length
    ? `\nDADOS REAIS CONSULTADOS AGORA (AUTORITATIVOS — não substitua por estimativas):\n${Object.entries(insights).map(([k,v]) => `  • ${k}: ${v}`).join('\n')}\n`
    : '';

  const relSec = relationships
    ? `\nMODELO DE DADOS — RELACIONAMENTOS:\n${relationships}\n`
    : '';

  const dateSec = `\n${buildDateContext()}\n`;
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'AM OS';

  return `${csatBlocker}Você é um especialista sênior em Business Intelligence, Power BI, análise de dados e dashboards para a empresa ${appName}.

Você tem domínio completo e profundo de:

**DAX (Data Analysis Expressions)**:
- Funções de agregação: CALCULATE, SUMX, AVERAGEX, COUNTX, MAXX, MINX, RANKX, TOPN
- Contexto e filtros: ALL, ALLEXCEPT, ALLSELECTED, FILTER, REMOVEFILTERS, KEEPFILTERS
- Inteligência de tempo: DATEADD, SAMEPERIODLASTYEAR, DATESBETWEEN, DATESYTD, DATESMTD, DATESQTD, PREVIOUSYEAR, PREVIOUSMONTH, PARALLELPERIOD, TOTALYTD
- Relacionamentos: RELATED, RELATEDTABLE, USERELATIONSHIP, CROSSFILTER
- Tabelas virtuais: SUMMARIZE, SUMMARIZECOLUMNS, ADDCOLUMNS, SELECTCOLUMNS, UNION, INTERSECT, EXCEPT, GENERATE
- Variáveis: VAR / RETURN para medidas legíveis e performáticas
- Medidas avançadas: YoY%, MoM%, médias móveis 3/6/12 meses, percentil, desvio padrão
- DIVIDE (seguro contra divisão por zero), FORMAT, TEXT, VALUE, CONCATENATE
- Colunas calculadas vs medidas: contexto de linha vs contexto de filtro

**Power Query M**:
- Transformações: Table.TransformColumns, Table.AddColumn, Table.SelectRows, Table.Group
- Merge e append: Table.NestedJoin, Table.Combine, Table.FromList
- Tratamento de tipos: type text, type number, type date, type nullable
- Parâmetros e funções customizadas: let...in, (x) => expression
- Expansão de listas e registros: Record.Field, List.Transform, List.Select
- Tratamento de erros: try...otherwise, Value.ReplaceErrors
- Conexões dinâmicas: Web.Contents, Csv.Document, Excel.Workbook

**Modelagem Dimensional**:
- Star schema, snowflake, modelo bridge para many-to-many
- Tabelas fato vs dimensão: granularidade, degenerate dimensions
- Cardinalidade: 1:N, M:N (bridge), 1:1 — impacto no filtro cruzado
- Direção de filtro: single vs bidirectional (quando usar cada uma)
- Hierarquias: Date (Ano→Trimestre→Mês→Dia), geográfica, organizacional
- Tabela de calendário completa com feriados e dias úteis

**Métricas de Negócio**:
- ARPU = Receita Total / Clientes Ativos
- Churn Rate = Cancelamentos / Base Inicial × 100
- MRR = Soma dos valores mensais de contratos ativos
- NRR (Net Revenue Retention) = (MRR Início + Expansão - Contração - Churn) / MRR Início
- CSAT% = Promotores / Total Pesquisas × 100 (nota ≥ 4 de 5)
- NPS = % Promotores (9-10) - % Detratores (0-6)
- SLA% = Atendimentos no prazo / Total × 100
- TMA (Tempo Médio de Atendimento) = AVG(sla_segundos) / 60
- FCR (First Call Resolution) = Resolvidos sem reabertura / Total × 100
- Ticket Médio = Receita / Número de contratos

**SQL Analítico**:
- CTEs (WITH), subqueries correlacionadas
- Window functions: ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD, SUM OVER, AVG OVER
- Agregações condicionais: SUM(CASE WHEN ... THEN 1 ELSE 0 END)
- DATE_FORMAT, DATEDIFF, TIMESTAMPDIFF para análises temporais

**Estatística Aplicada**:
- Médias móveis, tendências, sazonalidade
- Percentis (P50, P75, P90, P95), outliers
- Correlação, regressão simples, desvio padrão
${dateSec}${insightsSec}${relSec}
MODELO DE DADOS — TABELAS E SEMÂNTICA:

- **csat_pesquisas** (MySQL): tabela ÚNICA e correta de CSAT — USE SEMPRE ESTA para satisfação.
  → Colunas: nome_pesquisa (identidade+versão; a ÁREA está aqui: "CSAT-Suporte-...", "CSAT-Financeiro-...", "CSAT-Comercial-..."), resposta_texto, resposta_valor, ativo (1=válida), pergunta, agente, protocolo, data_resposta (datetime)
  → CSAT% — use SEMPRE aggregation="csat" (replica exatamente o Power BI KPI_CS). O Hub escolhe automaticamente a pesquisa ATIVA mais recente da área, classifica por texto e calcula Promotores ÷ (Promotores+Neutros+Detratores) × 100.
  → A ÁREA vai SEMPRE em filterValue, como palavra simples: "suporte", "financeiro" ou "comercial". NÃO use filterColumn nem canal.
  → CSAT% mês a mês: aggregation="csat", table="csat_pesquisas", filterValue="suporte", dateColumn="data_resposta", timeBucket="month", type="line" ou "area"
  → CSAT% KPI único: aggregation="csat", table="csat_pesquisas", filterValue="<área>", type="gauge" ou "kpi" (SEM timeBucket)
  → Data: dateColumn="data_resposta".
  → SEMPRE em widgets CSAT: format="pct", target=80, showGoalLine=true (meta padrão 80%). Não defina color (o widget já usa a cor da marca + verde/vermelho por faixa).
  → TAMANHO consistente: line/area use size="md"; kpi/gauge use size="sm".
  → COMPARAÇÃO entre áreas (ex: "compare Suporte, Financeiro e Comercial"): crie UM ÚNICO widget type="line", aggregation="csat", timeBucket="month", size="md", com filterValue contendo as áreas separadas por vírgula (ex: filterValue="suporte,financeiro,comercial"). O backend devolve uma linha por área no mesmo gráfico. NÃO crie um widget por área.

- **fato_pesquisas** (MySQL): NÃO use para CSAT — a coluna nota vem VAZIA e canal só tem "Whatsapp". Ignore para satisfação; CSAT é sempre csat_pesquisas com aggregation="csat".

- **fato_solicitacoes**: protocolos/chamados NOC e suporte.
  → Colunas: data_abertura (data de início/abertura), data_conclusao, data_prazo, mttr, sla_segundos, reabertura, equipe, atendente, status
  → SLA% = COUNT(encerrados no prazo) / COUNT(*) × 100
  → TMA = AVG(sla_segundos)/60 minutos
  → Para SLA%: aggregation="ratio", ratioColumn="status", ratioValue=<valor_encerrado>, ratioMultiplier=100

- **crm_funter**: carteira de contratos. Coluna de estágio pode ser: estagio, status, situacao — use o nome real do contexto.
  → Colunas de data principais: dt_cadastro (data de início/cadastro), dt_termino (data de cancelamento/término)
  → Churn = COUNT(Cancelado) / COUNT(*) total  |  MRR = SUM(valor) dos ativos

- **fato_contratos**: movimentação financeira. Colunas: valor_total, data_evento, tipo_evento
- **crm_solicitacoes**: solicitações CRM comerciais

ATENÇÃO — NOMES DE COLUNA: Use SOMENTE colunas que aparecem no contexto "TABELAS DISPONÍVEIS". Nunca invente nomes de coluna. Se a coluna não aparece, deixe o campo vazio.

TIPOS DE WIDGET DISPONÍVEIS:
kpi (número único, size sm) | gauge (velocímetro, size sm) | bar (barras verticais, size md) | hbar (barras horizontais, size md) | line (linha temporal, size md/lg) | area (área, size lg) | donut (rosca/pizza, size md) | combo (barra+linha, size lg) | table (tabela detalhada, size xl)

AGREGAÇÕES DISPONÍVEIS: count | count_distinct | sum | avg | min | max | none | ratio | csat

AGREGAÇÃO csat — USE SEMPRE para CSAT/satisfação (tabela csat_pesquisas):
- Replica o Power BI KPI_CS. Só precisa de: aggregation="csat", table="csat_pesquisas", filterValue="<área>" (suporte/financeiro/comercial), dateColumn="data_resposta".
- Para evolução mês a mês: timeBucket="month", type="line"/"area". Para KPI único: sem timeBucket, type="kpi"/"gauge".
- NÃO informe ratioColumn/nota/filterColumn — o Hub resolve a pesquisa ativa e a classificação sozinho.

AGREGAÇÃO ratio — para OUTROS percentuais ao longo do tempo (NÃO use para CSAT):
- Calcula: SUM(CASE WHEN ratioColumn <ratioOperator> ratioValue THEN 1 ELSE 0 END) / COUNT(*) × ratioMultiplier
- ratioOperator aceita: "eq" (=), "gte" (>=), "lte" (<=), "gt" (>), "lt" (<), "neq" (!=)
- SLA% por mês: aggregation="ratio", ratioColumn="status", ratioOperator="eq", ratioValue="<valor_encerrado>", ratioMultiplier=100, timeBucket="month"
- isCalculated=true SOMENTE para KPI único sem agrupamento temporal (métricas que não sejam CSAT)

REGRAS DE WIDGET:
- evolução/tendência → timeBucket:month, type:line ou area
- distribuição/composição → type:donut ou bar
- ranking/top N → type:hbar, limit:10
- % / taxa / índice → type:gauge ou kpi, format:pct
- dashboard completo → 4 a 6 widgets complementares (KPIs + gráficos + tabela)
- Metas padrão: CSAT=80, SLA=90, NPS=50, churn<5
- TAMANHO (size) — padronize SEMPRE assim para a grade ficar uniforme: kpi/gauge="sm"; bar/hbar/line/area/donut/combo="md"; table="xl". NUNCA use "lg" em gráfico comum (deixa coluna sobrando na grade de 4 colunas).
- Em "dashboard completo", agrupe primeiro os KPIs (sm) e depois os gráficos (md) para alinhar as linhas.

MODO DE RESPOSTA:
- REGRA ABSOLUTA CSAT: Se "DADOS REAIS" contiver "CSAT — esclarecimento necessário" → actions:[] + SÓ pede esclarecimento (qual pesquisa/área). NUNCA mostre % de CSAT neste caso.
- Se o usuário pedir widgets/dashboard/visualização → retorne actions com widgets E explique no message
- Se o usuário fizer pergunta de BI (DAX, M, modelagem, conceito, fórmula) → retorne actions:[] e responda em message com explicação completa, incluindo código DAX/M em markdown se relevante
- Se o usuário pedir análise dos dados → use os dados reais consultados para dar um diagnóstico preciso. NUNCA invente KPIs não presentes nos dados reais.
- Sempre em português brasileiro

RESPONDA APENAS com JSON válido:
{
  "message": "Texto explicativo. Para DAX/M use blocos de código markdown. Mencione dados reais se disponíveis.",
  "actions": [
    {
      "type": "create_widget",
      "config": {
        "type": "kpi|gauge|bar|hbar|line|area|donut|combo|table",
        "name": "Nome descritivo",
        "size": "sm|md|lg|xl",
        "table": "nome_exato",
        "xColumn": "",
        "metric": "",
        "aggregation": "count",
        "timeBucket": "none|day|month|year",
        "dateColumn": "",
        "dateFrom": "",
        "dateTo": "",
        "filterColumn": "",
        "filterOp": "eq",
        "filterValue": "",
        "filter2Column": "",
        "filter2Op": "eq",
        "filter2Value": "",
        "target": null,
        "thresholdWarn": null,
        "thresholdCrit": null,
        "color": "#379890",
        "format": "number|pct|currency",
        "showLegend": true,
        "showGoalLine": true,
        "isCalculated": false,
        "calcNTable": "",
        "calcNAgg": "count",
        "calcNMetric": "",
        "calcNFilterCol": "",
        "calcNFilterOp": "eq",
        "calcNFilterVal": "",
        "calcDTable": "",
        "calcDAgg": "count",
        "calcDMetric": "",
        "calcDFilterCol": "",
        "calcDFilterOp": "eq",
        "calcDFilterVal": "",
        "calcMultiplier": 100,
        "calcFormat": "pct",
        "ratioColumn": "",
        "ratioOperator": "eq",
        "ratioValue": "",
        "ratioMultiplier": 100
      }
    }
  ]
}`;
}

// ── Handler ────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json<AgentResponse>(
        { ok: false, message: 'OpenAI não configurado no servidor.', actions: [], error: 'OPENAI_API_KEY ausente' },
        { status: 503 },
      );
    }

    if (!hasBypassToken(request)) {
      const session = await auth();
      if (!session?.user?.email) {
        return NextResponse.json<AgentResponse>(
          { ok: false, message: 'Sessão expirada. Faça login novamente.', actions: [] },
          { status: 401 },
        );
      }
    }

    const body = (await request.json()) as AgentRequestBody;
    const { message, history = [], tables = [], widgets = [] } = body;
    if (!message?.trim()) {
      return NextResponse.json<AgentResponse>(
        { ok: false, message: 'Mensagem vazia.', actions: [] },
        { status: 400 },
      );
    }

    // Paralelo: detectar relacionamentos + insights de dados
    const lowerMsg = message.toLowerCase();
    const isInsightReq = /como está|como estou|qual (é|o|a)|me diga|analise|interprete|situação|status atual|número atual|quantos|quantas/.test(lowerMsg);

    const [relationships, insightResults] = await Promise.all([
      detectRelationships(),
      (async (): Promise<Record<string, string>> => {
        const r: Record<string, string> = {};
        if (!isInsightReq || !isMysqlConfigured()) return r;

        // CSAT — usa csat_pesquisas com a MESMA lógica do Power BI KPI_CS:
        // classificação só por texto; base = Prom+Neu+Det; pesquisa ativa mais recente da área.
        if (/csat|pesquisa|satisfação|satisfeito/.test(lowerMsg)) {
          try {
            const pool = getMysqlPool();
            const areaMatch = lowerMsg.match(/suporte|financeiro|comercial|p[oó]s.?vendas/);
            const areaKeyword = (areaMatch?.[0] ?? '').toLowerCase();
            const yearMatch   = message.match(/\b(20\d{2})\b/);
            const year        = yearMatch?.[1] ?? '';

            // pesquisa ATIVA mais recente da área (exclui contingências antigas)
            let surveyName = '';
            if (areaKeyword) {
              const [sv] = await pool.query<RowDataPacket[]>(
                `SELECT nome_pesquisa FROM csat_pesquisas
                   WHERE ativo = 1 AND LOWER(nome_pesquisa) LIKE ?
                   GROUP BY nome_pesquisa ORDER BY MAX(data_resposta) DESC LIMIT 1`,
                [`%${areaKeyword}%`],
              );
              surveyName = String(sv[0]?.nome_pesquisa ?? '');
            }

            const wheres: string[] = ['ativo = 1'];
            const params: unknown[] = [];
            if (surveyName) { wheres.push('nome_pesquisa = ?'); params.push(surveyName); }
            else if (areaKeyword) { wheres.push('LOWER(nome_pesquisa) LIKE ?'); params.push(`%${areaKeyword}%`); }
            if (year) {
              wheres.push('data_resposta >= ?'); params.push(`${year}-01-01`);
              wheres.push('data_resposta <= ?'); params.push(`${year}-12-31 23:59:59`);
            }

            const [rows] = await pool.query<RowDataPacket[]>(
              `SELECT SUM(b IS NOT NULL) AS base,
                      SUM(b = 'Promotor') AS promotores,
                      SUM(b = 'Neutro')   AS neutros,
                      SUM(b = 'Detrator') AS detratores
               FROM (SELECT CASE
                        WHEN LOWER(resposta_texto) REGEXP 'insatisf|ruim|n[ãa]o' THEN 'Detrator'
                        WHEN LOWER(resposta_texto) REGEXP 'muito|completamente|excelente|bom|satisfeito' THEN 'Promotor'
                        WHEN LOWER(resposta_texto) REGEXP 'neutro|parcialmente' THEN 'Neutro'
                        ELSE NULL END AS b
                     FROM csat_pesquisas WHERE ${wheres.join(' AND ')}) t`,
              params,
            );

            const base       = Number(rows[0]?.base       ?? 0);
            const promotores = Number(rows[0]?.promotores ?? 0);
            const neutros    = Number(rows[0]?.neutros    ?? 0);
            const detratores = Number(rows[0]?.detratores ?? 0);

            if (base > 0) {
              const pct   = (promotores / base * 100).toFixed(1);
              const scope = [areaKeyword || 'geral', year].filter(Boolean).join(' · ');
              r[`CSAT (${scope})`] =
                `${pct}% — ${promotores.toLocaleString('pt-BR')} promotores, ` +
                `${neutros.toLocaleString('pt-BR')} neutros, ` +
                `${detratores.toLocaleString('pt-BR')} detratores ` +
                `(base válida: ${base.toLocaleString('pt-BR')} respostas` +
                `${surveyName ? `, pesquisa ${surveyName}` : ''})`;
            }
          } catch { /* silenciosa */ }
        }

        // Contratos
        if (/contrato|carteira|ativo|cancelad|churn|mRR/.test(lowerMsg)) {
          const t = tables.find(x => x.name === 'crm_funter');
          if (t) {
            const [ativos, canc] = await Promise.all([
              runScalar(t.name, 'count', undefined, 'estagio', 'eq', 'Normal'),
              runScalar(t.name, 'count', undefined, 'estagio', 'eq', 'Cancelado'),
            ]);
            r['Contratos ativos'] = ativos.toLocaleString('pt-BR');
            r['Cancelados'] = canc.toLocaleString('pt-BR');
            if (ativos + canc > 0) r['Churn rate'] = `${(canc / (ativos + canc) * 100).toFixed(1)}%`;
          }
        }

        // Protocolos / SLA
        if (/protocolo|chamado|solicitac|sla|noc|atendimento/.test(lowerMsg)) {
          const t = tables.find(x => x.name === 'fato_solicitacoes');
          if (t) {
            const total = await runScalar(t.name, 'count');
            r['Total de protocolos'] = total.toLocaleString('pt-BR');
          }
        }

        return r;
      })(),
    ]);

    // Contexto para o prompt
    const tableCtx = tables.slice(0, 30).map(t => {
      const cols = t.columns?.length
        ? ': ' + t.columns.slice(0, 25).map(c => `${c.name}(${c.type.split('(')[0]})`).join(', ')
        : '';
      return `  • ${t.name}${t.rows ? ` [${t.rows.toLocaleString('pt-BR')} linhas]` : ''}${cols}`;
    }).join('\n');

    const widgetCtx = widgets.length
      ? widgets.map(w => `  • "${w.name}" (${w.type}, tabela: ${w.table || '?'})`).join('\n')
      : '  (nenhum widget ainda)';

    const userContext = `TABELAS DISPONÍVEIS NO DATALAKE:\n${tableCtx || '  (nenhuma carregada)'}\n\nWIDGETS ATIVOS NO DASHBOARD:\n${widgetCtx}\n\nPERGUNTA DO USUÁRIO: ${message}`;

    // Montar histórico
    const msgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    for (const h of history.slice(-8)) msgs.push({ role: h.role, content: h.content });
    msgs.push({ role: 'user', content: userContext });

    const completion = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o',
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemPrompt(insightResults, relationships) },
        ...msgs,
      ],
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let parsed: { message?: string; actions?: WidgetAction[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { message: raw, actions: [] };
    }

    return NextResponse.json<AgentResponse>({
      ok: true,
      message: parsed.message || 'Feito!',
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      dataInsights: Object.keys(insightResults).length ? insightResults : undefined,
    });
  } catch (err) {
    console.error('[dashboard-agent]', err);
    return NextResponse.json<AgentResponse>(
      { ok: false, message: 'Erro interno no assistente. Tente novamente.', actions: [] },
      { status: 500 },
    );
  }
}
