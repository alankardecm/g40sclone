import { NextRequest, NextResponse } from 'next/server';
import { getCustomer } from '@/modules/crm/application/crm-store';

export const dynamic = 'force-dynamic';

// GET /api/crm/customers/:id — ficha completa do cliente (Cliente 360).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const customer = getCustomer(id);
    if (!customer) {
      return NextResponse.json({ ok: false, error: 'Cliente não encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, customer });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Erro ao carregar o cliente.' },
      { status: 500 },
    );
  }
}
