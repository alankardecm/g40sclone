import { NextResponse } from 'next/server';
import { persistInboundCommunication } from '@/modules/communication/application/persist-inbound-communication';
import type { OmnichannelInboundPayload, OmnichannelSource } from '@/shared/types/omnichannel';

function authError() {
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
}

function parseTimestamp(value: number | string | undefined) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return asNumber;
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) return Math.floor(asDate.getTime() / 1000);
  }
  return Math.floor(Date.now() / 1000);
}

function resolveSource(payload: OmnichannelInboundPayload): OmnichannelSource {
  const source = String(payload.source || '').trim().toLowerCase();
  if (source === 'telegram' || source === 'instagram' || source === 'email' || source === 'webchat' || source === 'sms' || source === 'whatsapp') {
    return source;
  }
  return 'other';
}

export async function POST(request: Request) {
  const token = process.env.OMNICHANNEL_CAPTURE_TOKEN || process.env.WHATSAPP_CAPTURE_TOKEN;
  if (token) {
    const received = request.headers.get('x-channel-capture-token') || request.headers.get('x-wa-capture-token');
    if (!received || received !== token) return authError();
  }

  const payload = (await request.json()) as OmnichannelInboundPayload;
  const source = resolveSource(payload);
  const result = await persistInboundCommunication({
    source,
    sourceType: payload.source_type || `${source}_message`,
    conversationId: payload.conversation_id || payload.group_id || payload.group_jid,
    conversationName: payload.conversation_name || payload.group_name || payload.group_id || payload.group_jid,
    senderId: payload.sender_id || payload.sender_jid || null,
    senderName: payload.sender_name || null,
    messageId: payload.message_id || null,
    messageText: payload.message_text || payload.text || '',
    messageType: payload.message_type || null,
    bridgeName: payload.bridge_name || null,
    accountId: payload.account_id || null,
    accountName: payload.account_name || null,
    metadata: payload.metadata,
    sentAt: payload.msg_timestamp || parseTimestamp(payload.timestamp),
  });

  return NextResponse.json(result, { status: result.status });
}
