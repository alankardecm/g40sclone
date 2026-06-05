import crypto from 'node:crypto';

type OutlookTokenResponse = {
  token_type: string;
  expires_in: number;
  ext_expires_in?: number;
  access_token: string;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
};

type OutlookMessage = {
  id: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  from?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  body?: {
    contentType?: string;
    content?: string;
  };
};

const tenantId = process.env.MS_TENANT_ID || 'common';
const clientId = process.env.MS_CLIENT_ID || '';
const clientSecret = process.env.MS_CLIENT_SECRET || '';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4100';
const redirectPath = process.env.MS_REDIRECT_PATH || '/api/communications/outlook/auth/callback';
const redirectUri = process.env.MS_REDIRECT_URI || `${appUrl.replace(/\/$/, '')}${redirectPath}`;
const loginHint = process.env.MS_LOGIN_HINT || '';
const authBaseUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`;
const graphBaseUrl = 'https://graph.microsoft.com/v1.0';

export function isOutlookConfigured() {
  return Boolean(clientId && clientSecret && redirectUri);
}

export function buildOutlookScopes() {
  return ['openid', 'profile', 'offline_access', 'User.Read', 'Mail.Read'].join(' ');
}

export function createOauthState() {
  return crypto.randomBytes(24).toString('hex');
}

export function buildOutlookAuthUrl(
  state: string,
  options?: {
    prompt?: 'select_account' | 'login' | 'consent';
    loginHint?: string;
  }
) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: buildOutlookScopes(),
    state,
  });

  const resolvedLoginHint = options?.loginHint || loginHint;
  if (options?.prompt) params.set('prompt', options.prompt);
  if (resolvedLoginHint) params.set('login_hint', resolvedLoginHint);

  return `${authBaseUrl}/authorize?${params.toString()}`;
}

async function exchangeToken(params: URLSearchParams) {
  const response = await fetch(`${authBaseUrl}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const payload = (await response.json()) as OutlookTokenResponse & { error?: string; error_description?: string };
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Falha ao obter token do Outlook.');
  }

  return payload;
}

export async function exchangeCodeForTokens(code: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: buildOutlookScopes(),
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    client_secret: clientSecret,
  });

  return exchangeToken(params);
}

export async function refreshOutlookAccessToken(refreshToken: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: buildOutlookScopes(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    client_secret: clientSecret,
  });

  return exchangeToken(params);
}

export async function getOutlookMe(accessToken: string) {
  const response = await fetch(`${graphBaseUrl}/me?$select=id,displayName,mail,userPrincipalName`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  const payload = (await response.json()) as {
    id?: string;
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Falha ao consultar perfil do Outlook.');
  }

  return payload;
}

export async function listOutlookMessages(accessToken: string, top = 10) {
  const params = new URLSearchParams({
    $top: String(Math.min(Math.max(top, 1), 50)),
    $select: 'id,conversationId,subject,bodyPreview,receivedDateTime,from,body',
    $orderby: 'receivedDateTime desc',
  });

  const response = await fetch(`${graphBaseUrl}/me/messages?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.body-content-type="text"',
    },
    cache: 'no-store',
  });

  const payload = (await response.json()) as { value?: OutlookMessage[]; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Falha ao listar emails do Outlook.');
  }

  return payload.value || [];
}

export function summarizeOutlookMessage(message: OutlookMessage) {
  const subject = String(message.subject || '').trim();
  const fromName = String(message.from?.emailAddress?.name || '').trim();
  const fromAddress = String(message.from?.emailAddress?.address || '').trim();
  const preview = String(message.bodyPreview || message.body?.content || '').replace(/\s+/g, ' ').trim();

  const header = [
    subject ? `Assunto: ${subject}.` : null,
    fromName || fromAddress ? `Remetente: ${fromName || fromAddress}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return `${header} ${preview}`.trim();
}
