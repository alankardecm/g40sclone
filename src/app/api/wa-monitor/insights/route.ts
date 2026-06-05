import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// ── Helpers de timezone São Paulo ─────────────────────────────────────────────

function getSaoPauloDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Retorna timestamp Unix (segundos) do início do dia em São Paulo */
function getSaoPauloStartOfDayTs(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T00:00:00-03:00`).getTime() / 1000);
}

function normalizeValue(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type GroupRow = {
  id: string;
  name: string;
  whatsapp_jid?: string | null;
  is_active?: boolean | null;
};

type MessageRow = {
  id: string;
  group_id: string;
  msg_timestamp: number;
  text_raw: string;
  sender_name: string | null;
  sender_jid: string | null;
  wa_groups: { id: string; name: string } | Array<{ id: string; name: string }> | null;
};

type AnalysisRow = {
  id: string;
  message_id: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentiment_score?: number;
  keywords?: string[];
  urgency?: string;
  wa_messages?: {
    group_id?: string;
    msg_timestamp?: number;
    text_raw?: string;
    sender_name?: string | null;
    sender_jid?: string | null;
    wa_groups?: { id: string; name: string } | Array<{ id: string; name: string }> | null;
  };
};

export type MsgItem = {
  id: string;
  text: string;
  sender: string;
  timestamp: number; // Unix seconds
  sentiment?: 'positive' | 'neutral' | 'negative';
  urgency?: string;
  keywords?: string[];
};

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(Number(searchParams.get('days') || '7') || 7, 30);

    // ── Calcular cutoff pelo timestamp REAL da mensagem (não created_at do banco)
    // A raiz do bug "quinta no hoje": a bridge insere msgs antigas via backfill com
    // created_at = agora, mas msg_timestamp = quando foi enviado no WhatsApp.
    // Filtrar por msg_timestamp corrige isso completamente.

    const todayStrSP = getSaoPauloDateString();
    let sinceTs: number;
    let sinceDateStr: string;

    if (days === 1) {
      // "Hoje" = desde meia-noite de São Paulo (não desde há 24h)
      sinceTs = getSaoPauloStartOfDayTs(todayStrSP);
      sinceDateStr = todayStrSP;
    } else {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      sinceDateStr = getSaoPauloDateString(cutoffDate);
      sinceTs = getSaoPauloStartOfDayTs(sinceDateStr);
    }

    const supabase = getSupabaseAdmin();

    // Paralelo: grupos + mensagens (by msg_timestamp) + análise (by msg_timestamp via join) + insights diários
    const [groupsRes, messagesRes, analysisRes, insightsRes] = await Promise.all([
      supabase.from('wa_groups').select('id, name, whatsapp_jid, is_active'),

      // CORREÇÃO CRÍTICA: filtrar por msg_timestamp (tempo real do WhatsApp)
      supabase
        .from('wa_messages')
        .select('id, group_id, msg_timestamp, text_raw, sender_name, sender_jid, wa_groups!inner(id, name)')
        .gte('msg_timestamp', sinceTs)
        .order('msg_timestamp', { ascending: false })
        .limit(3000),

      // CORREÇÃO CRÍTICA: analysis filtrado pelo msg_timestamp da mensagem pai (inner join)
      supabase
        .from('wa_analysis')
        .select('id, message_id, sentiment, sentiment_score, keywords, urgency, wa_messages!inner(group_id, msg_timestamp, text_raw, sender_name, sender_jid, wa_groups!inner(id, name))')
        .gte('wa_messages.msg_timestamp', sinceTs)
        .order('wa_messages.msg_timestamp', { ascending: false })
        .limit(5000),

      // Daily insights pelo date de São Paulo
      supabase
        .from('wa_daily_insights')
        .select('*')
        .gte('date', sinceDateStr),
    ]);

    const groups = (groupsRes.data || []) as GroupRow[];
    const messages = (messagesRes.data || []) as unknown as MessageRow[];
    const analysis = (analysisRes.data || []) as unknown as AnalysisRow[];
    const storedInsights = insightsRes.data || [];

    // ── Métricas de sentimento ────────────────────────────────────────────────

    const positive = analysis.filter((i) => i.sentiment === 'positive').length;
    const neutral = analysis.filter((i) => i.sentiment === 'neutral').length;
    const negative = analysis.filter((i) => i.sentiment === 'negative').length;
    const urgent = analysis.filter((i) => normalizeValue(i.urgency) === 'critica').length;

    const avgSentiment =
      analysis.length > 0
        ? Number(
            (
              analysis.reduce((s, i) => s + Number(i.sentiment_score || 0), 0) / analysis.length
            ).toFixed(2)
          )
        : 0;

    // ── Keywords ──────────────────────────────────────────────────────────────

    const keywordMap = new Map<string, number>();
    analysis.forEach((item) => {
      (item.keywords || []).forEach((kw) => keywordMap.set(kw, (keywordMap.get(kw) || 0) + 1));
    });
    const topKeywords = [...keywordMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([term, count]) => ({ term, count }));

    // ── Lookup analysis por message_id ────────────────────────────────────────

    const analysisById = new Map<string, AnalysisRow>();
    analysis.forEach((a) => analysisById.set(a.message_id, a));

    // ── Construir feed de mensagens por grupo ─────────────────────────────────

    type ConvData = {
      group_id: string;
      group_name: string;
      count: number;
      last_text: string;
      last_at: string;
      last_ts: number;
      negative_count: number;
      recent_messages: MsgItem[];
    };

    const conversationMap = new Map<string, ConvData>();

    // Processar mensagens em ordem cronológica (já estão desc, invertemos para asc)
    const messagesAsc = [...messages].sort((a, b) => a.msg_timestamp - b.msg_timestamp);

    messagesAsc.forEach((msg) => {
      const groupArr = Array.isArray(msg.wa_groups) ? msg.wa_groups : msg.wa_groups ? [msg.wa_groups] : [];
      const group = groupArr[0];
      const groupId = msg.group_id;
      const groupName = group?.name || 'Grupo';
      const ana = analysisById.get(msg.id);

      if (!conversationMap.has(groupId)) {
        conversationMap.set(groupId, {
          group_id: groupId,
          group_name: groupName,
          count: 0,
          last_text: '',
          last_at: '',
          last_ts: 0,
          negative_count: 0,
          recent_messages: [],
        });
      }

      const conv = conversationMap.get(groupId)!;
      conv.count += 1;
      conv.group_name = groupName;

      if (msg.msg_timestamp > conv.last_ts) {
        conv.last_ts = msg.msg_timestamp;
        conv.last_at = new Date(msg.msg_timestamp * 1000).toISOString();
        conv.last_text = msg.text_raw || '';
      }

      if (ana?.sentiment === 'negative') conv.negative_count += 1;

      conv.recent_messages.push({
        id: msg.id,
        text: msg.text_raw || '',
        sender: msg.sender_name || msg.sender_jid || 'Desconhecido',
        timestamp: msg.msg_timestamp,
        sentiment: ana?.sentiment,
        urgency: ana?.urgency,
        keywords: ana?.keywords || [],
      });
    });

    // Manter apenas as últimas 20 mensagens por grupo (para o feed de conversas)
    conversationMap.forEach((conv) => {
      conv.recent_messages = conv.recent_messages.slice(-20);
    });

    // Conversações ordenadas pela última atividade (mais recente primeiro)
    const conversations = [...conversationMap.values()].sort((a, b) => b.last_ts - a.last_ts);

    return NextResponse.json({
      ok: true,
      summary: {
        messages_7d: messages.length,
        groups_active: groups.filter((g) => g.is_active).length,
        sentiment_average: avgSentiment,
        positive,
        neutral,
        negative,
        urgent,
      },
      top_keywords: topKeywords,
      conversations,
      stored_insights: storedInsights,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
