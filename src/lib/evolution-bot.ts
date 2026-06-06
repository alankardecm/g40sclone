import OpenAI from 'openai';
import {
  getActiveProblems,
  getZabbixSummary,
  SEVERITY_LABEL,
  type ZabbixProblem,
} from '@/lib/zabbix';
import { getMysqlPool, isMysqlConfigured, getMysqlConfig } from '@/infrastructure/datalake/mysql-client';
import type { RowDataPacket } from 'mysql2';
import { getCsatSummary, formatCsatReply } from '@/lib/csat';
import { buildRagContext } from '@/lib/rag';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Zabbix ────────────────────────────────────────────────────────────────────

function ageLabel(clockStr: string): string {
  const secs = Math.floor(Date.now() / 1000) - Number(clockStr);
  if (secs < 60)  return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}min`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

function sevEmoji(sev: string): string {
  return { '5': '🔴', '4': '🟠', '3': '🟡', '2': '🔵', '1': '⚪', '0': '⚫' }[sev] ?? '❓';
}

async function zabbixStatusReport(): Promise<string> {
  const [summary, problems] = await Promise.all([
    getZabbixSummary(),
    getActiveProblems(20),
  ]);

  const ok = summary.totalProblems === 0;
  const lines: string[] = [];
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'AM OS';

  lines.push(`📡 *NOC ${appName} — Status Zabbix*`);
  lines.push(`🕐 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}`);
  lines.push('');

  if (ok) {
    lines.push('✅ Sem problemas ativos no momento');
  } else {
    lines.push(`🚨 *${summary.totalProblems} problema${summary.totalProblems > 1 ? 's' : ''} ativo${summary.totalProblems > 1 ? 's' : ''}*`);
    if (summary.disasters > 0)    lines.push(`🔴 Desastres: ${summary.disasters}`);
    if (summary.highSeverity > 0) lines.push(`🟠 Alta: ${summary.highSeverity}`);
    lines.push('');

    problems.slice(0, 10).forEach((p: ZabbixProblem, i) => {
      const host = p.hosts?.[0]?.name ?? '—';
      const sev  = SEVERITY_LABEL[p.severity] ?? p.severity;
      lines.push(`${i + 1}. ${sevEmoji(p.severity)} *${host}* — ${p.name}`);
      lines.push(`   ${sev} · há ${ageLabel(p.clock)}`);
    });

    if (problems.length > 10) {
      lines.push(`   _...e mais ${problems.length - 10} problemas_`);
    }
  }

  lines.push('');
  lines.push(`📊 Hosts: ${summary.hostsUp} ok | ${summary.hostsDown} down | ${summary.hostsUnknown} desconhecido`);
  lines.push(`_${appName}_`);

  return lines.join('\n');
}

// ── DataLake ──────────────────────────────────────────────────────────────────

// Schema fixo das tabelas autorizadas — evita o AI usar tabelas erradas
const DATALAKE_SCHEMA = `
Tabelas disponíveis (USE APENAS ESTAS):

fato_solicitacoes — protocolos/chamados de suporte
  colunas: protocolo(bigint PK), etiqueta(varchar), status(varchar), criticidade(varchar),
           sla_segundos(decimal), data_abertura(datetime), data_conclusao(datetime),
           data_prazo(datetime), tipo(varchar), atendente(varchar), equipe(varchar),
           reabertura(tinyint), telefone_raw(varchar), cod_cliente(bigint),
           nome_cliente(varchar), localizacao(varchar), bairro(varchar), cidade(varchar),
           data_ingestao(datetime)
  IMPORTANTE: nome_cliente e equipe já estão nesta tabela — NÃO precisa de JOIN para isso
  status reais (SOMENTE ESTES EXISTEM): 'Encerramento', 'Cancelado'
  ATENÇÃO: NÃO existe status 'Aberto' nem 'Em Atendimento' nesta tabela
  "protocolos abertos em X" = protocolos cuja data_abertura está no período X (NÃO filtre por status)
  "protocolos em aberto" ou "sem conclusão" = WHERE data_conclusao IS NULL

fato_contratos — contratos ativos e histórico (dados atualizados)
  colunas: status(varchar), data_evento(datetime), id_cliente(bigint), id_contrato(bigint), valor_total(decimal)
  Para nome do cliente: JOIN dim_cliente ON fato_contratos.id_cliente = dim_cliente.id_cliente
  Para detalhes do contrato: JOIN dim_contrato ON fato_contratos.id_contrato = dim_contrato.id_contrato

dim_cliente — cadastro de clientes
  colunas: id_cliente(bigint), cod_cliente(bigint), nome_cliente(varchar)

dim_contrato — detalhes dos contratos
  colunas: id_contrato(bigint), cod_cliente(bigint), num_contrato(varchar), tipo_contrato(varchar),
           valor_mensal(decimal), status(varchar), data_cadastro(datetime), data_cancelamento(datetime)

REGRAS DE SQL:
- "abertos em [período]" = filtrar por data_abertura, NUNCA adicionar filtro de status
- "sem conclusão" ou "em aberto" = WHERE data_conclusao IS NULL
- Equipes/atendentes: SELECT equipe, COUNT(*) AS total FROM fato_solicitacoes WHERE DATE(data_abertura) = CURDATE() GROUP BY equipe ORDER BY total DESC
- Clientes com mais protocolos: SELECT nome_cliente, COUNT(*) AS total FROM fato_solicitacoes WHERE DATE(data_abertura) BETWEEN '...' AND '...' GROUP BY nome_cliente ORDER BY total DESC LIMIT 10
- NUNCA filtre por status = 'Aberto' — esse status não existe
- NUNCA use crm_solicitacoes, fato_atendimentos ou outras tabelas não listadas acima
`.trim();

// ── Histórico de conversa por número ─────────────────────────────────────────

type ConversationMessage = { role: 'user' | 'assistant'; content: string };
const conversationSessions = new Map<string, { messages: ConversationMessage[]; lastActivity: number }>();
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 min sem atividade limpa a sessão
const MAX_HISTORY_MESSAGES = 8; // 4 trocas (user+assistant)

function getHistory(phone: string): ConversationMessage[] {
  const session = conversationSessions.get(phone);
  if (!session || Date.now() - session.lastActivity > SESSION_TTL_MS) {
    conversationSessions.delete(phone);
    return [];
  }
  return session.messages;
}

function saveHistory(phone: string, userMsg: string, assistantMsg: string) {
  const existing = getHistory(phone);
  const updated = [
    ...existing,
    { role: 'user' as const, content: userMsg },
    { role: 'assistant' as const, content: assistantMsg },
  ].slice(-MAX_HISTORY_MESSAGES);
  conversationSessions.set(phone, { messages: updated, lastActivity: Date.now() });
}

async function getDataFreshness(): Promise<string> {
  if (!isMysqlConfigured()) return '';
  try {
    const pool = getMysqlPool();
    const [r] = await pool.query<RowDataPacket[]>(
      `SELECT MAX(data_abertura) AS max_abertura FROM fato_solicitacoes`
    );
    const max = r[0]?.max_abertura;
    if (!max) return '';
    const d = new Date(max as string);
    return `Dados de solicitações disponíveis até: ${d.toLocaleDateString('pt-BR')}.`;
  } catch { return ''; }
}

async function runDatalakeQuery(sql: string): Promise<string> {
  if (!isMysqlConfigured()) return 'DataLake não configurado.';
  if (!/^\s*SELECT\s/i.test(sql)) return 'Apenas consultas SELECT são permitidas.';

  const pool = getMysqlPool();
  let rows: RowDataPacket[];
  try {
    [rows] = await pool.query<RowDataPacket[]>(sql);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Erro SQL: ${msg}`;
  }

  if (!Array.isArray(rows) || rows.length === 0) return 'Nenhum resultado encontrado.';

  const cols  = Object.keys(rows[0]);
  const lines = rows.slice(0, 15).map((row) =>
    cols.map((c) => `${c}: ${row[c] ?? '—'}`).join(' | ')
  );

  let text = lines.join('\n');
  if (rows.length > 15) text += `\n_...e mais ${rows.length - 15} linhas_`;
  return text;
}

// ── Orquestrador com function calling ────────────────────────────────────────

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'zabbix_status',
      description: 'Retorna o status atual do Zabbix: problemas ativos, hosts down, severidades.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'datalake_query',
      description: 'Executa uma query SQL SELECT no DataLake MySQL da empresa e retorna os resultados. NÃO use para CSAT/satisfação — use csat_query.',
      parameters: {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description: 'Query SQL SELECT a executar. Deve ser segura, sem subconsultas destrutivas.',
          },
        },
        required: ['sql'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'csat_query',
      description: 'Calcula o CSAT% (satisfação) de uma área num período, com a MESMA lógica do dashboard e do Power BI (já formatado para resposta). USE TEMPRE que perguntarem sobre CSAT, satisfação, promotores, neutros ou detratores. NÃO use datalake_query para isso.',
      parameters: {
        type: 'object',
        properties: {
          area: { type: 'string', description: 'Área: suporte, financeiro ou comercial' },
          dateFrom: { type: 'string', description: 'Data inicial YYYY-MM-DD (opcional). Ex: fevereiro/2026 = 2026-02-01' },
          dateTo: { type: 'string', description: 'Data final YYYY-MM-DD (opcional). Ex: fevereiro/2026 = 2026-02-28' },
          periodLabel: { type: 'string', description: 'Rótulo do período para exibir, ex: "fevereiro/2026" ou "2026" (opcional)' },
        },
        required: ['area'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'google_drive_search',
      description: 'Pesquisa documentos, manuais, procedimentos, relatórios ou informações institucionais no Google Drive (RAG) da empresa.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Termo de busca para localizar nos documentos.',
          },
        },
        required: ['query'],
      },
    },
  },
];

export async function handleBotMessage(
  text: string,
  senderName?: string,
  phone?: string,
): Promise<string> {
  // Resposta imediata para saudações simples — limpa o histórico da sessão
  const lower = text.toLowerCase().trim();
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'AM OS';
  if (['oi', 'olá', 'ola', 'opa', 'hey', 'hi'].includes(lower)) {
    if (phone) conversationSessions.delete(phone);
    const name = senderName ? `, ${senderName.split(' ')[0]}` : '';
    return [
      `Olá${name}! 👋 Sou o assistente do *${appName}*.`,
      '',
      'Posso te ajudar com:',
      '• `status` — situação atual do Zabbix',
      '• Perguntas sobre dados do DataLake',
      '',
      'Ex: _"quais os hosts com problema agora?"_ ou _"quantos chamados abertos hoje?"_',
    ].join('\n');
  }

  // Atalho direto para status
  if (['status', 'noc', 'alarmes', 'problemas'].includes(lower)) {
    return zabbixStatusReport();
  }

  try {
    const freshness = await getDataFreshness().catch(() => '');
    const history = phone ? getHistory(phone) : [];

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: [
          `Você é o assistente do ${appName}, respondendo via WhatsApp.`,
          'Seja objetivo e use formatação simples (negrito com *, itálico com _).',
          `Data/hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
          DATALAKE_SCHEMA,
          freshness,
          'Para perguntas sobre rede, infraestrutura, hosts ou alarmes, use zabbix_status.',
          'Para CSAT/satisfação (ex: "CSAT do suporte em fevereiro", "satisfação do financeiro"), use SEMPRE csat_query com area=suporte|financeiro|comercial e, se houver período, dateFrom/dateTo + periodLabel. NUNCA use datalake_query para CSAT.',
          'Para comparar CSAT de várias áreas, chame csat_query uma vez por área.',
          'Para perguntas sobre chamados, protocolos, contratos ou clientes, use datalake_query com as tabelas acima.',
          'Quando retornar zero resultados, sugira ajustar a data para o período disponível.',
          'Mantenha contexto da conversa: se o usuário usar "esses", "deles", "desses", refira-se à consulta anterior.',
          'Se não souber, diga claramente o que pode fazer.',
        ].filter(Boolean).join('\n'),
      },
      ...history,
      { role: 'user', content: text },
    ];

    const first = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 1000,
    });

    const choice = first.choices[0];

    // Sem function call → resposta direta
    if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
      const reply = choice.message.content ?? 'Não entendi. Tente: *status*, ou descreva o que quer saber.';
      if (phone) saveHistory(phone, text, reply);
      return reply;
    }

    // Executa TODOS os tool calls e responde a todos (OpenAI exige resposta para cada um)
    const toolResponses: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    for (const call of choice.message.tool_calls) {
      const fn = (call as { function?: { name?: string; arguments?: string } }).function;
      const args = JSON.parse(fn?.arguments || '{}') as Record<string, string>;
      let result = '';

      if (fn?.name === 'zabbix_status') {
        result = await zabbixStatusReport();
      } else if (fn?.name === 'csat_query') {
        const summary = await getCsatSummary({ area: args.area ?? '', dateFrom: args.dateFrom, dateTo: args.dateTo });
        result = formatCsatReply(args.periodLabel ?? '', summary);
      } else if (fn?.name === 'datalake_query') {
        console.log('[Bot] SQL:', args.sql);
        result = await runDatalakeQuery(args.sql ?? '');
        console.log('[Bot] resultado:', result.slice(0, 300));
      } else if (fn?.name === 'google_drive_search') {
        const ragResult = await buildRagContext(args.query ?? '');
        result = ragResult.context || 'Nenhum documento relevante encontrado no Google Drive.';
      }

      toolResponses.push({
        role: 'tool',
        tool_call_id: call.id,
        content: result || 'Sem resultado.',
      });
    }

    // Ferramentas que já retornam texto pronto (zabbix/csat): se for uma só, devolve
    // direto, sem a 2ª chamada ao AI reformatar (evita mexer nos números).
    const DIRECT_TOOLS = new Set(['zabbix_status', 'csat_query']);
    const onlyDirect = choice.message.tool_calls.every(c => DIRECT_TOOLS.has((c as { function?: { name?: string } }).function?.name ?? ''));
    if (onlyDirect && toolResponses.length === 1) {
      const reply = toolResponses[0].content as string;
      if (phone) saveHistory(phone, text, reply);
      return reply;
    }

    // Segunda chamada: AI formata todos os resultados em resposta coerente
    const second = await openai.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
      messages: [
        ...messages,
        choice.message,
        ...toolResponses,
      ],
      max_tokens: 800,
    });

    const finalReply = second.choices[0].message.content
      ?? 'Consulta executada mas não consegui formatar a resposta.';
    if (phone) saveHistory(phone, text, finalReply);
    return finalReply;

  } catch (err) {
    console.error('[Bot] erro:', err);
    return '⚠️ Erro ao processar sua mensagem. Tente novamente.';
  }
}
