const BASE_URL = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080';
const API_KEY  = process.env.EVOLUTION_API_KEY  ?? '';

async function evo<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: API_KEY,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Evolution API ${path} → ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ── Instâncias ────────────────────────────────────────────────────────────────

// v1.x response format
export type EvolutionInstance = {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;           // "open" | "connecting" | "close"
    profileName?: string;
    profilePictureUrl?: string;
  };
};

export function listInstances(): Promise<EvolutionInstance[]> {
  return evo<EvolutionInstance[]>('/instance/fetchInstances');
}

export function createInstance(name: string): Promise<unknown> {
  return evo('/instance/create', {
    method: 'POST',
    body: JSON.stringify({ instanceName: name, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
  });
}

export function deleteInstance(name: string): Promise<unknown> {
  return evo(`/instance/delete/${name}`, { method: 'DELETE' });
}

export function connectInstance(name: string): Promise<{ base64?: string; code?: string; count?: number }> {
  return evo(`/instance/connect/${name}`);
}

export function logoutInstance(name: string): Promise<unknown> {
  return evo(`/instance/logout/${name}`, { method: 'DELETE' });
}

export function getInstanceStatus(name: string): Promise<{ instance: { state: string } }> {
  return evo(`/instance/connectionState/${name}`);
}

// ── Webhook ───────────────────────────────────────────────────────────────────

export function setWebhook(name: string, url: string): Promise<unknown> {
  return evo(`/webhook/set/${name}`, {
    method: 'POST',
    body: JSON.stringify({
      url,
      webhook_by_events: false,
      webhook_base64: false,
      events: ['MESSAGES_UPSERT'],
    }),
  });
}

// ── Envio ─────────────────────────────────────────────────────────────────────

export function sendText(
  instanceName: string,
  to: string,
  text: string,
): Promise<unknown> {
  // Aceita número puro, JID @s.whatsapp.net ou JID @lid
  const number = to.includes('@') ? to : to.replace(/\D/g, '');
  return evo(`/message/sendText/${instanceName}`, {
    method: 'POST',
    body: JSON.stringify({ number, text }),
  });
}

// ── Mídia ─────────────────────────────────────────────────────────────────────

export type MediaBase64Response = {
  base64: string;
  mimetype: string;
  mediaType?: string;
  fileName?: string;
};

export function getMediaBase64(
  instanceName: string,
  messageId: string,
): Promise<MediaBase64Response> {
  return evo<MediaBase64Response>(`/chat/getBase64FromMediaMessage/${instanceName}`, {
    method: 'POST',
    body: JSON.stringify({ message: { key: { id: messageId } }, convertToMp4: false }),
  });
}
