import { NextResponse } from 'next/server';
import { upsertMeetingFromBot } from '@/modules/netmeet/storage';
import type { NetMeetActionItem } from '@/modules/netmeet/storage';

function parseSummaryMarkdown(markdown: string) {
  const sections: Record<string, string[]> = {};
  let currentSection = '';

  for (const line of markdown.split('\n')) {
    const heading = line.match(/^##\s+(.+)/);
    if (heading) {
      currentSection = heading[1].trim();
      sections[currentSection] = [];
    } else if (currentSection && line.trim()) {
      sections[currentSection].push(line);
    }
  }

  const findSection = (pattern: RegExp) =>
    Object.keys(sections).find((k) => pattern.test(k)) || '';

  const extractBullets = (key: string) =>
    (sections[key] || [])
      .map((l) => l.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);

  const summaryKey = findSection(/resumo/i);
  const topicsKey = findSection(/topico/i);
  const summaryParts = [
    (sections[summaryKey] || []).join('\n').trim(),
    topicsKey ? `**Tópicos Discutidos:**\n${(sections[topicsKey] || []).join('\n').trim()}` : '',
  ].filter(Boolean);
  const summaryText = summaryParts.join('\n\n');

  const decisions = extractBullets(findSection(/decis/i));
  const risks = extractBullets(findSection(/atenc|risco/i));
  const nextSteps = extractBullets(findSection(/proximo|prox/i));

  const actionItemLines = extractBullets(findSection(/action|tarefa/i));
  const actionItems: NetMeetActionItem[] = actionItemLines.map((line) => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return { owner: '', task: line, due_date: null, status: 'open' };

    const owner = line.substring(0, colonIdx).trim();
    let task = line.substring(colonIdx + 1).trim();
    let due_date: string | null = null;

    const prazoMatch = task.match(/\(prazo:\s*([^)]+)\)/i);
    if (prazoMatch) {
      due_date = prazoMatch[1].trim();
      task = task.replace(prazoMatch[0], '').trim();
    }

    return { owner, task, due_date, status: 'open' };
  });

  return { summaryText: summaryText || markdown, decisions, risks, nextSteps, actionItems };
}

export async function POST(request: Request) {
  const apiKey = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!apiKey || apiKey !== process.env.NETMEET_BOT_API_KEY) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { externalId, title, meetingDate, organizerEmail, organizerName, meetingLink, summary, recipientEmail, provider } = body;

    if (!externalId || !title || !recipientEmail || !summary) {
      return NextResponse.json({ ok: false, error: 'externalId, title, recipientEmail e summary são obrigatórios' }, { status: 400 });
    }

    const parsed = parseSummaryMarkdown(String(summary));

    const meeting = await upsertMeetingFromBot({
      externalId: String(externalId),
      title: String(title),
      meetingDate: String(meetingDate || ''),
      organizerEmail: String(organizerEmail || ''),
      organizerName: String(organizerName || ''),
      meetingLink: String(meetingLink || ''),
      summary: parsed.summaryText,
      decisions: parsed.decisions,
      risks: parsed.risks,
      nextSteps: parsed.nextSteps,
      actionItems: parsed.actionItems,
      provider: String(provider || 'teams-bot'),
      recipientEmail: String(recipientEmail),
    });

    return NextResponse.json({ ok: true, meeting });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
