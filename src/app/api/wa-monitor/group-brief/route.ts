import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateConversationBrief } from '@/modules/communication/application/conversation-brief';
import { buildRagContext } from '@/lib/rag';

type MessageRow = {
  id: string;
  sender_name: string | null;
  sender_jid: string | null;
  text_raw: string;
  created_at: string;
  wa_analysis:
    | {
        sentiment?: 'positive' | 'neutral' | 'negative' | null;
        sentiment_score?: number | null;
        keywords?: string[] | null;
        urgency?: string | null;
      }
    | {
        sentiment?: 'positive' | 'neutral' | 'negative' | null;
        sentiment_score?: number | null;
        keywords?: string[] | null;
        urgency?: string | null;
      }[]
    | null;
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');
    const groupName = searchParams.get('group_name');
    const days = Math.min(Number(searchParams.get('days') || '7') || 7, 31);

    if (!groupId && !groupName) {
      return NextResponse.json(
        { ok: false, error: 'Informe group_id ou group_name para gerar o resumo.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - days);
    const dateFrom = toIsoDate(searchParams.get('date_from'), defaultFrom.toISOString());
    const dateTo = toIsoDate(searchParams.get('date_to'), now.toISOString());

    const supabase = getSupabaseAdmin();
    let groupQuery = supabase.from('wa_groups').select('id, name').limit(1);

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
      return NextResponse.json({ ok: false, error: 'Grupo nao encontrado.' }, { status: 404 });
    }

    const { data: rawMessages, error: messagesError } = await supabase
      .from('wa_messages')
      .select(
        `
        id,
        sender_name,
        sender_jid,
        text_raw,
        created_at,
        wa_analysis (
          sentiment,
          sentiment_score,
          keywords,
          urgency
        )
      `
      )
      .eq('group_id', group.id)
      .gte('msg_timestamp', Math.floor(new Date(dateFrom).getTime() / 1000))
      .lte('msg_timestamp', Math.floor(new Date(dateTo).getTime() / 1000))
      .order('msg_timestamp', { ascending: true });

    if (messagesError) {
      return NextResponse.json({ ok: false, error: messagesError.message }, { status: 500 });
    }

    const messages = ((rawMessages || []) as MessageRow[]).map((item) => ({
      ...item,
      wa_analysis: Array.isArray(item.wa_analysis) ? item.wa_analysis[0] || null : item.wa_analysis,
    }));

    if (!messages.length) {
      return NextResponse.json(
        { ok: false, error: 'Nao existem mensagens para esse grupo no periodo informado.' },
        { status: 404 }
      );
    }

    const positive = messages.filter((item) => item.wa_analysis?.sentiment === 'positive').length;
    const neutral = messages.filter((item) => item.wa_analysis?.sentiment === 'neutral').length;
    const negative = messages.filter((item) => item.wa_analysis?.sentiment === 'negative').length;
    const urgentCount = messages.filter((item) => normalizeValue(item.wa_analysis?.urgency) === 'critica').length;

    const keywordMap = new Map<string, number>();
    const participantMap = new Map<string, number>();
    const participants = new Set<string>();

    messages.forEach((message) => {
      const participant = String(message.sender_name || message.sender_jid || '').trim();
      if (participant) {
        participants.add(participant);
        participantMap.set(participant, (participantMap.get(participant) || 0) + 1);
      }

      (message.wa_analysis?.keywords || []).forEach((keyword) => {
        const term = String(keyword || '').trim();
        if (!term) return;
        keywordMap.set(term, (keywordMap.get(term) || 0) + 1);
      });
    });

    const topKeywords = [...keywordMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([term, count]) => ({ term, count }));

    const topParticipants = [...participantMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const sampleMessages = messages
      .filter((message) => String(message.text_raw || '').trim())
      .slice(-40)
      .map((message) => ({
        author: message.sender_name || message.sender_jid || undefined,
        text: message.text_raw,
        sentiment: message.wa_analysis?.sentiment || undefined,
        keywords: message.wa_analysis?.keywords || [],
        created_at: message.created_at,
      }));

    // --- ENRICHMENT: RAG Context ---
    const searchQuery = topKeywords.map(k => k.term).join(' ');
    let contextDocs: string[] = [];
    
    if (searchQuery) {
      try {
        const ragResult = await buildRagContext(searchQuery);
        if (ragResult.context) {
          contextDocs = ragResult.context.split('\n\n---\n\n').filter(Boolean);
        }
      } catch (ragError) {
        console.error('Failed to fetch RAG context for group brief:', ragError);
      }
    }

    const brief = await generateConversationBrief({
      groupName: group.name,
      days,
      messageCount: messages.length,
      participantCount: participants.size,
      sentimentBreakdown: { positive, neutral, negative },
      urgentCount,
      topKeywords,
      topParticipants,
      sampleMessages,
      contextDocs,
    });


    return NextResponse.json({
      ok: true,
      group: {
        id: group.id,
        name: group.name,
      },
      period: {
        days,
        date_from: dateFrom,
        date_to: dateTo,
      },
      metrics: {
        messages: messages.length,
        participants: participants.size,
        sentiment_breakdown: { positive, neutral, negative },
        urgent_count: urgentCount,
        top_keywords: topKeywords,
        top_participants: topParticipants,
      },
      brief,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
