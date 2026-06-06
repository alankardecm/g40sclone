import OpenAI from 'openai';
import { getMediaBase64, sendText } from '@/lib/evolution-api';
import { createMeeting, updateMeeting } from '@/modules/netmeet/storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function transcribeBase64Audio(base64: string, mimeType: string): Promise<string> {
  const raw = base64.includes(',') ? base64.split(',')[1] : base64;
  const buffer = Buffer.from(raw, 'base64');

  const ext = mimeType.includes('ogg') ? 'ogg'
    : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'mp4'
    : mimeType.includes('wav') ? 'wav'
    : mimeType.includes('mp3') ? 'mp3'
    : 'ogg';

  const file = new File([buffer], `audio.${ext}`, { type: mimeType.split(';')[0] });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'whisper-1',
    language: 'pt',
  });

  return transcription.text;
}

type MeetingMinutes = {
  summary: string;
  decisions: string[];
  tasks: Array<{ owner: string; task: string; due_date: string | null }>;
};

async function generateAta(transcript: string): Promise<MeetingMinutes> {
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: `Gere uma ata de reunião em português a partir da transcrição abaixo.
Responda APENAS com JSON válido contendo:
- summary: string (resumo executivo em 2-4 frases)
- decisions: string[] (decisões tomadas, máximo 6)
- tasks: array de { owner: string, task: string, due_date: string|null } (máximo 8)

Transcrição:
${transcript.slice(0, 24000)}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  const cleaned = raw.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  return {
    summary: String(parsed.summary ?? ''),
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map(String) : [],
    tasks: Array.isArray(parsed.tasks)
      ? (parsed.tasks as Array<Record<string, unknown>>)
          .map(t => ({
            owner: String(t.owner ?? 'A definir'),
            task: String(t.task ?? ''),
            due_date: t.due_date ? String(t.due_date) : null,
          }))
          .filter(t => t.task)
      : [],
  };
}

function formatAta(minutes: MeetingMinutes): string {
  const lines: string[] = [];
  lines.push('🎙️ *Ata da Reunião*');
  lines.push('');
  lines.push('📋 *Resumo*');
  lines.push(minutes.summary || 'Sem resumo disponível.');

  if (minutes.decisions.length > 0) {
    lines.push('');
    lines.push('✅ *Decisões*');
    minutes.decisions.forEach(d => lines.push(`• ${d}`));
  }

  if (minutes.tasks.length > 0) {
    lines.push('');
    lines.push('📌 *Tarefas*');
    minutes.tasks.forEach(t => {
      const due = t.due_date ? ` · prazo: ${t.due_date}` : '';
      lines.push(`• *${t.owner}*: ${t.task}${due}`);
    });
  }

  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'AM OS';
  lines.push('');
  lines.push(`_${appName}_`);
  return lines.join('\n');
}

export async function handleAudioMeeting(
  instance: string,
  item: {
    key: { remoteJid: string; fromMe: boolean; id: string; participant?: string };
    message?: Record<string, unknown>;
    messageType: string;
    pushName?: string;
  },
  replyTo: string,
  userEmail?: string,
  senderName?: string,
): Promise<void> {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'AM OS';
  await sendText(instance, replyTo,
    '🎙️ *Reunião recebida!* Estou transcrevendo e gerando a ata.\n\n' +
    '⏱️ Gravações longas podem levar alguns minutos. ' +
    `Pode fechar o app — a ata chegará aqui quando estiver pronta e também ficará disponível no ${appName}.`
  );

  const media = await getMediaBase64(instance, item.key.id);

  const transcript = await transcribeBase64Audio(media.base64, media.mimetype || 'audio/ogg');

  const minutes = await generateAta(transcript);

  const meeting = await createMeeting({
    title: `Reunião WhatsApp — ${new Date().toLocaleDateString('pt-BR')}`,
    meetingLink: '',
    classification: 'whatsapp-audio',
  });

  await updateMeeting(meeting.id, m => ({
    ...m,
    transcript,
    summary: minutes.summary,
    decisions: minutes.decisions,
    actionItems: minutes.tasks.map(t => ({ ...t, status: 'open' as const })),
    provider: 'openai-whisper',
    userEmail: userEmail ?? undefined,
    senderPhone: replyTo,
    senderName: senderName ?? undefined,
  }));

  await sendText(instance, replyTo, formatAta(minutes));
}
