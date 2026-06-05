import { NextRequest, NextResponse } from 'next/server';
import { openaiClient } from '@/infrastructure/ai/chat-clients';
import { getMysqlPool, isMysqlConfigured } from '@/infrastructure/datalake/mysql-client';
import { auth } from '@/lib/auth';
import { getUserAllowedTables } from '@/lib/user-registry';
import { hasBypassToken } from '@/lib/dashboard-cors';
import { getDatalakeOverview } from '@/modules/datalake/application/overview';
import type { RowDataPacket } from 'mysql2';

interface NLQueryRequest {
  question: string;
}

interface NLQueryResponse {
  ok: boolean;
  sql?: string;
  columns?: string[];
  rows?: Record<string, unknown>[];
  rowCount?: number;
  error?: string;
  explanation?: string;
}

function isSafeSelect(sql: string): boolean {
  const trimmed = sql.trim();
  if (!/^SELECT\s/i.test(trimmed)) return false;
  if (/\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|LOAD_FILE|INTO\s+OUTFILE)\b/i.test(trimmed)) return false;
  const withoutTrailing = trimmed.replace(/;\s*$/, '');
  if (withoutTrailing.includes(';')) return false;
  return true;
}

function enforceLimit(sql: string, max = 200): string {
  const noSemi = sql.trim().replace(/;\s*$/, '');
  if (/\bLIMIT\s+\d+/i.test(noSemi)) {
    return noSemi.replace(/\bLIMIT\s+(\d+)/i, (_, n) => `LIMIT ${Math.min(Number(n), max)}`);
  }
  return `${noSemi} LIMIT ${max}`;
}

async function getFullSchema(allowedTables: string[] | 'all'): Promise<string> {
  const pool = getMysqlPool();
  try {
    const [tableRows] = await pool.query<RowDataPacket[]>(`
      SELECT t.TABLE_NAME, t.TABLE_ROWS,
             c.COLUMN_NAME, c.COLUMN_TYPE, c.COLUMN_KEY
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c
        ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME
      WHERE t.TABLE_SCHEMA = DATABASE()
        AND t.TABLE_TYPE = 'BASE TABLE'
      ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
    `);

    const byTable: Record<string, { rows: number | null; cols: string[] }> = {};
    for (const r of tableRows as Array<Record<string, unknown>>) {
      const name = String(r.TABLE_NAME ?? '');
      if (allowedTables !== 'all' && !allowedTables.includes(name)) continue;
      if (!byTable[name]) byTable[name] = { rows: r.TABLE_ROWS != null ? Number(r.TABLE_ROWS) : null, cols: [] };
      if (r.COLUMN_NAME) {
        const key = r.COLUMN_KEY === 'PRI' ? ' PK' : '';
        byTable[name].cols.push(`  ${r.COLUMN_NAME} ${r.COLUMN_TYPE}${key}`);
      }
    }

    return Object.entries(byTable).map(([name, info]) => {
      const rowsLabel = info.rows != null ? ` (~${info.rows.toLocaleString('pt-BR')} linhas)` : '';
      return `TABLE ${name}${rowsLabel}:\n${info.cols.join('\n')}`;
    }).join('\n\n');
  } catch {
    const overview = await getDatalakeOverview(allowedTables);
    return overview.tables.map(t => `TABLE ${t.name}`).join('\n');
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isMysqlConfigured() || !process.env.OPENAI_API_KEY) {
      return NextResponse.json<NLQueryResponse>(
        { ok: false, error: 'Serviço não configurado.' },
        { status: 503 },
      );
    }

    let allowedTables: string[] | 'all' = 'all';

    if (!hasBypassToken(request)) {
      const session = await auth();
      if (!session?.user?.email) {
        return NextResponse.json<NLQueryResponse>(
          { ok: false, error: 'Sessão expirada. Faça login novamente.' },
          { status: 401 },
        );
      }
      allowedTables = await getUserAllowedTables(session.user.email);
    }

    const body = (await request.json()) as NLQueryRequest;
    const { question } = body;
    if (!question?.trim()) {
      return NextResponse.json<NLQueryResponse>({ ok: false, error: 'Pergunta vazia.' }, { status: 400 });
    }

    const schemaText = await getFullSchema(allowedTables);

    const completion = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em SQL e Business Intelligence para um ISP brasileiro (NetTurbo).
Converta a pergunta do usuário em uma query SQL SELECT segura e eficiente para MySQL.

ESQUEMA COMPLETO DO BANCO:
${schemaText}

SEMÂNTICA DO NEGÓCIO:
- crm_funter: carteira de contratos. estagio='Normal'=ativo, 'Cancelado'=cancelado, 'Cortesia'=cortesia. dt_cadastro=data de cadastro, cliente=nome, vendedor_1=vendedor
- fato_solicitacoes: protocolos/chamados NOC. data_abertura=abertura, equipe=equipe, atendente=atendente
- csat_pesquisas: pesquisas CSAT. resposta_valor>=4 = promotor (nota como string)
- fato_pesquisas: pesquisas CSAT. nota>=4 = promotor (nota como número)
- fato_contratos: movimentação financeira. valor_total=valor, data_evento=data

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS SELECT (sem INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE)
2. Use SOMENTE tabelas e colunas do esquema acima
3. Inclua LIMIT de no máximo 200 linhas
4. Use aliases descritivos e legíveis nas colunas de resultado
5. Para datas, use DATE_FORMAT quando útil para legibilidade
6. Para percentuais, use ROUND(... * 100, 2)

Responda SOMENTE com JSON válido:
{"sql": "SELECT ...", "explanation": "Explicação curta do que a query faz e o resultado esperado"}`,
        },
        { role: 'user', content: question },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let parsed: { sql?: string; explanation?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json<NLQueryResponse>(
        { ok: false, error: 'Erro ao interpretar resposta da IA.' },
        { status: 500 },
      );
    }

    const rawSql = parsed.sql?.trim() || '';
    if (!rawSql || !isSafeSelect(rawSql)) {
      return NextResponse.json<NLQueryResponse>({
        ok: false,
        error: 'A IA gerou uma query inválida. Reformule a pergunta.',
        sql: rawSql,
      }, { status: 400 });
    }

    if (allowedTables !== 'all') {
      const mentionedTables = [...rawSql.matchAll(/\b(?:FROM|JOIN)\s+`?(\w+)`?/gi)]
        .map(m => m[1].toLowerCase());
      for (const t of mentionedTables) {
        if (!allowedTables.map(a => a.toLowerCase()).includes(t)) {
          return NextResponse.json<NLQueryResponse>(
            { ok: false, error: `Acesso negado à tabela: ${t}` },
            { status: 403 },
          );
        }
      }
    }

    const safeSql = enforceLimit(rawSql);
    const pool = getMysqlPool();

    const [rows] = await pool.query<RowDataPacket[]>(safeSql);
    const columns = rows.length > 0 ? Object.keys(rows[0] as object) : [];

    return NextResponse.json<NLQueryResponse>({
      ok: true,
      sql: safeSql,
      columns,
      rows: rows as Record<string, unknown>[],
      rowCount: rows.length,
      explanation: parsed.explanation,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[nl-query]', err);
    return NextResponse.json<NLQueryResponse>(
      { ok: false, error: `Erro: ${msg}` },
      { status: 500 },
    );
  }
}
