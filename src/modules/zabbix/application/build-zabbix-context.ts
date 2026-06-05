import { buildZabbixContext as buildLegacyZabbixContext } from '@/lib/zabbix';

export async function buildZabbixContext(query: string): Promise<string> {
  return buildLegacyZabbixContext(query);
}
