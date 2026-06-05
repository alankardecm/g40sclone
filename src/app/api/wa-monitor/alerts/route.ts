import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const ALERT_URGENCIES = ['critica', 'alta'];
const ALERT_FLAGS = ['ofensa_ou_desqualificacao', 'incidente', 'urgente', 'palavra_critica'];

function getSaoPauloDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getSaoPauloStartOfDayTs(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T00:00:00-03:00`).getTime() / 1000);
}

type AnalysisRow = {
  id: string;
  message_id: string;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  sentiment_score: number | null;
  urgency: string | null;
  keywords: string[] | null;
  flags: string[] | null;
  summary: string | null;
  analyzed_at: string | null;
  wa_messages:
    | {
        id: string;
        group_id: string;
        sender_name: string | null;
        text_raw: string;
        msg_timestamp: number | null;
        wa_groups: { id: string; name: string } | Array<{ id: string; name: string }> | null;
      }
    | Array<{
        id: string;
        group_id: string;
        sender_name: string | null;
        text_raw: string;
        msg_timestamp: number | null;
        wa_groups: { id: string; name: string } | Array<{ id: string; name: string }> | null;
      }>
    | null;
};

function resolveAlertType(urgency: string | null, flags: string[]): string {
  if (flags.includes('ofensa_ou_desqualificacao')) return 'ofensa';
  if (flags.includes('incidente')) return 'incidente';
  if (flags.includes('urgente')) return 'urgente';
  if (urgency === 'critica') return 'critico';
  return 'alerta';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(Number(searchParams.get('days') || '1') || 1, 30);
    const groupId = searchParams.get('group_id') || null;
    const limit = Math.min(Number(searchParams.get('limit') || '100') || 100, 500);

    const todayStr = getSaoPauloDateString();
    let sinceTs: number;

    if (days === 1) {
      sinceTs = getSaoPauloStartOfDayTs(todayStr);
    } else {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      sinceTs = getSaoPauloStartOfDayTs(getSaoPauloDateString(cutoff));
    }

    const supabase = getSupabaseAdmin();

    const selectClause = `
      id,
      message_id,
      sentiment,
      sentiment_score,
      urgency,
      keywords,
      flags,
      summary,
      analyzed_at,
      wa_messages!inner(
        id,
        group_id,
        sender_name,
        text_raw,
        msg_timestamp,
        wa_groups!inner(id, name)
      )
    `;

    const [urgencyResult, flagsResult] = await Promise.all([
      supabase
        .from('wa_analysis')
        .select(selectClause)
        .in('urgency', ALERT_URGENCIES)
        .order('analyzed_at', { ascending: false })
        .limit(limit),
      supabase
        .from('wa_analysis')
        .select(selectClause)
        .overlaps('flags', ALERT_FLAGS)
        .order('analyzed_at', { ascending: false })
        .limit(limit),
    ]);

    const allItems = [
      ...((urgencyResult.data || []) as unknown as AnalysisRow[]),
      ...((flagsResult.data || []) as unknown as AnalysisRow[]),
    ];

    const seen = new Set<string>();
    const alerts = allItems
      .filter((item) => {
        const msg = Array.isArray(item.wa_messages) ? item.wa_messages[0] : item.wa_messages;
        if (!msg) return false;
        if ((msg.msg_timestamp ?? 0) < sinceTs) return false;
        if (groupId && msg.group_id !== groupId) return false;
        return true;
      })
      .filter((item) => {
        if (seen.has(item.message_id)) return false;
        seen.add(item.message_id);
        return true;
      })
      .map((item) => {
        const msg = Array.isArray(item.wa_messages) ? item.wa_messages[0] : item.wa_messages;
        const group = Array.isArray(msg?.wa_groups) ? msg?.wa_groups[0] : msg?.wa_groups;
        const flags = (item.flags || []) as string[];

        return {
          id: item.id,
          message_id: item.message_id,
          group_id: msg?.group_id ?? null,
          group_name: group?.name ?? 'Desconhecido',
          sender_name: msg?.sender_name ?? null,
          message_text: msg?.text_raw ?? '',
          msg_timestamp: msg?.msg_timestamp ?? 0,
          alert_type: resolveAlertType(item.urgency, flags),
          severity: item.urgency ?? 'media',
          sentiment: item.sentiment,
          sentiment_score: item.sentiment_score,
          keywords: item.keywords ?? [],
          flags,
          summary: item.summary ?? null,
          analyzed_at: item.analyzed_at,
        };
      })
      .sort((a, b) => b.msg_timestamp - a.msg_timestamp);

    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byGroup: Record<string, number> = {};

    for (const alert of alerts) {
      bySeverity[alert.severity] = (bySeverity[alert.severity] ?? 0) + 1;
      byType[alert.alert_type] = (byType[alert.alert_type] ?? 0) + 1;
      if (alert.group_name) {
        byGroup[alert.group_name] = (byGroup[alert.group_name] ?? 0) + 1;
      }
    }

    return NextResponse.json({
      ok: true,
      period: { days, since_ts: sinceTs },
      summary: {
        total: alerts.length,
        by_severity: bySeverity,
        by_type: byType,
        by_group: byGroup,
      },
      alerts,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
