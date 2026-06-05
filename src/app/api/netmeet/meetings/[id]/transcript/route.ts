import { NextRequest, NextResponse } from 'next/server';

import { updateMeeting } from '@/modules/netmeet/storage';

export async function POST(request: NextRequest, context: { params: Promise<unknown> }) {
  try {
    const { id } = (await context.params) as { id: string };
    const body = await request.json();
    const transcript = String(body.transcript || '').trim();
    const meeting = await updateMeeting(id, (current) => ({
      ...current,
      transcript,
    }));
    return NextResponse.json({ ok: true, meeting });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
