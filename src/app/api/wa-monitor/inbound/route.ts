import { NextResponse } from 'next/server';
import { persistInboundCommunication } from '@/modules/communication/application/persist-inbound-communication';

type InboundPayload = {
  group_id?: string;
  group_name?: string;
  group_jid?: string;
  sender_jid?: string;
  sender_name?: string;
  message_text?: string;
  text?: string;
  msg_timestamp?: number;
  timestamp?: number | string;
  source_type?: string;
  message_id?: string;
  message_type?: string;
  media_base64?: string;
  media_mime_type?: string;
  bridge_name?: string;
};

function authError() {
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
}

function buildMessageText(payload: InboundPayload) {
  const text = String(payload.message_text || payload.text || '').trim();
  if (text) return text;

  const messageType = String(payload.message_type || '').trim();
  const labels: Record<string, string> = {
    audioMessage: '[audio recebido]',
    imageMessage: '[imagem recebida]',
    videoMessage: '[video recebido]',
    documentMessage: '[documento recebido]',
    stickerMessage: '[figurinha recebida]',
    locationMessage: '[localizacao recebida]',
    liveLocationMessage: '[localizacao recebida]',
    contactMessage: '[contato recebido]',
    contactsArrayMessage: '[contato recebido]',
  };

  return labels[messageType] || '';
}

export async function POST(request: Request) {
  const token = process.env.WHATSAPP_CAPTURE_TOKEN;
  if (token) {
    const received = request.headers.get('x-wa-capture-token');
    if (!received || received !== token) return authError();
  }

  const payload = (await request.json()) as InboundPayload;
  const sentAt =
    payload.msg_timestamp ||
    (typeof payload.timestamp === 'number' ? payload.timestamp : undefined) ||
    Math.floor(Date.now() / 1000);

  const result = await persistInboundCommunication({
    source: 'whatsapp',
    sourceType: payload.source_type || 'whatsapp_group',
    conversationId: payload.group_id || payload.group_jid,
    conversationName: payload.group_name || payload.group_id || payload.group_jid,
    senderId: payload.sender_jid || null,
    senderName: payload.sender_name || null,
    messageId: payload.message_id || null,
    messageText: buildMessageText(payload),
    messageType: payload.message_type || null,
    mediaBase64: payload.media_base64 || null,
    mediaMimeType: payload.media_mime_type || null,
    bridgeName: payload.bridge_name || request.headers.get('x-bridge-name') || null,
    sentAt,
  });

  return NextResponse.json(result, { status: result.status });
}
