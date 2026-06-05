import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

type EventRow = {
  id: string;
  group_id: string;
  sender_jid?: string | null;
  sender_name?: string | null;
  text_raw: string;
  msg_timestamp?: number | null;
  created_at: string;
  wa_groups?: { id: string; name: string; whatsapp_jid?: string } | Array<{ id: string; name: string; whatsapp_jid?: string }>;
  wa_analysis?:
    | {
        sentiment?: 'positive' | 'neutral' | 'negative';
        sentiment_score?: number;
        keywords?: string[];
        topic?: string;
        urgency?: string;
        summary?: string;
        flags?: string[];
        analyzed_at?: string;
      }
    | Array<{
        sentiment?: 'positive' | 'neutral' | 'negative';
        sentiment_score?: number;
        keywords?: string[];
        topic?: string;
        urgency?: string;
        summary?: string;
        flags?: string[];
        analyzed_at?: string;
      }>;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || '20') || 20, 100);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('wa_messages')
      .select(`
        id,
        group_id,
        sender_jid,
        sender_name,
        text_raw,
        msg_timestamp,
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
          topic,
          urgency,
          summary,
          flags,
          analyzed_at
        )
      `)
      .order('msg_timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const events = ((data || []) as EventRow[]).map((item) => ({
      ...item,
      wa_groups: Array.isArray(item.wa_groups) ? item.wa_groups[0] : item.wa_groups,
      wa_analysis: Array.isArray(item.wa_analysis) ? item.wa_analysis[0] : item.wa_analysis,
    }));

    return NextResponse.json({ ok: true, events });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
