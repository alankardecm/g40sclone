import { NextResponse } from 'next/server';
import { getActiveProblems, getHostAvailabilityHistory, getHosts, getRecentEvents, getTopCorporateClients, getZabbixSummary } from '@/lib/zabbix';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'summary';

  const permissionHint =
    'O token autenticou, mas o usuario associado nao tem acesso aos host groups monitorados. No Zabbix, permissao de leitura e definida por user group + host group, nao pelo token.';

  try {
    if (view === 'summary') {
      const summary = await getZabbixSummary();
      return NextResponse.json({ ok: true, summary });
    }

    if (view === 'problems') {
      const limit = Math.min(Number(searchParams.get('limit') || '100'), 500);
      const problems = await getActiveProblems(limit);
      return NextResponse.json({ ok: true, problems, total: problems.length });
    }

    if (view === 'hosts') {
      const limit = Math.min(Number(searchParams.get('limit') || '500'), 1000);
      const hosts = await getHosts(limit);
      const up = hosts.filter((h) => h.available === '1').length;
      const down = hosts.filter((h) => h.available === '2').length;
      const unknown = hosts.filter((h) => h.available === '0').length;
      return NextResponse.json({ ok: true, hosts, stats: { up, down, unknown, total: hosts.length } });
    }

    if (view === 'events') {
      const limit = Math.min(Number(searchParams.get('limit') || '50'), 200);
      const events = await getRecentEvents(limit);
      return NextResponse.json({ ok: true, events, total: events.length });
    }

    if (view === 'top-clients') {
      const clients = await getTopCorporateClients();
      const withAlarms = clients.filter((c) => c.problems.length > 0).length;
      const offline = clients.filter((c) => c.available === '2').length;
      const withDisaster = clients.filter((c) => c.maxSeverity >= 5).length;
      return NextResponse.json({
        ok: true,
        clients,
        stats: { total: clients.length, withAlarms, offline, withDisaster },
      });
    }

    if (view === 'availability') {
      const hostid = searchParams.get('hostid')?.trim() || '';
      const hours = Math.min(Number(searchParams.get('hours') || '24'), 168);
      const intervalMinutes = Math.min(Number(searchParams.get('interval') || '5'), 60);

      if (!hostid) {
        return NextResponse.json({ ok: false, error: 'hostid e obrigatorio para view=availability.' }, { status: 400 });
      }

      const availability = await getHostAvailabilityHistory(hostid, hours, intervalMinutes);
      return NextResponse.json({ ok: true, availability });
    }

    return NextResponse.json({ ok: false, error: 'view invalido. Use: summary, problems, hosts, events ou availability.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Zabbix API Route] Erro:', message);

    if (message.includes('No permissions to call')) {
      return NextResponse.json(
        {
          ok: false,
          code: 'ZABBIX_PERMISSION_DENIED',
          error: 'Token autenticado, mas sem permissão para ler dados do Zabbix.',
          hint: permissionHint,
          details: message,
        },
        { status: 403 }
      );
    }

    // 502 para diferenciar de erro interno do Next (500)
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
