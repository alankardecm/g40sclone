import { NextRequest, NextResponse } from 'next/server';
import { getConversation, markRead, reply, resolve } from '@/modules/communication/application/inbox-store';
import { suggestReply } from '@/modules/communication/application/inbox-agent';

export const dynamic = 'force-dynamic';

// GET /api/comms/conversations/:id — conversa completa (marca como lida).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const conversa = getConversation(id);
    if (!conversa) return NextResponse.json({ ok: false, error: 'Conversa não encontrada.' }, { status: 404 });
    markRead(id);
    return NextResponse.json({ ok: true, conversa });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Erro.' }, { status: 500 });
  }
}

// POST /api/comms/conversations/:id  body: { action: 'suggest' | 'reply' | 'resolve', texto?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const conversa = getConversation(id);
    if (!conversa) return NextResponse.json({ ok: false, error: 'Conversa não encontrada.' }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { action?: string; texto?: string };

    if (body.action === 'suggest') {
      const suggestion = await suggestReply(conversa);
      return NextResponse.json({ ok: true, suggestion });
    }
    if (body.action === 'reply') {
      const texto = (body.texto || '').trim();
      if (!texto) return NextResponse.json({ ok: false, error: 'Mensagem vazia.' }, { status: 400 });
      return NextResponse.json({ ok: true, conversa: reply(id, texto) });
    }
    if (body.action === 'resolve') {
      return NextResponse.json({ ok: true, conversa: resolve(id) });
    }
    return NextResponse.json({ ok: false, error: 'Ação inválida.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Erro.' }, { status: 500 });
  }
}
