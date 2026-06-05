import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = await cookies();

  [
    'outlook_access_token',
    'outlook_refresh_token',
    'outlook_account_name',
    'outlook_account_email',
    'outlook_oauth_state',
  ].forEach((cookieName) => {
    cookieStore.delete(cookieName);
  });

  return NextResponse.json({ ok: true });
}
