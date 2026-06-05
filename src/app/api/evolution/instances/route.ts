import { NextResponse } from 'next/server';
import { listInstances, createInstance } from '@/lib/evolution-api';

export async function GET() {
  try {
    const data = await listInstances();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name } = (await req.json()) as { name: string };
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const data = await createInstance(name);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
