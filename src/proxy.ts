import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { NextRequest, NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Dashboard-Token',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const proxy = auth((req: any) => {
  const pathname: string = req.nextUrl?.pathname ?? ''

  // Preflight CORS para rotas do Datalake
  if (req.method === 'OPTIONS' && pathname.startsWith('/api/datalake/')) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
  }

  const response = NextResponse.next()

  // Injeta CORS headers nas respostas do Datalake
  if (pathname.startsWith('/api/datalake/')) {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v))
  }

  return response
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.ico$|.*\\.webp$).*)"],
}
