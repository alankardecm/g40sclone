import { NextResponse } from 'next/server';
import { isServerTtsConfigured, synthesizeSpeech } from '@/lib/tts';

type TtsRequestBody = {
  text?: string;
  title?: string;
};

function sanitizeFilename(value: string) {
  return String(value || 'resumo-grupo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export async function POST(request: Request) {
  try {
    if (!isServerTtsConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'TTS do servidor nao configurado. O front pode usar fallback local.' },
        { status: 501 }
      );
    }

    const body = (await request.json()) as TtsRequestBody;
    const text = String(body?.text || '').trim();

    if (!text) {
      return NextResponse.json({ ok: false, error: 'Informe o texto para gerar o audio.' }, { status: 400 });
    }

    const audio = await synthesizeSpeech(text);
    const filenameBase = sanitizeFilename(body?.title || 'resumo-grupo');

    return new NextResponse(audio.buffer, {
      status: 200,
      headers: {
        'Content-Type': audio.contentType,
        'Content-Length': String(audio.buffer.byteLength),
        'Cache-Control': 'no-store',
        'Content-Disposition': `inline; filename="${filenameBase}.${audio.fileExtension}"`,
        'X-TTS-Model': audio.model,
        'X-TTS-Voice': audio.voice,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Falha ao gerar audio.' }, { status: 500 });
  }
}
