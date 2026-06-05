import { NextResponse } from 'next/server';
import {
  getInstanceStatus,
  connectInstance,
  logoutInstance,
  deleteInstance,
  setWebhook,
} from '@/lib/evolution-api';

type Ctx = { params: Promise<{ name: string }> };

// GET /api/evolution/instances/:name → status + QR code se estiver desconectado
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { name } = await ctx.params;
    const status = await getInstanceStatus(name);
    const state = status.instance.state;

    // Só pede QR quando não está conectado
    if (state === 'open') {
      return NextResponse.json({ name, state, qrcode: null, pairingCode: null });
    }

    const qr = await connectInstance(name).catch(() => null);
    return NextResponse.json({
      name,
      state,
      qrcode:      qr?.base64      ?? null,
      pairingCode: qr?.code        ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/evolution/instances/:name  { action: "connect" | "logout" | "webhook" }
export async function POST(req: Request, ctx: Ctx) {
  try {
    const { name } = await ctx.params;
    const body = (await req.json()) as { action: string; webhookUrl?: string };

    if (body.action === 'connect') {
      const data = await connectInstance(name);
      return NextResponse.json(data);
    }

    if (body.action === 'logout') {
      await logoutInstance(name);
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'webhook') {
      const url = body.webhookUrl;
      if (!url) return NextResponse.json({ error: 'webhookUrl required' }, { status: 400 });
      await setWebhook(name, url);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/evolution/instances/:name
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { name } = await ctx.params;
    await deleteInstance(name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
