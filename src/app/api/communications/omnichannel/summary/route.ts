import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

type MessageRow = {
  id: string;
  source_type?: string | null;
  sender_jid?: string | null;
  sender_name?: string | null;
  text_raw: string;
  created_at: string;
  wa_groups?: { id: string; name: string; whatsapp_jid?: string | null } | Array<{ id: string; name: string; whatsapp_jid?: string | null }>;
};

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupe<T>(items: T[]) {
  return [...new Set(items)];
}

function detectChannel(sourceType: string | null | undefined) {
  const normalized = normalizeText(sourceType);
  if (normalized === 'outlook_email' || normalized.includes('email')) return 'email' as const;
  if (normalized.includes('whatsapp') || normalized.includes('wpp') || normalized.includes('wa_')) return 'whatsapp' as const;
  return 'other' as const;
}

function unwrapGroup(value: MessageRow['wa_groups']) {
  return Array.isArray(value) ? value[0] : value;
}

function extractProtocols(text: string) {
  const patterns = [
    /\b(?:protocolo|prot|ticket|chamado|os)\s*(?:n|no|num|numero|#|:|-)?\s*([a-z]{0,5}\d{5,})\b/gi,
    /\b([a-z]{2,6}-\d{5,})\b/gi,
  ];

  const found: string[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = String(match[1] || '').trim();
      if (value) found.push(value.toUpperCase());
    }
  }

  return dedupe(found);
}

function extractWhatsappClient(groupName: string) {
  const raw = String(groupName || '').trim();
  if (!raw) return '';

  const normalized = raw
    .replace(/\s+x\s+ntt.*$/i, '')
    .replace(/\s+x\s+net\s*turbo.*$/i, '')
    .replace(/\s+\(link\).*$/i, '')
    .replace(/\s+\|\s+.*$/i, '')
    .trim();

  return normalized;
}

function extractEmailClient(senderName?: string | null, senderEmail?: string | null) {
  const name = String(senderName || '').trim();
  const email = String(senderEmail || '').trim().toLowerCase();

  if (name && !/netturbo|alertas|suporte|noc/i.test(name)) return name;
  if (email) {
    const localPart = email.split('@')[0] || '';
    if (localPart && !/alan\.moreira|ntt\.alertas|suporte|noc/i.test(localPart)) return localPart.replace(/[._-]+/g, ' ');
  }

  return name || email;
}

function titleize(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(Number(searchParams.get('days') || '30') || 30, 90);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('wa_messages')
      .select(`
        id,
        source_type,
        sender_jid,
        sender_name,
        text_raw,
        created_at,
        wa_groups (
          id,
          name,
          whatsapp_jid
        )
      `)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(5000);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (data || []) as MessageRow[];
    const protocolMap = new Map<string, { protocol: string; channels: Set<string>; lastSeenAt: string; references: string[] }>();
    const clientMap = new Map<string, { client: string; channels: Set<string>; messageCount: number; references: string[] }>();

    let emailMessages = 0;
    let whatsappMessages = 0;

    rows.forEach((row) => {
      const group = unwrapGroup(row.wa_groups);
      const channel = detectChannel(row.source_type);
      const textBase = [group?.name || '', row.text_raw || '', row.sender_name || '', row.sender_jid || ''].join(' ');
      const normalizedText = normalizeText(textBase);

      if (channel === 'email') emailMessages += 1;
      if (channel === 'whatsapp') whatsappMessages += 1;

      const protocols = extractProtocols(normalizedText);
      protocols.forEach((protocol) => {
        const current = protocolMap.get(protocol) || {
          protocol,
          channels: new Set<string>(),
          lastSeenAt: row.created_at,
          references: [],
        };
        current.channels.add(channel);
        if (!current.lastSeenAt || new Date(row.created_at) > new Date(current.lastSeenAt)) {
          current.lastSeenAt = row.created_at;
        }
        const ref = group?.name || row.sender_name || row.sender_jid || row.id;
        if (ref && current.references.length < 3 && !current.references.includes(ref)) current.references.push(ref);
        protocolMap.set(protocol, current);
      });

      let client = '';
      if (channel === 'whatsapp') {
        client = extractWhatsappClient(group?.name || '');
      } else if (channel === 'email') {
        client = extractEmailClient(row.sender_name, row.sender_jid);
      }

      client = titleize(normalizeText(client));
      if (!client) return;

      const currentClient = clientMap.get(client) || {
        client,
        channels: new Set<string>(),
        messageCount: 0,
        references: [],
      };
      currentClient.channels.add(channel);
      currentClient.messageCount += 1;
      const ref = group?.name || row.sender_name || row.sender_jid || '';
      if (ref && currentClient.references.length < 3 && !currentClient.references.includes(ref)) currentClient.references.push(ref);
      clientMap.set(client, currentClient);
    });

    const protocols = [...protocolMap.values()]
      .map((item) => ({
        protocol: item.protocol,
        channels: [...item.channels],
        last_seen_at: item.lastSeenAt,
        references: item.references,
      }))
      .sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime());

    const clients = [...clientMap.values()]
      .map((item) => ({
        client: item.client,
        channels: [...item.channels],
        message_count: item.messageCount,
        references: item.references,
      }))
      .sort((a, b) => b.message_count - a.message_count);

    const emailProtocols = protocols.filter((item) => item.channels.includes('email')).length;
    const whatsappProtocols = protocols.filter((item) => item.channels.includes('whatsapp')).length;
    const sharedProtocols = protocols.filter((item) => item.channels.includes('email') && item.channels.includes('whatsapp')).length;

    const emailClients = clients.filter((item) => item.channels.includes('email')).length;
    const whatsappClients = clients.filter((item) => item.channels.includes('whatsapp')).length;
    const sharedClients = clients.filter((item) => item.channels.includes('email') && item.channels.includes('whatsapp')).length;

    return NextResponse.json({
      ok: true,
      window_days: days,
      summary: {
        email_messages: emailMessages,
        whatsapp_messages: whatsappMessages,
        total_protocols: protocols.length,
        protocols_email: emailProtocols,
        protocols_whatsapp: whatsappProtocols,
        protocols_shared: sharedProtocols,
        clients_email: emailClients,
        clients_whatsapp: whatsappClients,
        clients_shared: sharedClients,
      },
      protocols: protocols.slice(0, 30),
      clients: {
        email_only: clients.filter((item) => item.channels.includes('email') && !item.channels.includes('whatsapp')).slice(0, 15),
        whatsapp_only: clients.filter((item) => item.channels.includes('whatsapp') && !item.channels.includes('email')).slice(0, 15),
        shared: clients.filter((item) => item.channels.includes('email') && item.channels.includes('whatsapp')).slice(0, 15),
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
