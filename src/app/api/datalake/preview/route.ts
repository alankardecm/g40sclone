import { NextRequest, NextResponse } from 'next/server';
import { getTablePreview } from '@/modules/datalake/application/overview';
import { isSafeTableName, isTableAllowed } from '@/infrastructure/datalake/mysql-client';

export async function GET(request: NextRequest) {
  const table = request.nextUrl.searchParams.get('table')?.trim() || '';
  const limit = Number(request.nextUrl.searchParams.get('limit') || 0);

  if (!table || !isSafeTableName(table) || !isTableAllowed(table)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Tabela invalida ou nao autorizada.',
      },
      { status: 400 }
    );
  }

  try {
    const preview = await getTablePreview(table, limit);
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Falha ao carregar preview.',
      },
      { status: 500 }
    );
  }
}
