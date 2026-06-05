import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  getOutlookMe,
  isOutlookConfigured,
  listOutlookMessages,
  refreshOutlookAccessToken,
  summarizeOutlookMessage,
} from '@/lib/outlook';
import { persistInboundCommunication } from '@/modules/communication/application/persist-inbound-communication';

async function resolveAccessToken() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('outlook_access_token')?.value;
  const refreshToken = cookieStore.get('outlook_refresh_token')?.value;

  if (accessToken) {
    return { accessToken, refreshed: false };
  }

  if (!refreshToken) {
    throw new Error('Outlook ainda nao conectado.');
  }

  const refreshed = await refreshOutlookAccessToken(refreshToken);
  cookieStore.set('outlook_access_token', refreshed.access_token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max((refreshed.expires_in || 3600) - 60, 300),
  });

  if (refreshed.refresh_token) {
    cookieStore.set('outlook_refresh_token', refreshed.refresh_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return { accessToken: refreshed.access_token, refreshed: true };
}

export async function POST(request: Request) {
  try {
    if (!isOutlookConfigured()) {
      return NextResponse.json({ ok: false, error: 'Outlook nao configurado.' }, { status: 500 });
    }

    const body = (await request.json().catch(() => ({}))) as { top?: number };
    const top = Math.min(Math.max(Number(body.top || 10), 1), 25);
    const { accessToken } = await resolveAccessToken();
    const me = await getOutlookMe(accessToken);
    const messages = await listOutlookMessages(accessToken, top);

    const ingested = [];
    let skipped = 0;

    for (const message of messages) {
      const text = summarizeOutlookMessage(message);
      if (!text) {
        skipped += 1;
        continue;
      }

      const result = await persistInboundCommunication({
        source: 'email',
        sourceType: 'outlook_email',
        conversationId: message.conversationId || message.id,
        conversationName: message.subject || `Email de ${message.from?.emailAddress?.name || message.from?.emailAddress?.address || 'contato'}`,
        senderId: message.from?.emailAddress?.address || null,
        senderName: message.from?.emailAddress?.name || null,
        messageId: message.id,
        messageText: text,
        messageType: 'email',
        accountId: me.id || me.mail || me.userPrincipalName || null,
        accountName: me.mail || me.userPrincipalName || me.displayName || 'Outlook',
        sentAt: message.receivedDateTime ? Math.floor(new Date(message.receivedDateTime).getTime() / 1000) : Math.floor(Date.now() / 1000),
      });

      ingested.push({
        message_id: message.id,
        conversation_id: message.conversationId || message.id,
        subject: message.subject || null,
        duplicate: result.ok && 'duplicate' in result ? Boolean(result.duplicate) : false,
        ok: result.ok,
        error: result.ok ? null : 'error' in result ? result.error : null,
      });
    }

    return NextResponse.json({
      ok: true,
      account: {
        name: me.displayName || null,
        email: me.mail || me.userPrincipalName || null,
      },
      pulled: messages.length,
      skipped,
      ingested,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'sync_error' }, { status: 500 });
  }
}
