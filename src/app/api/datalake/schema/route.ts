import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserAllowedTables } from '@/lib/user-registry';
import { getDatalakeOverview } from '@/modules/datalake/application/overview';
import { hasBypassToken } from '@/lib/dashboard-cors';

export async function GET(request: NextRequest) {
  let allowedTables: string[] | 'all';
  if (hasBypassToken(request)) {
    allowedTables = 'all';
  } else {
    const session = await auth();
    const email = session?.user?.email ?? '';
    allowedTables = await getUserAllowedTables(email);
  }
  const overview = await getDatalakeOverview(allowedTables);
  return NextResponse.json(overview, { status: overview.ok ? 200 : 503 });
}
