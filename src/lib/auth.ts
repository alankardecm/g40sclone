// Config completo — Node.js only
// Usado por API routes e Server Components

import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { registerLogin, getUserPages, getTokenVersion, getRegistryUser } from "@/lib/user-registry"
import type { UserPages } from "@/lib/user-pages"

const SUPERADMIN_EMAILS = process.env.SUPERADMIN_EMAILS
  ? process.env.SUPERADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase())
  : ["alan.moreira@netturbo.com.br"];

// Contas bloqueadas — não conseguem logar no Hub
const BLOCKED_EMAILS = ["ntt.alertas@netturbo.com.br"]

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ user }) {
      const email = user.email ?? ''
      if (!email) return false
      if (BLOCKED_EMAILS.includes(email)) return false
      const isSuperadmin = SUPERADMIN_EMAILS.includes(email)
      await registerLogin({
        email,
        name: user.name ?? undefined,
        picture: user.image ?? undefined,
        role: isSuperadmin ? 'superadmin' : 'user',
      })
      return true
    },

    async jwt({ token, account }) {
      const email = token.email ?? ''
      const isOwner = SUPERADMIN_EMAILS.includes(email)

      if (account && email) {
        // Login inicial — lê role e permissões do registro
        const user = await getRegistryUser(email)
        token.role = isOwner ? 'superadmin' : (user?.role === 'admin' ? 'admin' : 'user')
        token.pages = await getUserPages(email)
        token.tokenVersion = await getTokenVersion(email)
      } else if (email && token.tokenVersion !== -1) {
        // Refresh — mantém role atual mas verifica force logout
        if (!isOwner) {
          const user = await getRegistryUser(email)
          token.role = user?.role === 'admin' ? 'admin' : 'user'
        }
        const current = await getTokenVersion(email)
        if (current > (token.tokenVersion as number ?? 0)) {
          token.tokenVersion = -1
        }
      }

      return token
    },

    session({ session, token }) {
      session.user.role = (token.role as string) ?? 'user'
      session.user.pages = token.pages as UserPages
      session.user.tokenVersion = (token.tokenVersion as number) ?? 0
      return session
    },
  },
})
