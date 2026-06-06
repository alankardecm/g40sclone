import { NextRequest, NextResponse } from 'next/server';
import { buildIspCockpit } from '@/modules/isp/application/isp-cockpit';
import { generateIspCopilot } from '@/modules/isp/application/isp-copilot';
import type { IspCockpit } from '@/shared/types/isp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/isp/cockpit?from=YYYY-MM-DD&to=YYYY-MM-DD
// Visão operacional unificada do provedor: NOC + churn + CSAT + copiloto de IA.
// Sem gate de sessão (consistente com /api/zabbix). Proteja via middleware/proxy se necessário.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;

    const data = await buildIspCockpit({ from, to });
    const copilot = await generateIspCopilot(data);
    const cockpit: IspCockpit = { ...data, copilot };

    return NextResponse.json({ ok: true, cockpit });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro ao montar o cockpit ISP.' },
      { status: 500 },
    );
  }
}
