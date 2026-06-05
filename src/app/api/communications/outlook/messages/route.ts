import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { listOutlookMessages, refreshOutlookAccessToken } from '@/lib/outlook';

type OutlookMessageRow = {
  id: string;
  group_id: string;
  sender_jid?: string | null;
  sender_name?: string | null;
  text_raw: string;
  msg_timestamp?: number | null;
  created_at: string;
  source_type?: string | null;
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

async function resolveAccessToken() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('outlook_access_token')?.value;
  const refreshToken = cookieStore.get('outlook_refresh_token')?.value;

  if (accessToken) return accessToken;
  if (!refreshToken) return null;

  const refreshed = await refreshOutlookAccessToken(refreshToken);
  cookieStore.set('outlook_access_token', refreshed.access_token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max((refreshed.expires_in || 3600) - 60, 300),
  });

  if (refreshed.refresh_token) {
    cookieStore.set('outlook_refresh_token', refreshed.refresh_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return refreshed.access_token;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || '15') || 15, 50);

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
        source_type,
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
      .eq('source_type', 'outlook_email')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const messages = ((data || []) as OutlookMessageRow[]).map((item) => ({
      ...item,
      wa_groups: Array.isArray(item.wa_groups) ? item.wa_groups[0] : item.wa_groups,
      wa_analysis: Array.isArray(item.wa_analysis) ? item.wa_analysis[0] : item.wa_analysis,
    }));

    if (messages.length > 0) {
      return NextResponse.json({ ok: true, messages, source: 'database' });
    }

    const accessToken = await resolveAccessToken();
    if (!accessToken) {
      return NextResponse.json({ ok: true, messages: [], source: 'database' });
    }

    const liveMessages = await listOutlookMessages(accessToken, limit);
    const fallbackMessages = liveMessages.map((message) => ({
      id: message.id,
      group_id: message.conversationId || message.id,
      sender_jid: message.from?.emailAddress?.address || null,
      sender_name: message.from?.emailAddress?.name || null,
      text_raw: [message.subject ? `Assunto: ${message.subject}.` : '', message.bodyPreview || message.body?.content || '']
        .filter(Boolean)
        .join(' ')
        .trim(),
      msg_timestamp: message.receivedDateTime ? Math.floor(new Date(message.receivedDateTime).getTime() / 1000) : null,
      created_at: message.receivedDateTime || new Date().toISOString(),
      source_type: 'outlook_email_live',
      wa_groups: {
        id: message.conversationId || message.id,
        name: message.subject || `Email de ${message.from?.emailAddress?.name || message.from?.emailAddress?.address || 'contato'}`,
        whatsapp_jid: undefined,
      },
      wa_analysis: {
        sentiment: 'neutral',
        summary: message.bodyPreview || message.subject || 'Email sincronizado do Outlook.',
        urgency: 'baixa',
        keywords: [],
      },
    }));

    return NextResponse.json({ ok: true, messages: fallbackMessages, source: 'live_outlook' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
