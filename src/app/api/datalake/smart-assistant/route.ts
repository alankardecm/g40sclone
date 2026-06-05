import { NextRequest, NextResponse } from 'next/server';
import { smartWidgetAssistant } from '@/modules/datalake/application/smart-assistant';
import { auth } from '@/lib/auth';
import { getUserAllowedTables } from '@/lib/user-registry';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { prompt?: string };
    const prompt = body.prompt?.trim() || '';

    if (!prompt) {
      return NextResponse.json({ ok: false, error: 'O que voce gostaria de visualizar?' }, { status: 400 });
    }

    const session = await auth();
    const email = session?.user?.email ?? '';
    const allowedTables = await getUserAllowedTables(email);

    const response = await smartWidgetAssistant(prompt, allowedTables);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Falha ao processar pedido.',
      },
      { status: 500 }
    );
  }
}
