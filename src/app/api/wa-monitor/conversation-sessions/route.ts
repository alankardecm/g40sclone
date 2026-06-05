import { NextResponse } from 'next/server';
import {
  loadWaConversationSessions,
  WaConversationSessionQueryError,
} from '@/modules/communication/application/load-wa-conversation-sessions';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await loadWaConversationSessions({
      groupId: searchParams.get('group_id'),
      groupName: searchParams.get('group_name'),
      days: Number(searchParams.get('days') || 1),
      dateFrom: searchParams.get('date_from'),
      dateTo: searchParams.get('date_to'),
      sessionGapMinutes: Number(searchParams.get('gap_minutes') || 90),
      protocolAttachWindowMinutes: Number(searchParams.get('protocol_attach_minutes') || 45),
      aiReview: ['1', 'true', 'sim', 'yes'].includes(String(searchParams.get('ai') || '').toLowerCase()),
      maxAiMessages: Number(searchParams.get('max_ai_messages') || 120),
      limit: Number(searchParams.get('limit') || 10000),
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof WaConversationSessionQueryError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
