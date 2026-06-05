import { NextResponse } from 'next/server';

import { createMeeting, readMeetings } from '@/modules/netmeet/storage';

export async function GET() {
  try {
    const meetings = await readMeetings();
    return NextResponse.json({ ok: true, meetings });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const meeting = await createMeeting({
      title: String(body.title || ''),
      meetingLink: String(body.meetingLink || ''),
      classification: String(body.classification || 'interno'),
    });
    return NextResponse.json({ ok: true, meeting });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
