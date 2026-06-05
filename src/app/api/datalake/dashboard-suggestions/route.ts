import { NextRequest, NextResponse } from 'next/server';
import { suggestDashboards } from '@/modules/datalake/application/dashboard-suggestions';
import { getDatalakeOverview } from '@/modules/datalake/application/overview';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { prompt?: string };
    const prompt = body.prompt?.trim() || '';

    if (!prompt) {
      return NextResponse.json({ ok: false, error: 'Informe o objetivo do dashboard.' }, { status: 400 });
    }

    const overview = await getDatalakeOverview();
    if (!overview.ok) {
      return NextResponse.json({ ok: false, error: overview.message || 'Data Lake indisponivel.' }, { status: 503 });
    }

    const response = await suggestDashboards({
      prompt,
      tables: overview.tables,
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Falha ao sugerir dashboards.',
      },
      { status: 500 }
    );
  }
}
