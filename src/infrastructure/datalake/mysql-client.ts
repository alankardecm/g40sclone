import mysql from 'mysql2/promise';

type MysqlPool = mysql.Pool;

declare global {
  var __g4osMysqlPool__: MysqlPool | undefined;
}

function parseAllowedTables() {
  return (process.env.DATALAKE_ALLOWED_TABLES || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getMysqlConfig() {
  const host = process.env.MYSQL_HOST?.trim() || '';
  const port = Number(process.env.MYSQL_PORT || 3306);
  const database = process.env.MYSQL_DATABASE?.trim() || '';
  const user = process.env.MYSQL_USER?.trim() || '';
  const password = process.env.MYSQL_PASSWORD || '';
  const previewLimit = Math.min(Number(process.env.DATALAKE_PREVIEW_LIMIT || 25), 100);

  return {
    host,
    port,
    database,
    user,
    password,
    previewLimit: Number.isFinite(previewLimit) ? previewLimit : 25,
    allowedTables: parseAllowedTables(),
    enabled: Boolean(host && database && user),
  };
}

export function isMysqlConfigured() {
  return getMysqlConfig().enabled;
}

export function getMysqlPool() {
  if (!isMysqlConfigured()) {
    throw new Error('MySQL nao configurado no ambiente.');
  }

  if (!global.__g4osMysqlPool__) {
    const config = getMysqlConfig();
    global.__g4osMysqlPool__ = mysql.createPool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      namedPlaceholders: true,
      decimalNumbers: true,
      timezone: 'Z',
    });
  }

  return global.__g4osMysqlPool__;
}

export function isSafeTableName(tableName: string) {
  return /^[A-Za-z0-9_]+$/.test(tableName);
}

export function isTableAllowed(tableName: string) {
  const { allowedTables } = getMysqlConfig();
  if (allowedTables.length === 0) return true;
  return allowedTables.includes(tableName);
}
