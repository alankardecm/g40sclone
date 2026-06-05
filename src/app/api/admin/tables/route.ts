import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDatalakeOverview } from '@/modules/datalake/application/overview'

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const overview = await getDatalakeOverview('all')
  if (!overview.ok) {
    return NextResponse.json({ tables: [] })
  }

  const tables = overview.tables.map(t => t.name).sort()
  return NextResponse.json({ tables })
}
