import { NextResponse } from 'next/server';
import { getInbox } from '@/modules/communication/application/inbox-store';

export const dynamic = 'force-dynamic';

// GET /api/comms/inbox — estatísticas + lista de conversas (resumo).
export async function GET() {
  try {
    return NextResponse.json({ ok: true, inbox: getInbox() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro ao carregar o inbox.' },
      { status: 500 },
    );
  }
}
