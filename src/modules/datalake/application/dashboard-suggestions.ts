import { openaiClient } from '@/infrastructure/ai/chat-clients';
import type { DashboardSuggestion, DashboardSuggestionResponse, DatalakeTableInfo } from '@/shared/types/datalake';

function buildHeuristicSuggestions(prompt: string, tables: DatalakeTableInfo[]): DashboardSuggestion[] {
  const topTables = tables.slice(0, 4);

  return topTables.map((table, index) => ({
    title: `${table.name} - visao ${index + 1}`,
    chartType: index === 0 ? 'table' : index === 1 ? 'bar' : index === 2 ? 'line' : 'metric',
    table: table.name,
    aggregation: index === 3 ? 'count' : undefined,
    rationale: `Sugestao heuristica baseada na disponibilidade da tabela ${table.name} para o pedido: ${prompt}.`,
  }));
}

function isSuggestionArray(value: unknown): value is DashboardSuggestion[] {
  return Array.isArray(value);
}

export async function suggestDashboards(input: { prompt: string; tables: DatalakeTableInfo[] }): Promise<DashboardSuggestionResponse> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    return {
      ok: false,
      prompt,
      suggestions: [],
      source: 'heuristic',
    };
  }

  const tableSummary = input.tables.slice(0, 20).map((table) => ({
    name: table.name,
    rows: table.rows,
    engine: table.engine,
  }));

  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Voce e um analista de dados especializado em inteligência de negócios.
O Data Lake contem as seguintes tabelas e colunas principais:

- fato_solicitacoes: protocolos e solicitacoes de atendimento.
  Colunas: protocolo, status, tipo, equipe, atendente, cidade, bairro, criticidade, data_abertura (datetime), data_conclusao (datetime), data_prazo, sla_segundos, nome_cliente, cod_cliente, reabertura.
  Valores reais de status: "Encerramento", "Cancelado" (nao existe "Aberto").
  "abertos em X" = filtrar por data_abertura. "sem conclusao" = data_conclusao IS NULL.

- crm_funter: base de contratos comerciais. UMA linha por contrato.
  Colunas: contrato, cliente, cod_cliente, cod_vendedor, vendedor_1, valor (decimal), estagio, status, tipo, dt_cadastro (datetime), dt_termino (datetime), cidade, estado, produto.
  Valores reais de estagio: "Normal" (=ativo/vigente), "Cancelado", "Cortesia". NAO existe valor "Ativo".
  Valores reais de status: "Aprovado", "Cancelado", "Em Aprovacao", "Pre-Contrato".
  "contratos ativos" = estagio = "Normal". "contratos aprovados" = status = "Aprovado".
  Data de referencia = dt_cadastro. Os dados existentes sao de 2025.

- fato_contratos: eventos financeiros de contratos. Use SOMENTE para somar valor_total (receita).
  Colunas: valor_total, data_evento, id_cliente, id_contrato.

- crm_solicitacoes: solicitacoes do CRM. Colunas: status, data_abertura, tipo, cidade.

Mapeamento de termos de negocio (OBRIGATORIO — prioridade maxima):
- "protocolo", "protocolos", "chamado", "chamados", "solicitacao", "solicitacoes", "atendimento", "atendimentos", "equipe NOC", "por equipe" → fato_solicitacoes
- "contrato", "contratos", "contratos ativos", "contratos aprovados", "contratos cancelados", "contratos por mes", "quantidade de contratos", "carteira" → crm_funter
- "receita", "faturamento", "valor total dos contratos", "soma de valor" → fato_contratos

Regras obrigatorias:
1. Responda APENAS com JSON valido
2. O campo "suggestions" deve ser um array com 1 a 3 sugestoes relevantes
3. Use SOMENTE nomes de tabelas listados acima
4. chartType: line, bar, area, pie, table, metric
   - "por mes", "mensal", "evolucao" → bar ou line com timeBucket: "month" e x = dateColumn
   - "distribuicao", "por status", "por equipe" → bar ou pie
   - Use "metric" SOMENTE para um numero unico (KPI)
5. NUNCA use timeBucket sem definir x e dateColumn com a mesma coluna de data

Campos de cada sugestao:
- title: titulo descritivo em portugues
- chartType: line | bar | area | pie | table | metric
- table: nome exato da tabela
- x: coluna do eixo X (igual a dateColumn quando timeBucket ativo)
- metric: coluna numerica para agregar (null para COUNT)
- aggregation: count | sum | avg | min | max
- filterColumn / filterOperator / filterValue: filtro primario
- filter2Column / filter2Operator / filter2Value: filtro secundario
- dateColumn: coluna de data para periodo
- dateFrom / dateTo: YYYY-MM-DD
- timeBucket: none | day | month | year
- rationale: justificativa em portugues

Exemplos criticos:
- "contratos aprovados por mes" → table: crm_funter, x: dt_cadastro, timeBucket: month, dateColumn: dt_cadastro, filterColumn: status, filterValue: Aprovado, aggregation: count
- "contratos aprovados em 2025 por mes" → igual acima + dateFrom: 2025-01-01, dateTo: 2025-12-31
- "contratos ativos" → table: crm_funter, filterColumn: estagio, filterValue: Normal, aggregation: count
- "protocolos abertos por equipe" → table: fato_solicitacoes, x: equipe, aggregation: count, chartType: bar
- "evolucao de protocolos por mes" → table: fato_solicitacoes, x: data_abertura, timeBucket: month, dateColumn: data_abertura, aggregation: count`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              prompt,
              tables: tableSummary,
            }),
          },
        ],
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content) as { suggestions?: DashboardSuggestion[] };
      const suggestions = isSuggestionArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4) : [];

      if (suggestions.length > 0) {
        return {
          ok: true,
          prompt,
          suggestions,
          source: 'ai',
        };
      }
    } catch {
      // fallback below
    }
  }

  return {
    ok: true,
    prompt,
    suggestions: buildHeuristicSuggestions(prompt, input.tables),
    source: 'heuristic',
  };
}
