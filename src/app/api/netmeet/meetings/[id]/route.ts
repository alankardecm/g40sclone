import { NextRequest, NextResponse } from 'next/server';

import { getMeeting } from '@/modules/netmeet/storage';

export async function GET(_: NextRequest, context: { params: Promise<unknown> }) {
  try {
    const { id } = (await context.params) as { id: string };
    const meeting = await getMeeting(id);
    if (!meeting) {
      return NextResponse.json({ ok: false, error: 'Reuniao nao encontrada.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, meeting });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
