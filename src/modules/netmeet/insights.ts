import OpenAI from 'openai';

import type { NetMeetActionItem, NetMeetMeeting } from './storage';

type SummaryResult = {
  summary: string;
  decisions: string[];
  risks: string[];
  nextSteps: string[];
  actionItems: NetMeetActionItem[];
  provider: string;
};

function limitedUnique(items: string[], limit = 6) {
  const normalized = items.map((item) => item.trim()).filter(Boolean);
  return [...new Set(normalized)].slice(0, limit);
}

function fallbackSummary(transcript: string, classification: string): SummaryResult {
  const lines = transcript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const decisions = limitedUnique(lines.filter((line) => /decid|defin|combin|aprov/i.test(line)));
  const risks = limitedUnique(lines.filter((line) => /risco|atraso|bloqueio|problema|pendente/i.test(line)));
  const nextSteps = limitedUnique(lines.filter((line) => /proximo|vamos|enviar|ajustar|seguir/i.test(line)));
  const tasks = limitedUnique(lines.filter((line) => /enviar|fazer|validar|revisar|entregar|ajustar/i.test(line)));

  return {
    summary: lines.slice(0, 4).join(' ') || 'Sem transcript suficiente para gerar resumo.',
    decisions,
    risks,
    nextSteps,
    actionItems: tasks.map((task) => ({
      owner: 'A definir',
      task,
      due_date: null,
      status: 'open',
    })),
    provider: `fallback-${classification || 'interno'}`,
  };
}

export async function summarizeMeetingTranscript(input: {
  transcript: string;
  classification: string;
  title: string;
}): Promise<SummaryResult> {
  const transcript = input.transcript.trim();
  if (!transcript) {
    throw new Error('A reuniao precisa de transcript para gerar resumo.');
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  if (!groqApiKey) {
    return fallbackSummary(transcript, input.classification);
  }

  try {
    const client = new OpenAI({
      apiKey: groqApiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const response = await client.chat.completions.create({
      model: groqModel,
      temperature: 0.2,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Voce resume reunioes em portugues e responde apenas JSON valido com summary, decisions, risks, nextSteps e actionItems.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            title: input.title,
            classification: input.classification,
            transcript: transcript.slice(0, 24000),
            output: {
              summary: 'string',
              decisions: ['string'],
              risks: ['string'],
              nextSteps: ['string'],
              actionItems: [{ owner: 'string', task: 'string', due_date: 'string|null', status: 'open|done' }],
            },
          }),
        },
      ],
    });

    const content = response.choices[0]?.message?.content || '';
    const parsed = JSON.parse(content) as Partial<SummaryResult>;
    return {
      summary: String(parsed.summary || ''),
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map(String) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.map(String) : [],
      actionItems: Array.isArray(parsed.actionItems)
        ? parsed.actionItems.map((item) => ({
            owner: String(item.owner || 'A definir'),
            task: String(item.task || ''),
            due_date: item.due_date ? String(item.due_date) : null,
            status: String(item.status || 'open'),
          })).filter((item) => item.task)
        : [],
      provider: groqModel,
    };
  } catch {
    return fallbackSummary(transcript, input.classification);
  }
}

export async function publishMeetingToTeams(meeting: NetMeetMeeting, webhookUrl?: string) {
  const target = String(webhookUrl || process.env.TEAMS_WEBHOOK_URL || '').trim();
  if (!target) return false;

  const payload = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: `Resumo da reuniao ${meeting.title}`,
    themeColor: '0078D4',
    title: `NetMeet | ${meeting.title}`,
    sections: [
      {
        activityTitle: 'Resumo automatico da reuniao',
        facts: [
          { name: 'Classificacao', value: meeting.classification },
          { name: 'Provider', value: meeting.provider },
          { name: 'Criada em', value: meeting.createdAt },
        ],
        text: meeting.summary,
        markdown: true,
      },
      {
        title: 'Decisoes',
        text: meeting.decisions.map((item) => `- ${item}`).join('\n') || '- Nenhuma decisao identificada.',
        markdown: true,
      },
      {
        title: 'Action Items',
        text:
          meeting.actionItems.map((item) => `- ${item.owner}: ${item.task}`).join('\n') ||
          '- Nenhum action item identificado.',
        markdown: true,
      },
    ],
  };

  const response = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Falha ao publicar no Teams. Status ${response.status}.`);
  }

  return true;
}
