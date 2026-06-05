import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildOutlookAuthUrl, createOauthState, isOutlookConfigured } from '@/lib/outlook';

export async function GET(request: Request) {
  if (!isOutlookConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Outlook nao configurado. Defina MS_TENANT_ID, MS_CLIENT_ID e MS_CLIENT_SECRET.' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const state = createOauthState();
  const promptParam = searchParams.get('prompt');
  const loginHint = searchParams.get('login_hint') || undefined;
  const prompt =
    promptParam === 'login' || promptParam === 'consent' || promptParam === 'select_account'
      ? promptParam
      : undefined;
  const cookieStore = await cookies();
  cookieStore.set('outlook_oauth_state', state, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(buildOutlookAuthUrl(state, { prompt, loginHint }));
}
