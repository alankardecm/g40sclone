import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { loadWaConversationSessions } from '@/modules/communication/application/load-wa-conversation-sessions';

type MessageRow = {
  id: string;
  sender_name: string | null;
  text_raw: string;
  message_type: string | null;
  msg_timestamp: number | null;
  created_at: string;
  wa_analysis: {
    sentiment?: string | null;
    sentiment_score?: number | null;
    keywords?: string[] | null;
    urgency?: string | null;
  } | {
    sentiment?: string | null;
    sentiment_score?: number | null;
    keywords?: string[] | null;
    urgency?: string | null;
  }[] | null;
};

type DailyInsightRow = {
  date: string;
  total_messages: number;
  sentiment_breakdown: Record<string, number> | null;
  top_keywords: Array<{ term?: string; keyword?: string; count?: number }> | null;
  urgent_count: number;
  executive_summary: string | null;
  sentiment_label: string | null;
  primary_keyword: string | null;
  urgency_label: string | null;
};

function normalizeValue(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function toIsoDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function csvEscape(value: unknown) {
  const stringValue = String(value ?? '');
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function sanitizeFilePart(value: string) {
  return normalizeValue(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'grupo';
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '';
  const date = formatDate(iso);
  const time = formatTime(iso);
  return [date, time].filter(Boolean).join(' ');
}

function formatSentiment(value: string | null | undefined) {
  const map: Record<string, string> = {
    positive: 'Positivo',
    neutral: 'Neutro',
    negative: 'Negativo',
  };
  return map[String(value || '').toLowerCase()] ?? String(value || '');
}

function formatUrgency(value: string | null | undefined) {
  const map: Record<string, string> = {
    critical: 'Critica',
    high: 'Alta',
    alta: 'Alta',
    critica: 'Critica',
    medium: 'Media',
    media: 'Media',
    low: 'Baixa',
    baixa: 'Baixa',
  };
  return map[String(value || '').toLowerCase()] ?? String(value || '');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sheet = normalizeValue(searchParams.get('sheet') || 'messages');
    const groupId = searchParams.get('group_id');
    const groupName = searchParams.get('group_name');
    const days = Math.min(Number(searchParams.get('days') || '7') || 7, 31);

    if (!groupId && !groupName) {
      return NextResponse.json(
        { ok: false, error: 'Informe group_id ou group_name para exportar um grupo.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - days);

    const dateFrom = toIsoDate(searchParams.get('date_from'), defaultFrom.toISOString());
    const dateTo = toIsoDate(searchParams.get('date_to'), now.toISOString());
    const dailyDateFrom = dateFrom.slice(0, 10);
    const dailyDateTo = dateTo.slice(0, 10);

    const supabase = getSupabaseAdmin();
    let groupQuery = supabase
      .from('wa_groups')
      .select('id, name, whatsapp_jid, is_active')
      .limit(1);

    if (groupId) {
      groupQuery = groupQuery.eq('id', groupId);
    } else {
      groupQuery = groupQuery.ilike('name', groupName as string);
    }

    const { data: groupRows, error: groupError } = await groupQuery;
    if (groupError) {
      return NextResponse.json({ ok: false, error: groupError.message }, { status: 500 });
    }

    const group = groupRows?.[0];
    if (!group) {
      return NextResponse.json({ ok: false, error: 'Grupo nao encontrado para exportacao.' }, { status: 404 });
    }

    const filePart = sanitizeFilePart(group.name);

    // ─── SHEET: MENSAGENS ───────────────────────────────────────────────────
    if (sheet === 'messages' || sheet === 'mensagens') {
      const fromTs = Math.floor(new Date(dateFrom).getTime() / 1000);
      const toTs = Math.floor(new Date(dateTo).getTime() / 1000);
      const { data: rawMessages, error: messagesError } = await supabase
        .from('wa_messages')
        .select(`
          id,
          sender_name,
          text_raw,
          message_type,
          msg_timestamp,
          created_at,
          wa_analysis (
            sentiment,
            sentiment_score,
            keywords,
            urgency
          )
        `)
        .eq('group_id', group.id)
        .gte('msg_timestamp', fromTs)
        .lte('msg_timestamp', toTs)
        .order('msg_timestamp', { ascending: true });

      if (messagesError) {
        return NextResponse.json({ ok: false, error: messagesError.message }, { status: 500 });
      }

      const messages = ((rawMessages || []) as MessageRow[]).map((item) => ({
        ...item,
        wa_analysis: Array.isArray(item.wa_analysis) ? item.wa_analysis[0] || null : item.wa_analysis,
      }));

      const bom = '\uFEFF'; // BOM para Excel reconhecer UTF-8
      const lines = [
        ['Data', 'Hora', 'Remetente', 'Mensagem', 'Sentimento', 'Score', 'Urgencia', 'Palavras-chave'].join(';'),
      ];

      messages.forEach((msg) => {
        const analysis = msg.wa_analysis;
        lines.push([
          csvEscape(formatDate(msg.created_at)),
          csvEscape(formatTime(msg.created_at)),
          csvEscape(msg.sender_name || ''),
          csvEscape(msg.text_raw || ''),
          csvEscape(formatSentiment(analysis?.sentiment)),
          csvEscape(typeof analysis?.sentiment_score === 'number' ? analysis.sentiment_score.toFixed(2) : ''),
          csvEscape(formatUrgency(analysis?.urgency)),
          csvEscape((analysis?.keywords || []).join(', ')),
        ].join(';'));
      });

      return new NextResponse(bom + lines.join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="mensagens-${filePart}-${days}d.csv"`,
        },
      });
    }

    // ─── SHEET: RESUMO DIARIO ───────────────────────────────────────────────
    if (sheet === 'summary' || sheet === 'resumo') {
      const { data: rawInsights, error: insightsError } = await supabase
        .from('wa_daily_insights')
        .select(`
          date,
          total_messages,
          sentiment_breakdown,
          top_keywords,
          urgent_count,
          executive_summary,
          sentiment_label,
          primary_keyword,
          urgency_label
        `)
        .eq('group_id', group.id)
        .gte('date', dailyDateFrom)
        .lte('date', dailyDateTo)
        .order('date', { ascending: true });

      if (insightsError) {
        return NextResponse.json({ ok: false, error: insightsError.message }, { status: 500 });
      }

      const insights = (rawInsights || []) as DailyInsightRow[];
      const bom = '\uFEFF';
      const lines = [
        ['Data', 'Total Mensagens', 'Sentimento', 'Positivo', 'Neutro', 'Negativo', 'Urgentes', 'Nivel Urgencia', 'Palavra Principal', 'Resumo Executivo'].join(';'),
      ];

      insights.forEach((insight) => {
        const breakdown = insight.sentiment_breakdown || {};
        lines.push([
          csvEscape(insight.date),
          csvEscape(insight.total_messages),
          csvEscape(formatSentiment(insight.sentiment_label)),
          csvEscape(breakdown.positive ?? breakdown.positivo ?? ''),
          csvEscape(breakdown.neutral ?? breakdown.neutro ?? ''),
          csvEscape(breakdown.negative ?? breakdown.negativo ?? ''),
          csvEscape(insight.urgent_count),
          csvEscape(formatUrgency(insight.urgency_label)),
          csvEscape(insight.primary_keyword || ''),
          csvEscape(insight.executive_summary || ''),
        ].join(';'));
      });

      return new NextResponse(bom + lines.join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="resumo-diario-${filePart}-${days}d.csv"`,
        },
      });
    }

    // ─── SHEET: PALAVRAS ────────────────────────────────────────────────────
    if (sheet === 'keywords' || sheet === 'palavras') {
      const fromTs = Math.floor(new Date(dateFrom).getTime() / 1000);
      const toTs = Math.floor(new Date(dateTo).getTime() / 1000);
      const { data: rawMessages, error: messagesError } = await supabase
        .from('wa_messages')
        .select(`
          wa_analysis (
            keywords
          )
        `)
        .eq('group_id', group.id)
        .gte('msg_timestamp', fromTs)
        .lte('msg_timestamp', toTs);

      if (messagesError) {
        return NextResponse.json({ ok: false, error: messagesError.message }, { status: 500 });
      }

      const keywordMap = new Map<string, number>();
      ((rawMessages || []) as Array<{ wa_analysis: { keywords?: string[] | null } | { keywords?: string[] | null }[] | null }>).forEach((item) => {
        const analysis = Array.isArray(item.wa_analysis) ? item.wa_analysis[0] : item.wa_analysis;
        (analysis?.keywords || []).forEach((kw) => {
          const k = String(kw || '').trim();
          if (k) keywordMap.set(k, (keywordMap.get(k) || 0) + 1);
        });
      });

      const sorted = [...keywordMap.entries()].sort((a, b) => b[1] - a[1]);
      const bom = '\uFEFF';
      const lines = [
        ['Posicao', 'Palavra', 'Ocorrencias'].join(';'),
      ];

      sorted.forEach(([term, count], idx) => {
        lines.push([
          csvEscape(idx + 1),
          csvEscape(term),
          csvEscape(count),
        ].join(';'));
      });

      return new NextResponse(bom + lines.join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="palavras-${filePart}-${days}d.csv"`,
        },
      });
    }

    if (sheet === 'sessions' || sheet === 'conversas') {
      const sessionResult = await loadWaConversationSessions({
        groupId: group.id,
        days,
        dateFrom: searchParams.get('date_from'),
        dateTo: searchParams.get('date_to'),
        sessionGapMinutes: Number(searchParams.get('gap_minutes') || 90),
        protocolAttachWindowMinutes: Number(searchParams.get('protocol_attach_minutes') || 45),
        aiReview: ['1', 'true', 'sim', 'yes'].includes(String(searchParams.get('ai') || '').toLowerCase()),
        maxAiMessages: Number(searchParams.get('max_ai_messages') || 120),
        limit: Number(searchParams.get('limit') || 10000),
      });

      const bom = '\uFEFF';
      const lines = [
        [
          'Grupo',
          'Status',
          'Inicio',
          'Fechamento',
          'Motivo fechamento',
          'Duracao min',
          'Protocolo registrado',
          'Protocolos',
          'Primeira resposta min',
          'Sem resposta ate fechamento min',
          'Maior espera resposta min',
          'Maior sem atividade min',
          'Mensagens',
          'Participantes',
          'Iniciador',
          'Ultimo remetente',
          'Primeira mensagem',
          'Ultima mensagem',
        ].join(';'),
      ];

      sessionResult.sessions.forEach((session) => {
        lines.push([
          csvEscape(session.group_name),
          csvEscape(session.status === 'open' ? 'Aberta' : 'Fechada'),
          csvEscape(formatDateTime(session.started_at)),
          csvEscape(formatDateTime(session.closed_at)),
          csvEscape(session.close_reason === 'explicit_close' ? 'Fechamento explicito' : session.close_reason === 'inactivity' ? 'Inatividade' : ''),
          csvEscape(session.duration_minutes),
          csvEscape(session.protocol_registered ? 'Sim' : 'Nao'),
          csvEscape(session.protocols.join(', ')),
          csvEscape(session.first_response_minutes ?? 'Sem resposta'),
          csvEscape(session.unanswered_until_close_minutes ?? ''),
          csvEscape(session.max_unanswered_minutes),
          csvEscape(session.max_no_activity_minutes),
          csvEscape(session.message_count),
          csvEscape(session.participant_count),
          csvEscape(session.starter),
          csvEscape(session.last_sender),
          csvEscape(session.first_text),
          csvEscape(session.last_text),
        ].join(';'));
      });

      return new NextResponse(bom + lines.join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="conversas-${filePart}-${days}d.csv"`,
        },
      });
    }

    // ─── INVÁLIDO ───────────────────────────────────────────────────────────
    return NextResponse.json(
      { ok: false, error: 'Parametro sheet invalido. Use: messages, summary, keywords ou sessions.' },
      { status: 400 }
    );

  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
