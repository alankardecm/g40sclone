import { getMysqlConfig, getMysqlPool, isMysqlConfigured, isTableAllowed } from '@/infrastructure/datalake/mysql-client';
import type { DatalakeOverview, DatalakePreviewColumn, DatalakePreviewResult, DatalakeTableInfo } from '@/shared/types/datalake';
import mysql from 'mysql2';
import type { RowDataPacket } from 'mysql2';

type InformationSchemaTableRow = RowDataPacket & {
  TABLE_NAME: string;
  TABLE_ROWS: number | null;
  UPDATE_TIME: Date | string | null;
  ENGINE: string | null;
};

type InformationSchemaColumnRow = RowDataPacket & {
  COLUMN_NAME: string;
  COLUMN_TYPE: string;
  IS_NULLABLE: 'YES' | 'NO';
  COLUMN_KEY: string;
};

export async function getDatalakeOverview(allowedTables?: string[] | 'all'): Promise<DatalakeOverview> {
  const config = getMysqlConfig();

  if (!isMysqlConfigured()) {
    return {
      ok: false,
      status: 'disconnected',
      database: config.database || null,
      host: config.host || null,
      port: config.port || null,
      tableCount: 0,
      tables: [],
      previewLimit: config.previewLimit,
      message: 'Configure MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER e MYSQL_PASSWORD no .env.',
    };
  }

  try {
    const pool = getMysqlPool();
    const [rows] = await pool.query<InformationSchemaTableRow[]>(
      `
        SELECT TABLE_NAME, TABLE_ROWS, UPDATE_TIME, ENGINE
        FROM information_schema.tables
        WHERE table_schema = ?
        ORDER BY TABLE_NAME ASC
      `,
      [config.database]
    );

    const tables: DatalakeTableInfo[] = rows
      .filter((row) => isTableAllowed(row.TABLE_NAME))
      .filter((row) => {
        if (!allowedTables || allowedTables === 'all') return true
        if (allowedTables.length === 0) return false
        return allowedTables.includes(row.TABLE_NAME)
      })
      .map((row) => ({
        name: row.TABLE_NAME,
        rows: typeof row.TABLE_ROWS === 'number' ? row.TABLE_ROWS : null,
        updatedAt: row.UPDATE_TIME ? new Date(row.UPDATE_TIME).toISOString() : null,
        engine: row.ENGINE,
      }));

    return {
      ok: true,
      status: 'connected',
      database: config.database,
      host: config.host,
      port: config.port,
      tableCount: tables.length,
      tables,
      previewLimit: config.previewLimit,
    };
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      database: config.database || null,
      host: config.host || null,
      port: config.port || null,
      tableCount: 0,
      tables: [],
      previewLimit: config.previewLimit,
      message: error instanceof Error ? error.message : 'Falha ao conectar no MySQL.',
    };
  }
}

export async function getTablePreview(tableName: string, requestedLimit?: number): Promise<DatalakePreviewResult> {
  const config = getMysqlConfig();
  const pool = getMysqlPool();
  const limit = Math.max(1, Math.min(requestedLimit || config.previewLimit, config.previewLimit));
  const escapedTable = mysql.escapeId(tableName);

  const [columnRows] = await pool.query<InformationSchemaColumnRow[]>(
    `
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
      FROM information_schema.columns
      WHERE table_schema = ? AND table_name = ?
      ORDER BY ORDINAL_POSITION ASC
    `,
    [config.database, tableName]
  );

  const columns: DatalakePreviewColumn[] = columnRows.map((column) => ({
    name: column.COLUMN_NAME,
    type: column.COLUMN_TYPE,
    nullable: column.IS_NULLABLE === 'YES',
    key: column.COLUMN_KEY,
  }));

  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${escapedTable} LIMIT ${limit}`);

  return {
    ok: true,
    table: tableName,
    limit,
    columns,
    rows: rows as Array<Record<string, unknown>>,
  };
}
