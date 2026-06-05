import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeGroupKey } from '@/lib/waGroups';
import { generateDailySummary } from '@/modules/communication/application/daily-summary';
import { buildRagContext } from '@/lib/rag';

type RouteBody = {
  date?: string;
  group_name?: string;
  group_id?: string;
};

type MessageRow = {
  id: string;
  group_id: string;
  text_raw: string;
  sender_name?: string | null;
  sender_jid?: string | null;
  created_at: string;
  wa_groups?: { id: string; name: string; whatsapp_jid?: string } | Array<{ id: string; name: string; whatsapp_jid?: string }>;
  wa_analysis?: Array<{
    sentiment?: 'positive' | 'neutral' | 'negative';
    sentiment_score?: number;
    keywords?: string[];
    urgency?: string;
    summary?: string;
    model_used?: string;
    analyzed_at?: string;
  }> | {
    sentiment?: 'positive' | 'neutral' | 'negative';
    sentiment_score?: number;
    keywords?: string[];
    urgency?: string;
    summary?: string;
    model_used?: string;
    analyzed_at?: string;
  };
};

type AnalysisRow = {
  sentiment?: 'positive' | 'neutral' | 'negative';
  sentiment_score?: number;
  keywords?: string[];
  urgency?: string;
  summary?: string;
  model_used?: string;
  analyzed_at?: string;
};

type GeneratedResult = {
  group_name: string;
  group_id: string;
  total_messages: number;
  sentiment_label: string;
  primary_keyword: string;
  urgency_label: string;
  summary_model_used: string;
};

type SkippedResult = {
  group_name: string;
  skipped: true;
  reason: 'no_messages';
};

function resolveDate(value?: string) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function getDateRange(date: string) {
  const start = new Date(`${date}T00:00:00-03:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function normalize(value: string | undefined | null) {
  return normalizeGroupKey(value || '');
}

function unwrapGroup(value: MessageRow['wa_groups']) {
  return Array.isArray(value) ? value[0] : value;
}

function unwrapAnalysis(value: MessageRow['wa_analysis']): AnalysisRow | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function isSkippedResult(item: GeneratedResult | SkippedResult): item is SkippedResult {
  return 'skipped' in item && item.skipped === true;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RouteBody;
    const date = resolveDate(body.date);
    const { start, end } = getDateRange(date);
    const targetGroupName = body.group_name ? normalize(body.group_name) : null;
    const targetGroupId = body.group_id?.trim() || null;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('wa_messages')
      .select(
        `
        id,
        group_id,
        text_raw,
        sender_name,
        sender_jid,
        created_at,
        wa_groups (
          id,
          name,
          whatsapp_jid
        ),
        wa_analysis (
          sentiment,
          sentiment_score,
          keywords,
          urgency,
          summary,
          model_used,
          analyzed_at
        )
      `
      )
      .gte('msg_timestamp', Math.floor(start.getTime() / 1000))
      .lt('msg_timestamp', Math.floor(end.getTime() / 1000))
      .order('msg_timestamp', { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const messages = (data || []) as MessageRow[];
    const bucketMap = new Map<
      string,
      {
        groupId: string;
        groupName: string;
        messages: MessageRow[];
      }
    >();

    messages.forEach((message) => {
      const group = unwrapGroup(message.wa_groups);
      const groupName = group?.name || '';
      const key = normalize(groupName);
      if (!key) return;
      if (targetGroupId && message.group_id !== targetGroupId) return;

      const current = bucketMap.get(key) || {
        groupId: message.group_id,
        groupName: groupName || message.group_id,
        messages: [],
      };
      current.messages.push(message);
      bucketMap.set(key, current);
    });

    const results: Array<GeneratedResult | SkippedResult> = [];
    const targetBuckets = [...bucketMap.entries()]
      .filter(([key, bucket]) => {
        if (targetGroupName && key !== targetGroupName) return false;
        if (targetGroupId && bucket.groupId !== targetGroupId) return false;
        return true;
      })
      .map(([, bucket]) => bucket);

    if (!targetBuckets.length && (targetGroupName || targetGroupId)) {
      return NextResponse.json({
        ok: true,
        date,
        generated: 0,
        results: [
          {
            group_name: body.group_name || body.group_id || 'grupo',
            skipped: true,
            reason: 'no_messages',
          },
        ],
      });
    }

    for (const bucket of targetBuckets) {
      if (!bucket.messages.length) continue;

      const analysisRows = bucket.messages
        .map((message) => unwrapAnalysis(message.wa_analysis))
        .filter((item): item is AnalysisRow => Boolean(item));

      const positive = analysisRows.filter((item) => item.sentiment === 'positive').length;
      const neutral = analysisRows.filter((item) => item.sentiment === 'neutral').length;
      const negative = analysisRows.filter((item) => item.sentiment === 'negative').length;
      const urgentCount = analysisRows.filter((item) => normalize(item.urgency) === 'critica').length;

      const keywordMap = new Map<string, number>();
      analysisRows.forEach((item) => {
        (item.keywords || []).forEach((keyword) => {
          const normalizedKeyword = String(keyword || '').trim();
          if (!normalizedKeyword) return;
          keywordMap.set(normalizedKeyword, (keywordMap.get(normalizedKeyword) || 0) + 1);
        });
      });

      const topKeywords = [...keywordMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([term, count]) => ({ term, count }));

      const sampleMessages = bucket.messages.slice(-10).map((message) => {
        const analysis = unwrapAnalysis(message.wa_analysis);
        return {
          author: message.sender_name || message.sender_jid || undefined,
          text: message.text_raw,
          sentiment: analysis?.sentiment,
          keywords: analysis?.keywords || [],
          created_at: message.created_at,
        };
      });

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
          console.error('Failed to fetch RAG context for daily summary:', ragError);
        }
      }

      const summaryResult = await generateDailySummary({
        groupName: bucket.groupName,
        date,
        totalMessages: bucket.messages.length,
        positive,
        neutral,
        negative,
        urgentCount,
        topKeywords,
        sampleMessages,
        contextDocs,
      });


      const { error: upsertError } = await supabase.from('wa_daily_insights').upsert(
        {
          group_id: bucket.groupId,
          date,
          total_messages: bucket.messages.length,
          sentiment_breakdown: { positive, neutral, negative },
          top_keywords: topKeywords,
          urgent_count: urgentCount,
          executive_summary: summaryResult.executiveSummary,
          sentiment_label: summaryResult.sentimentLabel,
          primary_keyword: summaryResult.primaryKeyword,
          urgency_label: summaryResult.urgencyLabel,
          summary_model_used: summaryResult.summaryModelUsed,
        },
        { onConflict: 'group_id,date' }
      );

      if (upsertError) {
        return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500 });
      }

      results.push({
        group_name: bucket.groupName,
        group_id: bucket.groupId,
        total_messages: bucket.messages.length,
        sentiment_label: summaryResult.sentimentLabel,
        primary_keyword: summaryResult.primaryKeyword,
        urgency_label: summaryResult.urgencyLabel,
        summary_model_used: summaryResult.summaryModelUsed,
      });
    }

    return NextResponse.json({
      ok: true,
      date,
      generated: results.filter((item) => !isSkippedResult(item)).length,
      results,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
