import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isOutlookConfigured } from '@/lib/outlook';

export async function GET() {
  const cookieStore = await cookies();
  const accountName = cookieStore.get('outlook_account_name')?.value || null;
  const accountEmail = cookieStore.get('outlook_account_email')?.value || null;
  const hasAccessToken = Boolean(cookieStore.get('outlook_access_token')?.value);
  const hasRefreshToken = Boolean(cookieStore.get('outlook_refresh_token')?.value);

  return NextResponse.json({
    ok: true,
    configured: isOutlookConfigured(),
    connected: hasAccessToken || hasRefreshToken,
    account: accountName || accountEmail ? { name: accountName, email: accountEmail } : null,
  });
}
