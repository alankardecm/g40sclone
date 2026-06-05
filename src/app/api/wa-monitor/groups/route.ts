import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { DEFAULT_EXCLUDED_GROUPS, normalizeGroupKey } from '@/lib/waGroups';

type GroupRow = {
  id: string;
  whatsapp_jid: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

type LatestMessageRow = {
  group_id: string;
  id: string;
  external_message_id: string | null;
  msg_timestamp: number | null;
  created_at: string;
};

type TodayMessageRow = {
  group_id: string;
  id: string;
  external_message_id: string | null;
  msg_timestamp: number | null;
  created_at: string;
};

function getTodayStartTimestampSaoPaulo() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = formatter.format(new Date());
  return Math.floor(new Date(`${today}T00:00:00-03:00`).getTime() / 1000);
}

const excludedGroupKeys = new Set(
  DEFAULT_EXCLUDED_GROUPS.map((name) => normalizeGroupKey(name)).filter(Boolean)
);

function shouldHideGroup(group: GroupRow) {
  const key = normalizeGroupKey(group.name || '');
  if (!key) return true;
  if (excludedGroupKeys.has(key)) return true;
  return false;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const todayStartTimestamp = getTodayStartTimestampSaoPaulo();
    const [groupsResult, messagesResult, todayMessagesResult] = await Promise.all([
      supabase
      .from('wa_groups')
      .select('id, whatsapp_jid, name, description, is_active, created_at')
      .order('created_at', { ascending: false }),
      supabase
        .from('wa_messages')
        .select('id, group_id, external_message_id, msg_timestamp, created_at')
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase
        .from('wa_messages')
        .select('id, group_id, external_message_id, msg_timestamp, created_at')
        .gte('msg_timestamp', todayStartTimestamp)
        .order('msg_timestamp', { ascending: false }),
    ]);

    const { data: groups, error: groupsError } = groupsResult;
    const { data: latestMessages, error: messagesError } = messagesResult;
    const { data: todayMessages, error: todayMessagesError } = todayMessagesResult;

    if (groupsError) {
      return NextResponse.json({ ok: false, error: groupsError.message }, { status: 500 });
    }

    if (messagesError) {
      return NextResponse.json({ ok: false, error: messagesError.message }, { status: 500 });
    }

    if (todayMessagesError) {
      return NextResponse.json({ ok: false, error: todayMessagesError.message }, { status: 500 });
    }

    const latestByGroup = new Map<string, LatestMessageRow>();
    for (const message of (latestMessages || []) as LatestMessageRow[]) {
      if (!latestByGroup.has(message.group_id)) {
        latestByGroup.set(message.group_id, message);
      }
    }

    const todayByGroup = new Map<string, {
      count: number;
      first_msg_timestamp: number | null;
      last_msg_timestamp: number | null;
      first_message_id: string | null;
      last_message_id: string | null;
    }>();

    for (const message of (todayMessages || []) as TodayMessageRow[]) {
      const current = todayByGroup.get(message.group_id) || {
        count: 0,
        first_msg_timestamp: null,
        last_msg_timestamp: null,
        first_message_id: null,
        last_message_id: null,
      };

      const timestamp = typeof message.msg_timestamp === 'number' ? message.msg_timestamp : null;
      current.count += 1;
      if (timestamp !== null) {
        if (current.last_msg_timestamp === null || timestamp > current.last_msg_timestamp) {
          current.last_msg_timestamp = timestamp;
          current.last_message_id = message.external_message_id || message.id;
        }
        if (current.first_msg_timestamp === null || timestamp < current.first_msg_timestamp) {
          current.first_msg_timestamp = timestamp;
          current.first_message_id = message.external_message_id || message.id;
        }
      }

      todayByGroup.set(message.group_id, current);
    }

    const enrichedGroups = ((groups || []) as GroupRow[])
      .filter((group) => !shouldHideGroup(group))
      .map((group) => {
        const latest = latestByGroup.get(group.id) || null;
        const today = todayByGroup.get(group.id) || null;
        return {
          ...group,
          latest_message: latest
            ? {
                id: latest.id,
                external_message_id: latest.external_message_id,
                msg_timestamp: latest.msg_timestamp,
                created_at: latest.created_at,
              }
            : null,
          today_messages: today
            ? {
                count: today.count,
                first_msg_timestamp: today.first_msg_timestamp,
                last_msg_timestamp: today.last_msg_timestamp,
                first_message_id: today.first_message_id,
                last_message_id: today.last_message_id,
              }
            : {
                count: 0,
                first_msg_timestamp: null,
                last_msg_timestamp: null,
                first_message_id: null,
                last_message_id: null,
              },
        };
      });

    return NextResponse.json({ ok: true, groups: enrichedGroups });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
