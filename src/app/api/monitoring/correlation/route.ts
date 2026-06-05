import { NextRequest, NextResponse } from 'next/server';
import { getNocWppCorrelation } from '@/modules/monitoring/application/correlation-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lookback = Math.min(Number(searchParams.get('lookback') || '120'), 1440); // Max 24h

    const incidents = await getNocWppCorrelation(lookback);

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      incidents,
      count: incidents.length,
    });
  } catch (error) {
    console.error('[Correlation API] Erro:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: error instanceof Error ? error.message : 'Falha ao correlacionar dados.' 
      }, 
      { status: 500 }
    );
  }
}
