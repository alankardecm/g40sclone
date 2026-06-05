import { NextResponse } from 'next/server';
import {
  loadConversationCockpit,
  WaConversationSessionQueryError,
} from '@/modules/communication/application/load-conversation-cockpit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await loadConversationCockpit({
      groupId: searchParams.get('group_id'),
      groupName: searchParams.get('group_name'),
      days: Number(searchParams.get('days') || 1),
      dateFrom: searchParams.get('date_from'),
      dateTo: searchParams.get('date_to'),
      sessionGapMinutes: Number(searchParams.get('gap_minutes') || 90),
      protocolAttachWindowMinutes: Number(searchParams.get('protocol_attach_minutes') || 45),
      limit: Number(searchParams.get('limit') || 10000),
      slaYellowMinutes: Number(searchParams.get('sla_yellow') || 5),
      slaRedMinutes: Number(searchParams.get('sla_red') || 10),
      withSentiment: !['0', 'false', 'nao', 'no'].includes(
        String(searchParams.get('sentiment') ?? 'true').toLowerCase()
      ),
      sentimentBudget: Number(searchParams.get('sentiment_budget') || 12),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof WaConversationSessionQueryError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
