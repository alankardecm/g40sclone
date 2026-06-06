import { NextResponse } from 'next/server';
import { getOverview } from '@/modules/crm/application/crm-store';

export const dynamic = 'force-dynamic';

// GET /api/crm/overview — KPIs + lista de clientes (Cliente 360) + funil de vendas.
export async function GET() {
  try {
    return NextResponse.json({ ok: true, overview: getOverview() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro ao carregar o CRM.' },
      { status: 500 },
    );
  }
}
