import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { updateUserPages } from '@/lib/user-registry'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await auth()
  if (session?.user?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email } = await params
  const decodedEmail = decodeURIComponent(email)
  const body = await req.json()

  const ok = await updateUserPages(decodedEmail, body)
  if (!ok) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
