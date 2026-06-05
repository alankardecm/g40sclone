// Config Edge-safe — sem imports de Node.js
// Usado pelo proxy (Edge Runtime)

import type { NextAuthConfig } from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { NextResponse } from "next/server"
import { DEFAULT_PAGES, checkPagePermission } from "@/lib/user-pages"
import type { UserPages } from "@/lib/user-pages"

const SUPERADMIN_EMAILS = process.env.SUPERADMIN_EMAILS
  ? process.env.SUPERADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase())
  : ["alan.moreira@netturbo.com.br"];

const PUBLIC_PATHS = [
  "/api/auth",
  "/api/evolution/webhook",
  "/api/health",
  "/access-denied",
]

export const authConfig: NextAuthConfig = {
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
      // Ao reentrar, a Microsoft mostra o seletor de conta (não loga silencioso)
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  // Sessão com timeout de inatividade deslizante:
  // - maxAge: 1h sem atividade -> expira e redireciona pro login
  // - updateAge: enquanto usa, a sessão é renovada (no máx. 1x a cada 5 min)
  session: {
    strategy: "jwt",
    maxAge: 60 * 60,   // 1 hora
    updateAge: 5 * 60, // 5 minutos
  },
  callbacks: {
    authorized({ auth: session, request }) {
      const pathname = request.nextUrl.pathname
      const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
      if (isPublic) return true
      if (!session) return false

      // tokenVersion = 0 no JWT significa sessão inválida (force logout ativado)
      if (session.user.tokenVersion === -1) {
        return NextResponse.redirect(new URL('/auth/signin', request.url))
      }

      if (session.user.role === 'superadmin' || session.user.role === 'admin') return true

      const pages = (session.user.pages as UserPages) ?? DEFAULT_PAGES
      if (!checkPagePermission(pathname, pages)) {
        return NextResponse.redirect(new URL('/access-denied', request.url))
      }
      return true
    },

    session({ session, token }) {
      session.user.role = (token.role as string) ?? 'user'
      session.user.pages = token.pages as UserPages
      session.user.tokenVersion = (token.tokenVersion as number) ?? 0
      return session
    },
  },
}
