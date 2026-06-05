import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { setUserRole, forceLogout } from '@/lib/user-registry'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await auth()
  if (session?.user?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Apenas o superadmin pode alterar roles.' }, { status: 403 })
  }

  const { email } = await params
  const decodedEmail = decodeURIComponent(email)
  const { role } = await req.json() as { role: 'admin' | 'user' }

  if (role !== 'admin' && role !== 'user') {
    return NextResponse.json({ error: 'Role inválido.' }, { status: 400 })
  }

  const ok = await setUserRole(decodedEmail, role)
  if (!ok) return NextResponse.json({ error: 'Usuário não encontrado ou é superadmin.' }, { status: 404 })

  // Force logout para que a mudança de role entre em vigor imediatamente
  await forceLogout(decodedEmail)

  return NextResponse.json({ ok: true })
}
