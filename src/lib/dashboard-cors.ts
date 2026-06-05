import { NextRequest, NextResponse } from 'next/server';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Dashboard-Token',
};

export function withCors(response: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export function corsOptions() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Returns true when request carries a valid bypass token (for unauthenticated testing)
export function hasBypassToken(request: NextRequest): boolean {
  const secret = process.env.DASHBOARD_TEST_TOKEN;
  if (!secret) return false;
  return request.headers.get('X-Dashboard-Token') === secret;
}
