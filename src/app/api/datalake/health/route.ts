import { NextResponse } from 'next/server';
import { getDatalakeOverview } from '@/modules/datalake/application/overview';

export async function GET() {
  const overview = await getDatalakeOverview();
  return NextResponse.json(overview, { status: overview.ok ? 200 : 503 });
}
