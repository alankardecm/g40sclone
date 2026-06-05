// Zabbix 6.2 API client — usa http nativo do Node para evitar o interceptor de fetch do Next.js
// Auth: Bearer token no header Authorization (Zabbix 6.0+)

import http from 'http';
import https from 'https';

// ─── TIPOS ───────────────────────────────────────────────────────────────────

export type ZabbixProblem = {
  eventid: string;
  objectid: string;
  clock: string;
  name: string;
  severity: string;
  acknowledged: string;
  hosts?: { hostid: string; name: string }[];
  tags?: { tag: string; value: string }[];
  suppressed?: string;
};

export type ZabbixHost = {
  hostid: string;
  host: string;
  name: string;
  status: string;
  available?: string;
  snmp_available?: string;
  jmx_available?: string;
  ipmi_available?: string;
  interfaces?: { ip: string; port: string; type: string; main: string; available?: string }[];
  groups?: { groupid: string; name: string }[];
};

export type ZabbixEvent = {
  eventid: string;
  clock: string;
  name: string;
  severity: string;
  acknowledged: string;
  value: string;
  hosts?: { hostid: string; name: string }[];
  acknowledges?: { clock: string; message: string; users: { name: string }[] }[];
};

export type ZabbixItem = {
  itemid: string;
  hostid: string;
  name: string;
  key_: string;
  lastvalue: string;
  lastclock: string;
  units: string;
  value_type: string;
};

export type ZabbixHistoryValue = {
  itemid: string;
  clock: string;
  value: string;
};

export type ZabbixAvailabilityPoint = {
  clock: number;
  label: string;
  value: number;
  status: 'up' | 'down' | 'unknown';
};

export type ZabbixAvailabilitySeries = {
  host: {
    hostid: string;
    name: string;
    itemid: string;
    itemKey: string;
  };
  intervalMinutes: number;
  hours: number;
  summary: {
    uptimePercent: number;
    upBuckets: number;
    downBuckets: number;
    unknownBuckets: number;
    totalBuckets: number;
    downTransitions: number;
    lastDownClock: number | null;
  };
  points: ZabbixAvailabilityPoint[];
};

export type ZabbixSummary = {
  totalProblems: number;
  disasters: number;
  highSeverity: number;
  hostsUp: number;
  hostsDown: number;
  hostsUnknown: number;
  totalHosts: number;
};

export const SEVERITY_LABEL: Record<string, string> = {
  '0': 'Nao classificado',
  '1': 'Informacao',
  '2': 'Aviso',
  '3': 'Media',
  '4': 'Alta',
  '5': 'Desastre',
};

export const SEVERITY_COLOR: Record<string, string> = {
  '0': 'text-stone-400 bg-stone-500/10 border-stone-500/20',
  '1': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  '2': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  '3': 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  '4': 'text-red-400 bg-red-500/10 border-red-500/20',
  '5': 'text-neon-pink bg-neon-pink/10 border-neon-pink/20',
};

const DEFAULT_ALLOWED_GROUPS = [
  'Backbone',
  'POP',
  'Rede de Acesso',
  'CLIENTE-BASE',
  'CLIENTE-CORPORATIVO',
  'CLIENTE-ENTREGUE-SEM-CPE',
  'CLIENTE-FREECORE',
  'CLIENTE-ISP',
  'CLIENTE-OPERADORA',
  'CLIENTE-ORGAO-PUBLICO',
  'CLIENTE-PME',
  'CLIENTE-TOP-CORPORATIVO',
  'CLIENTES-FREECORE',
  'CLIENTES_CANCELAMENTO',
];
const ZABBIX_STOPWORDS = new Set([
  'cliente',
  'clientes',
  'alarme',
  'alarmes',
  'ativo',
  'ativos',
  'agora',
  'momento',
  'momento',
  'no',
  'na',
  'nas',
  'nos',
  'em',
  'teve',
  'tem',
  'esta',
  'estao',
  'estava',
  'apresentou',
  'possui',
  'com',
  'algum',
  'alguma',
  'ultimas',
  'ultimos',
  'horas',
  'hora',
  'dias',
  'dia',
  'status',
  'ativo',
  'ativos',
]);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getBaseUrl() {
  const url = process.env.ZABBIX_URL?.trim().replace(/\/$/, '') || '';
  if (!url) throw new Error('ZABBIX_URL nao configurado no .env');
  
  if (url.endsWith('/api_jsonrpc.php')) {
    return url;
  }
  return `${url}/api_jsonrpc.php`;
}

function getToken() {
  const token = process.env.ZABBIX_API_TOKEN?.trim();
  if (!token) throw new Error('ZABBIX_API_TOKEN nao configurado no .env');
  return token;
}

function getAuthMode() {
  const mode = process.env.ZABBIX_AUTH_MODE?.trim().toLowerCase();
  if (mode === 'header' || mode === 'body' || mode === 'auto') return mode;
  return 'auto';
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeText(value: string) {
  return normalizeText(value)
    .split(' ')
    .map((part) => part.trim())
    .filter((part) => part.length > 2 && !ZABBIX_STOPWORDS.has(part));
}

function extractClientName(query: string) {
  const normalized = normalizeText(query);
  const patterns = [
    /\bcliente\s+(?:do|da|de|dos|das|o|a)?\s*(.+?)(?:\s+(?:teve|tem|esta|estava|apresentou|apresenta|possui|com|no|na|nas|nos|em|agora|ativo|ativos|ultimas|ultimos|alarme|alarmes|status|evento|eventos|pppoe|down|offline|caiu|desastre)\b|[?.!,]|$)/,
    /\bcliente[:\s]+(.+?)(?:\s+(?:teve|tem|esta|estava|apresentou|apresenta|possui|com|no|na|nas|nos|em|agora|ativo|ativos|ultimas|ultimos|alarme|alarmes|status|evento|eventos|pppoe|down|offline|caiu|desastre)\b|[?.!,]|$)/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }

  return '';
}

function parseLookbackHours(query: string) {
  const normalized = normalizeText(query);
  const explicit = normalized.match(/\b(\d{1,3})\s*horas?\b/);
  if (explicit?.[1]) return Math.max(1, Math.min(720, Number(explicit[1])));
  if (normalized.includes('ultimas 24') || normalized.includes('ultimos 24')) return 24;
  return normalized.includes('agora') || normalized.includes('momento') || normalized.includes('ativo') ? 24 : 24;
}

function textIncludesAllTerms(text: string, terms: string[]) {
  if (terms.length === 0) return false;
  const normalized = normalizeText(text);
  return terms.every((term) => normalized.includes(term));
}

function extractProblemText(problem: ZabbixProblem) {
  const hostNames = (problem.hosts || []).map((host) => host.name).join(' ');
  const tagText = (problem.tags || []).map((tag) => `${tag.tag} ${tag.value}`).join(' ');
  return [problem.name, hostNames, tagText].filter(Boolean).join(' ');
}

function extractEventText(event: ZabbixEvent) {
  const hostNames = (event.hosts || []).map((host) => host.name).join(' ');
  const ackText = (event.acknowledges || [])
    .map((ack) => `${ack.message} ${ack.users?.map((u) => u.name).join(' ') || ''}`)
    .join(' ');
  return [event.name, hostNames, ackText].filter(Boolean).join(' ');
}

function isPppoeText(text: string) {
  return normalizeText(text).includes('pppoe');
}

function isCriticalAlarmEvent(event: ZabbixEvent) {
  const text = normalizeText(extractEventText(event));
  const severity = Number(event.severity || '0');

  return (
    severity >= 4 ||
    text.includes('desastre') ||
    text.includes('critical') ||
    text.includes('critico') ||
    text.includes('crítico') ||
    text.includes('down') ||
    text.includes('caiu') ||
    text.includes('offline') ||
    text.includes('indispon') ||
    text.includes('falha') ||
    text.includes('alarme') ||
    text.includes('alerta')
  );
}

function getAllowedGroupNames() {
  const envGroups = process.env.ZABBIX_ALLOWED_GROUPS?.split(',')
    .map((group) => group.trim())
    .filter(Boolean);

  return (envGroups && envGroups.length > 0 ? envGroups : DEFAULT_ALLOWED_GROUPS).map(normalizeText);
}

let _requestId = 1;

// Usa http/https nativo do Node — bypass do interceptor de fetch do Next.js App Router
function httpPost(
  urlStr: string,
  body: string,
  headers: Record<string, string | number>
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : isHttps ? 443 : 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 10000,
    };

    const req = client.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Zabbix HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
        } else {
          resolve({ statusCode: res.statusCode || 200, body: data });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Zabbix: timeout de 10s excedido — servidor pode estar lento ou inacessivel'));
    });

    req.on('error', (err: NodeJS.ErrnoException) => {
      reject(new Error(`Zabbix conexao falhou [${err.code}]: ${err.message}`));
    });

    req.write(body);
    req.end();
  });
}

function isAuthFailure(message: string, statusCode?: number) {
  const normalized = message.toLowerCase();
  return (
    statusCode === 401 ||
    statusCode === 403 ||
    normalized.includes('unauthorized') ||
    normalized.includes('not authorized') ||
    normalized.includes('permission denied') ||
    normalized.includes('authentication') ||
    normalized.includes('auth')
  );
}

async function zabbixRequestOnce<T = unknown>(
  method: string,
  params: Record<string, unknown>,
  authMode: 'header' | 'body'
): Promise<T> {
  const url = getBaseUrl();
  const token = getToken();
  const id = _requestId++;

  const payload: Record<string, unknown> = {
    jsonrpc: '2.0',
    method,
    params,
    id,
  };

  if (authMode === 'body') {
    payload.auth = token;
  }

  const response = await httpPost(url, JSON.stringify(payload), {
    'Content-Type': 'application/json-rpc',
    ...(authMode === 'header' ? { Authorization: `Bearer ${token}` } : {}),
  });

  let json: { result?: T; error?: { code: number; message: string; data: string } };
  try {
    json = JSON.parse(response.body);
  } catch {
    throw new Error(`Zabbix retornou resposta invalida (nao JSON): ${response.body.slice(0, 150)}`);
  }

  if (json.error) {
    const err = new Error(`Zabbix API [${json.error.code}]: ${json.error.data || json.error.message}`);
    (err as Error & { statusCode?: number }).statusCode = response.statusCode;
    throw err;
  }

  return json.result as T;
}

// ─── CLIENTE PRINCIPAL ───────────────────────────────────────────────────────

export async function zabbixRequest<T = unknown>(
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  try {
    const authMode = getAuthMode();
    if (authMode === 'body') {
      return await zabbixRequestOnce<T>(method, params, 'body');
    }

    try {
      return await zabbixRequestOnce<T>(method, params, 'header');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const statusCode = error instanceof Error ? (error as Error & { statusCode?: number }).statusCode : undefined;

      if (authMode === 'auto' && isAuthFailure(message, statusCode)) {
        return await zabbixRequestOnce<T>(method, params, 'body');
      }

      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Zabbix request falhou em ${method}: ${message}`);
  }
}

function isAllowedGroup(host: ZabbixHost, allowedGroups: string[]) {
  const groups = host.groups || [];
  return groups.some((group) => allowedGroups.includes(normalizeText(group.name)));
}

function getHostAvailability(host: ZabbixHost) {
  const mainInterface = host.interfaces?.find((iface) => iface.main === '1') || host.interfaces?.[0];
  return host.available || mainInterface?.available || '0';
}

function roundToBucketStart(timestamp: number, bucketSeconds: number) {
  return Math.floor(timestamp / bucketSeconds) * bucketSeconds;
}

function formatBucketLabel(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function getAllowedHosts(limit = 500): Promise<ZabbixHost[]> {
  const allowedGroups = getAllowedGroupNames();
  const hosts = await zabbixRequest<ZabbixHost[]>('host.get', {
    output: ['hostid', 'host', 'name', 'status', 'available', 'snmp_available', 'jmx_available', 'ipmi_available'],
    selectInterfaces: ['ip', 'port', 'type', 'main', 'available'],
    selectGroups: ['groupid', 'name'],
    sortfield: 'name',
    limit,
  });

  return hosts.filter((host) => isAllowedGroup(host, allowedGroups));
}

async function getAllowedHostById(hostid: string): Promise<ZabbixHost | null> {
  const allowedGroups = getAllowedGroupNames();
  const hosts = await zabbixRequest<ZabbixHost[]>('host.get', {
    output: ['hostid', 'host', 'name', 'status', 'available', 'snmp_available', 'jmx_available', 'ipmi_available'],
    selectInterfaces: ['ip', 'port', 'type', 'main', 'available'],
    selectGroups: ['groupid', 'name'],
    hostids: [hostid],
  });

  const host = hosts[0];
  if (!host) return null;
  return isAllowedGroup(host, allowedGroups) ? host : null;
}

function pickAvailabilityItem(items: ZabbixItem[]) {
  return (
    items.find((item) => item.key_ === 'icmpping') ||
    items.find((item) => item.key_.startsWith('icmpping')) ||
    items.find((item) => item.key_ === 'agent.ping') ||
    items.find((item) => item.key_.startsWith('agent.ping')) ||
    null
  );
}

function normalizeAvailabilityValue(value: string) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return -1;
  return numericValue >= 1 ? 1 : 0;
}

function formatHostList(hosts: ZabbixHost[], limit = 8) {
  return hosts
    .slice(0, limit)
    .map((host) => {
      const groups = (host.groups || []).map((group) => group.name).join(' | ');
      const ip = host.interfaces?.find((iface) => iface.main === '1')?.ip || host.interfaces?.[0]?.ip || '';
      const availability = getHostAvailability(host);
      const statusLabel = availability === '1' ? 'UP' : availability === '2' ? 'DOWN' : 'UNKNOWN';
      return `- ${host.name}${ip ? ` (${ip})` : ''} [${statusLabel}]${groups ? ` | ${groups}` : ''}`;
    })
    .join('\n');
}

function formatProblemList(problems: ZabbixProblem[], limit = 8) {
  return problems
    .slice(0, limit)
    .map((problem) => {
      const host = problem.hosts?.[0]?.name || 'host desconhecido';
      const sev = SEVERITY_LABEL[problem.severity] || problem.severity;
      const time = new Date(Number(problem.clock) * 1000).toLocaleString('pt-BR');
      return `- [${sev.toUpperCase()}] ${host}: ${problem.name} (desde ${time})`;
    })
    .join('\n');
}

function formatEventList(events: ZabbixEvent[], limit = 8) {
  return events
    .slice(0, limit)
    .map((event) => {
      const host = event.hosts?.[0]?.name || 'host desconhecido';
      const sev = SEVERITY_LABEL[event.severity] || event.severity;
      const time = new Date(Number(event.clock) * 1000).toLocaleString('pt-BR');
      return `- [${sev.toUpperCase()}] ${host}: ${event.name} (em ${time})`;
    })
    .join('\n');
}

// ─── METODOS DE DADOS ────────────────────────────────────────────────────────

export async function getActiveProblems(limit = 100): Promise<ZabbixProblem[]> {
  const allowedHosts = await getAllowedHosts(1000);
  if (allowedHosts.length === 0) return [];

  const allowedHostIds = allowedHosts.map((host) => host.hostid);

  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;

  const problems = await zabbixRequest<ZabbixProblem[]>('problem.get', {
    output: ['eventid', 'objectid', 'clock', 'name', 'severity', 'acknowledged', 'suppressed'],
    selectHosts: ['hostid', 'name'],
    selectTags: ['tag', 'value'],
    hostids: allowedHostIds,
    time_from: thirtyDaysAgo,
    limit,
  });

  return problems.sort((a, b) => {
    const severityDiff = Number(b.severity) - Number(a.severity);
    if (severityDiff !== 0) return severityDiff;
    return Number(b.clock) - Number(a.clock);
  });
}

export async function getHosts(limit = 500): Promise<ZabbixHost[]> {
  return getAllowedHosts(limit);
}

export async function getRecentEvents(limit = 50, lookbackHours = 168): Promise<ZabbixEvent[]> {
  const since = Math.floor(Date.now() / 1000) - Math.max(1, lookbackHours) * 3600;
  const allowedHosts = await getAllowedHosts(1000);
  if (allowedHosts.length === 0) return [];

  const allowedHostIds = allowedHosts.map((host) => host.hostid);

  return zabbixRequest<ZabbixEvent[]>('event.get', {
    output: ['eventid', 'clock', 'name', 'severity', 'acknowledged', 'value'],
    selectHosts: ['hostid', 'name'],
    selectAcknowledges: ['clock', 'message', 'users'],
    hostids: allowedHostIds,
    sortfield: 'clock',
    sortorder: 'DESC',
    time_from: since,
    value: 1,
    limit,
  });
}

export async function getKeyItems(hostids?: string[]): Promise<ZabbixItem[]> {
  return zabbixRequest<ZabbixItem[]>('item.get', {
    output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue', 'lastclock', 'units', 'value_type'],
    hostids: hostids || [],
    monitored: true,
    search: { key_: ['system.cpu.util', 'vm.memory', 'net.if.in', 'net.if.out', 'icmpping'] },
    searchByAny: true,
    sortfield: 'name',
    limit: 200,
  });
}

export async function getHostAvailabilityHistory(
  hostid: string,
  hours = 24,
  intervalMinutes = 5
): Promise<ZabbixAvailabilitySeries> {
  const sanitizedHours = Math.max(1, Math.min(168, Math.floor(hours)));
  const sanitizedIntervalMinutes = Math.max(5, Math.min(60, Math.floor(intervalMinutes)));
  const bucketSeconds = sanitizedIntervalMinutes * 60;
  const now = Math.floor(Date.now() / 1000);
  const timeTill = now;
  const timeFrom = now - sanitizedHours * 3600;
  const bucketStart = roundToBucketStart(timeFrom, bucketSeconds);

  const host = await getAllowedHostById(hostid);
  if (!host) {
    throw new Error('Host nao encontrado no recorte permitido do Zabbix.');
  }

  const items = await zabbixRequest<ZabbixItem[]>('item.get', {
    output: ['itemid', 'hostid', 'name', 'key_', 'lastvalue', 'lastclock', 'units', 'value_type'],
    hostids: [hostid],
    monitored: true,
    search: { key_: ['icmpping', 'agent.ping'] },
    searchByAny: true,
    sortfield: 'name',
    limit: 20,
  });

  const availabilityItem = pickAvailabilityItem(items);
  if (!availabilityItem) {
    throw new Error('Nenhum item de disponibilidade encontrado para este host. Procure por icmpping ou agent.ping no Zabbix.');
  }

  const historyType = Number(availabilityItem.value_type);
  const history = await zabbixRequest<ZabbixHistoryValue[]>('history.get', {
    output: ['itemid', 'clock', 'value'],
    history: Number.isNaN(historyType) ? 3 : historyType,
    itemids: [availabilityItem.itemid],
    time_from: bucketStart,
    time_till: timeTill,
    sortfield: 'clock',
    sortorder: 'ASC',
    limit: 5000,
  });

  const buckets = new Map<number, number>();
  let lastKnownValue = normalizeAvailabilityValue(availabilityItem.lastvalue);

  for (const entry of history) {
    const timestamp = Number(entry.clock);
    const bucket = roundToBucketStart(timestamp, bucketSeconds);
    buckets.set(bucket, normalizeAvailabilityValue(entry.value));
  }

  const points: ZabbixAvailabilityPoint[] = [];
  let upBuckets = 0;
  let downBuckets = 0;
  let unknownBuckets = 0;
  let downTransitions = 0;
  let lastDownClock: number | null = null;
  let previousStatus: ZabbixAvailabilityPoint['status'] | null = null;

  for (let bucket = bucketStart; bucket <= timeTill; bucket += bucketSeconds) {
    if (buckets.has(bucket)) {
      lastKnownValue = buckets.get(bucket) ?? lastKnownValue;
    }

    let status: ZabbixAvailabilityPoint['status'] = 'unknown';
    let value = 0;

    if (lastKnownValue === 1) {
      status = 'up';
      value = 100;
      upBuckets += 1;
    } else if (lastKnownValue === 0) {
      status = 'down';
      downBuckets += 1;
      lastDownClock = bucket;
    } else {
      unknownBuckets += 1;
    }

    if (status === 'down' && previousStatus !== 'down') {
      downTransitions += 1;
    }

    points.push({
      clock: bucket,
      label: formatBucketLabel(bucket),
      value,
      status,
    });

    previousStatus = status;
  }

  const totalBuckets = points.length;
  const uptimePercent = totalBuckets > 0 ? Number(((upBuckets / totalBuckets) * 100).toFixed(2)) : 0;

  return {
    host: {
      hostid: host.hostid,
      name: host.name,
      itemid: availabilityItem.itemid,
      itemKey: availabilityItem.key_,
    },
    intervalMinutes: sanitizedIntervalMinutes,
    hours: sanitizedHours,
    summary: {
      uptimePercent,
      upBuckets,
      downBuckets,
      unknownBuckets,
      totalBuckets,
      downTransitions,
      lastDownClock,
    },
    points,
  };
}

// ─── TOP CLIENTES CORPORATIVOS ───────────────────────────────────────────────

export type TopClientData = {
  hostid: string;
  name: string;
  host: string;
  available: string;
  groups: { groupid: string; name: string }[];
  problems: ZabbixProblem[];
  maxSeverity: number;
  riskScore: number;
};

export async function getTopCorporateClients(): Promise<TopClientData[]> {
  const TOP_CORP_GROUP = 'cliente-top-corporativo';

  const [allHosts, allProblems] = await Promise.all([
    getAllowedHosts(500),
    getActiveProblems(500),
  ]);

  const topCorpHosts = allHosts.filter((host) =>
    (host.groups || []).some((g) => normalizeText(g.name) === TOP_CORP_GROUP)
  );

  const topCorpHostIds = new Set(topCorpHosts.map((h) => h.hostid));

  const problemsByHostId = new Map<string, ZabbixProblem[]>();
  for (const problem of allProblems) {
    for (const ph of problem.hosts || []) {
      if (topCorpHostIds.has(ph.hostid)) {
        const existing = problemsByHostId.get(ph.hostid) ?? [];
        existing.push(problem);
        problemsByHostId.set(ph.hostid, existing);
      }
    }
  }

  const result: TopClientData[] = topCorpHosts.map((host) => {
    const problems = (problemsByHostId.get(host.hostid) ?? [])
      .sort((a, b) => Number(b.severity) - Number(a.severity) || Number(b.clock) - Number(a.clock));

    const maxSeverity = problems.length > 0
      ? Math.max(...problems.map((p) => Number(p.severity)))
      : 0;

    const avail = getHostAvailability(host);
    const isDown = avail === '2';
    const disasters = problems.filter((p) => p.severity === '5').length;
    const highs = problems.filter((p) => p.severity === '4').length;
    const meds = problems.filter((p) => p.severity === '3').length;

    const riskScore =
      (isDown ? 10000 : 0) +
      disasters * 1000 +
      highs * 100 +
      meds * 10 +
      problems.length;

    return {
      hostid: host.hostid,
      name: host.name,
      host: host.host,
      available: avail,
      groups: host.groups ?? [],
      problems,
      maxSeverity,
      riskScore,
    };
  });

  return result.sort((a, b) => b.riskScore - a.riskScore);
}

// ─── SUMMARY PARA DASHBOARD ──────────────────────────────────────────────────

export async function getZabbixSummary(): Promise<ZabbixSummary> {
  const [problems, hosts] = await Promise.all([
    getActiveProblems(500),
    getHosts(500),
  ]);

  return {
    totalProblems: problems.length,
    disasters: problems.filter((p) => p.severity === '5').length,
    highSeverity: problems.filter((p) => p.severity === '4').length,
    hostsUp: hosts.filter((h) => getHostAvailability(h) === '1').length,
    hostsDown: hosts.filter((h) => getHostAvailability(h) === '2').length,
    hostsUnknown: hosts.filter((h) => getHostAvailability(h) === '0').length,
    totalHosts: hosts.length,
  };
}

// ─── CONTEXT BUILDER PARA RAG ────────────────────────────────────────────────

export async function buildZabbixContext(query: string): Promise<string> {
  try {
    const normalized = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const clientName = extractClientName(query);
    const clientTerms = tokenizeText(clientName || query);
    const lookbackHours = parseLookbackHours(query);

    const isZabbixQuery =
      normalized.includes('alarm') ||
      normalized.includes('problema') ||
      normalized.includes('host') ||
      normalized.includes('down') ||
      normalized.includes('offline') ||
      normalized.includes('caiu') ||
      normalized.includes('fora') ||
      normalized.includes('monitor') ||
      normalized.includes('zabbix') ||
      normalized.includes('incidente') ||
      normalized.includes('queda') ||
      normalized.includes('servidor') ||
      normalized.includes('equipamento') ||
      normalized.includes('status') ||
      normalized.includes('cliente') ||
      normalized.includes('pppoe') ||
      normalized.includes('queda') ||
      normalized.includes('online') ||
      normalized.includes('offline');

    if (!isZabbixQuery) return '';

    const [problems, hosts] = await Promise.allSettled([
      getActiveProblems(50),
      getHosts(200),
    ]);
    const events = await getRecentEvents(200, lookbackHours);

    const blocks: string[] = [];
    const matchedHosts = hosts.status === 'fulfilled'
      ? hosts.value.filter((host) => {
          if (clientTerms.length === 0) return false;
          const hostText = [host.name, host.host, (host.groups || []).map((group) => group.name).join(' ')].join(' ');
          return textIncludesAllTerms(hostText, clientTerms);
        })
      : [];

    const matchedHostIds = new Set(matchedHosts.map((host) => host.hostid));

    const matchedProblems = problems.status === 'fulfilled'
      ? problems.value.filter((problem) => {
          if (clientTerms.length === 0) return false;
          const text = extractProblemText(problem);
          return textIncludesAllTerms(text, clientTerms) || (problem.hosts || []).some((host) => matchedHostIds.has(host.hostid));
        })
      : [];

    const matchedEvents = events.filter((event) => {
      if (clientTerms.length === 0) return false;
      const text = extractEventText(event);
      return textIncludesAllTerms(text, clientTerms) || (event.hosts || []).some((host) => matchedHostIds.has(host.hostid));
    });

    const matchedCriticalEvents = matchedEvents.filter((event) => isCriticalAlarmEvent(event));
    const hasClientScope = Boolean(clientName || clientTerms.length > 0);
    const clientHasAlarm = matchedProblems.length > 0 || matchedCriticalEvents.length > 0;

    if (clientName) {
      blocks.push(`CLIENTE/ALCANCE IDENTIFICADO: ${clientName}`);
    }

    const operationalClassification =
      isPppoeText(query) || isPppoeText(clientName) ? 'PPPoE / Cliente (nao Backbone)' : '';

    if (operationalClassification) {
      blocks.push(`CLASSIFICACAO OPERACIONAL: ${operationalClassification}`);
    }

    if (hasClientScope) {
      blocks.push(`RESPOSTA_EXECUTIVA: ${clientHasAlarm ? 'SIM' : 'NAO'}`);
      blocks.push(`SITUACAO_CLIENTE: ${clientHasAlarm ? 'CLIENTE COM ALARME/EVENTO CRITICO' : 'SEM EVIDENCIA DE ALARME ATIVO NO RECORTE CONSULTADO'}`);
    }

    if (hosts.status === 'fulfilled' && matchedHosts.length > 0) {
      blocks.push(`HOSTS RELACIONADOS (${matchedHosts.length} total):\n${formatHostList(matchedHosts, 12)}`);
    }

    if (problems.status === 'fulfilled') {
      const activeProblems = matchedProblems.length > 0 ? matchedProblems : problems.value;
      if (activeProblems.length > 0) {
        blocks.push(`ALARMES ATIVOS NO ZABBIX (${activeProblems.length} total):\n${formatProblemList(activeProblems, 12)}`);
      } else if (matchedCriticalEvents.length > 0) {
        blocks.push(`ALARMES ATIVOS NO ZABBIX: sem problema aberto em problem.get, mas existem eventos criticos recentes para o recorte consultado.`);
      } else {
        blocks.push('ALARMES ATIVOS NO ZABBIX: nenhum alarme ativo encontrado para o recorte atual.');
      }
    }

    if (matchedCriticalEvents.length > 0) {
      blocks.push(`EVENTOS CRITICOS DO RECORTE (${matchedCriticalEvents.length} total):\n${formatEventList(matchedCriticalEvents, 12)}`);
    } else if (matchedEvents.length > 0) {
      blocks.push(`EVENTOS NAS ULTIMAS ${lookbackHours} HORAS (${matchedEvents.length} total):\n${formatEventList(matchedEvents, 12)}`);
    } else {
      blocks.push(`EVENTOS NAS ULTIMAS ${lookbackHours} HORAS: nenhum evento encontrado para o recorte atual.`);
    }

    if (hasClientScope && matchedCriticalEvents.length > 0) {
      blocks.push(`EVIDENCIA_PRINCIPAL: ${matchedCriticalEvents[0].name}`);
    }

    if (hosts.status === 'fulfilled') {
      const total = hosts.value.length;
      const up = hosts.value.filter((h) => getHostAvailability(h) === '1').length;
      const down = hosts.value.filter((h) => getHostAvailability(h) === '2').length;
      blocks.push(`STATUS GERAL: ${up}/${total} hosts acessiveis, ${down} inacessiveis`);
    }

    return blocks.length > 0
      ? `--- DADOS AO VIVO DO ZABBIX ---\n${blocks.join('\n\n')}\n--- FIM ZABBIX ---`
      : '';
  } catch {
    return '';
  }
}
