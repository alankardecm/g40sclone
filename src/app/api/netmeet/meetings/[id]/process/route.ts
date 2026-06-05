import { NextRequest, NextResponse } from 'next/server';

import { publishMeetingToTeams, summarizeMeetingTranscript } from '@/modules/netmeet/insights';
import { getMeeting, updateMeeting } from '@/modules/netmeet/storage';

export async function POST(request: NextRequest, context: { params: Promise<unknown> }) {
  try {
    const { id } = (await context.params) as { id: string };
    const body = await request.json();
    const meeting = await getMeeting(id);
    if (!meeting) {
      return NextResponse.json({ ok: false, error: 'Reuniao nao encontrada.' }, { status: 404 });
    }

    const summary = await summarizeMeetingTranscript({
      transcript: meeting.transcript,
      classification: String(body.classification || meeting.classification),
      title: meeting.title,
    });

    const updatedMeeting = await updateMeeting(id, (current) => ({
      ...current,
      classification: String(body.classification || current.classification),
      summary: summary.summary,
      decisions: summary.decisions,
      risks: summary.risks,
      nextSteps: summary.nextSteps,
      actionItems: summary.actionItems,
      provider: summary.provider,
    }));

    const published = await publishMeetingToTeams(updatedMeeting, body.webhookUrl ? String(body.webhookUrl) : undefined);

    const finalMeeting = published
      ? await updateMeeting(id, (current) => ({
          ...current,
          publishedToTeams: true,
        }))
      : updatedMeeting;

    return NextResponse.json({ ok: true, meeting: finalMeeting, publishedToTeams: published });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
