import { NextRequest, NextResponse } from 'next/server';
import { getMysqlPool, getMysqlConfig, isMysqlConfigured, isSafeTableName, isTableAllowed } from '@/infrastructure/datalake/mysql-client';
import type { RowDataPacket } from 'mysql2';
type ColumnRow = RowDataPacket & { COLUMN_NAME: string; COLUMN_TYPE: string };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get('table') || '';

  if (!isMysqlConfigured()) {
    return NextResponse.json({ ok: false, columns: [], error: 'MySQL não configurado.' }, { status: 503 });
  }

  if (!table || !isSafeTableName(table) || !isTableAllowed(table)) {
    return NextResponse.json({ ok: false, columns: [], error: 'Tabela inválida.' }, { status: 400 });
  }

  try {
    const pool = getMysqlPool();
    const config = getMysqlConfig();

    const [rows] = await pool.query<ColumnRow[]>(
      `SELECT COLUMN_NAME, COLUMN_TYPE
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = ?
       ORDER BY ORDINAL_POSITION ASC`,
      [config.database, table]
    );

    const columns = rows.map((row) => ({
      name: row.COLUMN_NAME,
      type: row.COLUMN_TYPE,
    }));

    return NextResponse.json({ ok: true, columns });
  } catch (error) {
    return NextResponse.json(
      { ok: false, columns: [], error: error instanceof Error ? error.message : 'Erro ao buscar colunas.' },
      { status: 500 }
    );
  }
}
