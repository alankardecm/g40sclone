import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { preRegisterUser, removePreRegisteredUser } from '@/lib/user-registry'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'superadmin' && session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, email } = await req.json() as { name: string; email: string }

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Nome e email são obrigatórios.' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()
  await preRegisterUser(name.trim(), normalizedEmail)

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'superadmin' && session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email } = await req.json() as { email: string }
  const ok = await removePreRegisteredUser(email)

  return NextResponse.json({ ok })
}
