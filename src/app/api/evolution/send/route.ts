import { NextResponse } from 'next/server';
import { sendText } from '@/lib/evolution-api';

export async function POST(req: Request) {
  try {
    const { instance, to, text } = (await req.json()) as {
      instance: string;
      to: string;
      text: string;
    };

    if (!instance || !to || !text) {
      return NextResponse.json({ error: 'instance, to e text são obrigatórios' }, { status: 400 });
    }

    const data = await sendText(instance, to, text);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
