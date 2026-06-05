import { openaiClient } from '@/infrastructure/ai/chat-clients';
import { getDatalakeOverview, getTablePreview } from '@/modules/datalake/application/overview';
import { getMysqlPool } from '@/infrastructure/datalake/mysql-client';
import type { DashboardSuggestion, DashboardSuggestionResponse, DatalakeTableInfo } from '@/shared/types/datalake';
import type { RowDataPacket } from 'mysql2';
import mysql from 'mysql2';

const DATE_PATTERN = /(data|dt_|_at$|competencia|vencimento|inicio|fim|conclusao|abertura|resposta|evento|cadastro|termino)/i;
const ID_PATTERN = /(^id($|_)|(_id$)|(^cod_)|(^codigo$))/i;
const NUMERIC_TYPES = /^(int|bigint|smallint|tinyint|decimal|float|double|numeric)/i;
const DATE_TYPES = /^(date|datetime|timestamp)/i;

function isCategoricalColumn(name: string, type: string): boolean {
  if (ID_PATTERN.test(name)) return false;
  if (DATE_PATTERN.test(name)) return false;
  if (NUMERIC_TYPES.test(type)) return false;
  if (DATE_TYPES.test(type)) return false;
  if (name.includes('formatada') || name.includes('descricao') || name.includes('endereco') || name.includes('email')) return false;
  return true;
}

async function fetchColumnSamples(
  tableName: string,
  columns: Array<{ name: string; type: string }>
): Promise<Record<string, string[]>> {
  const pool = getMysqlPool();
  const escapedTable = mysql.escapeId(tableName);
  const result: Record<string, string[]> = {};

  const categoricalCols = columns
    .filter(c => isCategoricalColumn(c.name, c.type))
    .slice(0, 8);

  await Promise.all(
    categoricalCols.map(async (col) => {
      try {
        const escapedCol = mysql.escapeId(col.name);
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT DISTINCT ${escapedCol} AS v FROM ${escapedTable} WHERE ${escapedCol} IS NOT NULL AND ${escapedCol} != '' ORDER BY ${escapedCol} LIMIT 15`
        );
        const values = (rows as Array<Record<string, unknown>>)
          .map(r => String(r.v ?? ''))
          .filter(Boolean);
        if (values.length > 0) result[col.name] = values;
      } catch {
        // silently skip if column query fails
      }
    })
  );

  return result;
}

async function identifyRelevantTable(prompt: string, tables: DatalakeTableInfo[]): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const tableNames = tables.map(t => t.name).join(', ');
    const response = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Voce e um assistente de banco de dados especializado em ISP brasileiro. Dada a lista de tabelas e o pedido do usuario, identifique qual tabela (APENAS UMA) e a mais relevante.
Tabelas disponiveis: ${tableNames}

Mapeamento OBRIGATORIO de termos de negocio (prioridade maxima):
- "protocolo", "protocolos", "chamado", "chamados", "solicitacao", "solicitacoes", "atendimento", "atendimentos" → fato_solicitacoes
- "por equipe", "classificar por equipe", "equipe de atendimento", "atendente", "fila de atendimento", "sla" → fato_solicitacoes
- "contratos", "contratos ativos", "contratos cancelados", "contratos aprovados", "quantos contratos", "numero de contratos", "contratos por mes", "contratos em", "contrato" → crm_funter
- "valor dos contratos", "receita total", "soma de valor", "faturamento" → fato_contratos
- crm_funter: UMA linha por contrato. Data de cadastro = dt_cadastro. Status/estagio = estagio (valores: Normal=ativo, Cancelado, Cortesia). Nome cliente = cliente. Vendedor = vendedor_1.
- fato_solicitacoes: UMA linha por protocolo/solicitacao. Data abertura = data_abertura. Equipe = equipe. Atendente = atendente.
- fato_contratos: UMA linha por EVENTO financeiro. Use SOMENTE para somar valor_total.

Responda APENAS com o nome exato da tabela como aparece na lista. Se nenhuma for relevante, responda "none".`
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const result = response.choices[0]?.message?.content?.trim().toLowerCase();
    if (result === 'none' || !result) return null;

    return tables.find(t => t.name.toLowerCase() === result)?.name || null;
  } catch {
    return null;
  }
}

export async function smartWidgetAssistant(prompt: string, allowedTables?: string[] | 'all'): Promise<DashboardSuggestionResponse> {
  const overview = await getDatalakeOverview(allowedTables);
  if (!overview.ok) {
    return { ok: false, prompt, suggestions: [], source: 'heuristic' };
  }

  const table = await identifyRelevantTable(prompt, overview.tables);
  if (!table) {
    return { ok: true, prompt, suggestions: [], source: 'heuristic' };
  }

  const schema = await getTablePreview(table, 1);
  const columns = schema.columns.map(c => `${c.name} (${c.type})`).join(', ');

  const columnSamples = await fetchColumnSamples(table, schema.columns);
  const samplesText = Object.entries(columnSamples)
    .map(([col, values]) => `  - ${col}: ${values.map(v => `"${v}"`).join(', ')}`)
    .join('\n');

  try {
    const response = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Voce e um analista de dados especializado em Dashboards para ISP brasileiro.
O usuario quer criar um widget para a tabela "${table}".
Colunas disponiveis: ${columns}

VALORES REAIS DAS COLUNAS CATEGORICAS (use exatamente esses valores nos filtros):
${samplesText || '  (nenhum disponivel)'}

MAPEAMENTO DE TERMOS DE NEGOCIO:
- Tabela fato_solicitacoes: "protocolo", "protocolos", "chamado", "chamados", "solicitacao" sao o mesmo conceito. COUNT(*) = quantidade de protocolos. Coluna de data de abertura = data_abertura. Coluna de equipe = equipe. Coluna de atendente = atendente.
- Tabela fato_solicitacoes: "abertos em X" = filtrar por data_abertura no periodo X. NUNCA filtrar por status para "abertos em periodo".
- Tabela crm_funter: cada linha e UM contrato unico. Colunas principais: cliente (nome), estagio (status), dt_cadastro (data de cadastro), valor (valor mensal), vendedor_1 (vendedor), cidade, produto, tipo.
- Tabela crm_funter - VALORES REAIS de estagio: "Normal" = contrato ATIVO/vigente/aprovado, "Cancelado" = cancelado, "Cortesia" = cortesia. NAO existem valores "Ativo" ou "Aprovado" — use SEMPRE "Normal" para filtrar ativos ou aprovados.
- Tabela crm_funter - PERIODO: dt_cadastro e a data de cadastro do contrato. Para "contratos ativos em 2025" = filtrar dt_cadastro entre 2025-01-01 e 2025-12-31. Para "contratos ativos" sem periodo = sem filtro de data, apenas estagio = "Normal".
- Tabela crm_funter - CLIENTE: coluna "cliente" contem o nome do cliente. Para filtrar por cliente use filterOperator "contains" com o nome buscado. Para listar contratos de um cliente use chartType "table".
- Tabela fato_contratos: use APENAS para metricas financeiras (soma de valor_total). NUNCA para contar contratos.

REGRAS DE AGRUPAMENTO TEMPORAL (timeBucket) - OBRIGATORIO quando usuario pede "por mes", "mensal", etc:
- "por mes", "mensal", "cada mes", "evolucao mensal", "por mes em X" → timeBucket: "month", x: <dateColumn>, chartType: "bar" ou "line"
- "por dia", "diario" → timeBucket: "day", x: <dateColumn>, chartType: "line"
- "por ano", "anual" → timeBucket: "year", x: <dateColumn>, chartType: "bar"
- REGRA CRITICA: quando houver timeBucket month/day/year, o campo x DEVE ser IGUAL ao dateColumn.
- NUNCA use chartType "metric" quando o usuario pedir agrupamento temporal.

REGRAS DE AGRUPAMENTO POR DIMENSAO:
- "classifique por equipe", "por equipe", "distribuicao por equipe" → x: "equipe", chartType: "bar"
- "por atendente" → x: "atendente", chartType: "bar"
- "por cidade" → x: "cidade", chartType: "bar"
- "por tipo" → x: "tipo", chartType: "bar"
- "por status" → x: "status", chartType: "pie" ou "bar"
- "por cliente" → x: "cliente" ou "nome_cliente", chartType: "bar"
- Quando usuario pede classificacao por dimensao, NUNCA use chartType "metric".

REGRAS DE AGREGACAO:
- "quantos", "quantidade", "numero de" → aggregation: "count", metric: null
- "valor total", "soma" → aggregation: "sum" com metric na coluna de valor
- "media" → aggregation: "avg"
- NUNCA some colunas de valor quando o usuario pede quantidade.

REGRAS DE FILTRO:
- Use os valores reais listados acima. Prefira "contains" para strings.
- Para nomes de clientes: filterOperator "contains".
- Para anos: dateFrom: "2026-01-01", dateTo: "2026-12-31".
- Use APENAS colunas listadas acima.

Responda SOMENTE com JSON valido no formato exato abaixo (sem texto extra, sem markdown):
{"suggestions":[{"title":"string","chartType":"bar|line|area|pie|table|metric","table":"${table}","x":"coluna_eixo_x","metric":null,"aggregation":"count|sum|avg","timeBucket":"none|day|month|year","filterColumn":null,"filterOperator":null,"filterValue":null,"filter2Column":null,"filter2Operator":null,"filter2Value":null,"dateColumn":null,"dateFrom":null,"dateTo":null,"rationale":"string"}]}`
        },
        {
          role: 'user',
          content: `Pedido do usuario: ${prompt}`
        }
      ]
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as Record<string, unknown>;

    // Fallback robusto: AI pode retornar objeto único sem wrapper ou chave diferente
    let suggestions: DashboardSuggestion[] = [];
    if (Array.isArray(parsed.suggestions)) {
      suggestions = parsed.suggestions as DashboardSuggestion[];
    } else if (parsed.title) {
      suggestions = [parsed as unknown as DashboardSuggestion];
    }

    return {
      ok: true,
      prompt,
      suggestions,
      source: 'ai'
    };
  } catch (error) {
    return {
      ok: false,
      prompt,
      suggestions: [],
      source: 'heuristic'
    };
  }
}
