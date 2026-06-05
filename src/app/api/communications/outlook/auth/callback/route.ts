import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { exchangeCodeForTokens, getOutlookMe } from '@/lib/outlook';

const redirectAfterAuth = process.env.MS_POST_AUTH_REDIRECT || '/dashboard/comunicacao';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      return NextResponse.redirect(
        new URL(`${redirectAfterAuth}?outlook_error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL(`${redirectAfterAuth}?outlook_error=missing_code`, request.url));
    }

    const cookieStore = await cookies();
    const expectedState = cookieStore.get('outlook_oauth_state')?.value;
    if (!expectedState || expectedState !== state) {
      return NextResponse.redirect(new URL(`${redirectAfterAuth}?outlook_error=invalid_state`, request.url));
    }

    const tokens = await exchangeCodeForTokens(code);
    const me = await getOutlookMe(tokens.access_token);

    cookieStore.set('outlook_access_token', tokens.access_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.max((tokens.expires_in || 3600) - 60, 300),
    });

    if (tokens.refresh_token) {
      cookieStore.set('outlook_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    cookieStore.set('outlook_account_name', me.displayName || me.mail || me.userPrincipalName || 'Conta Outlook', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    cookieStore.set('outlook_account_email', me.mail || me.userPrincipalName || '', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    cookieStore.delete('outlook_oauth_state');

    return NextResponse.redirect(new URL(`${redirectAfterAuth}?outlook_connected=1`, request.url));
  } catch (error) {
    return NextResponse.redirect(
      new URL(`${redirectAfterAuth}?outlook_error=${encodeURIComponent(error instanceof Error ? error.message : 'callback_error')}`, request.url)
    );
  }
}
