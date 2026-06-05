import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type MessageRow = {
  id: string;
  group_id: string;
  sender_name: string | null;
  text_raw: string;
  msg_timestamp: number | null;
  wa_groups: { id: string; name: string } | Array<{ id: string; name: string }> | null;
  wa_analysis:
    | { sentiment?: string | null; urgency?: string | null; keywords?: string[] | null }
    | Array<{ sentiment?: string | null; urgency?: string | null; keywords?: string[] | null }>
    | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('group_id') ?? null;
  const sinceParam = searchParams.get('since_ts');

  let lastTs = sinceParam
    ? Number(sinceParam)
    : Math.floor(Date.now() / 1000) - 60;

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream already closed
        }
      };

      send({ type: 'connected', ts: Date.now(), last_ts: lastTs });

      const poll = async () => {
        if (closed) return;

        try {
          const supabase = getSupabaseAdmin();
          let query = supabase
            .from('wa_messages')
            .select(
              `id, group_id, sender_name, text_raw, msg_timestamp,
               wa_groups!inner(id, name),
               wa_analysis(sentiment, urgency, keywords)`
            )
            .gt('msg_timestamp', lastTs)
            .order('msg_timestamp', { ascending: true })
            .limit(50);

          if (groupId) query = query.eq('group_id', groupId);

          const { data, error } = await query;

          if (error) {
            send({ type: 'error', error: error.message });
          } else if (data && data.length > 0) {
            const rows = data as unknown as MessageRow[];
            const newMaxTs = rows.reduce(
              (max, m) => Math.max(max, Number(m.msg_timestamp) || 0),
              lastTs
            );
            if (newMaxTs > lastTs) lastTs = newMaxTs;

            send({
              type: 'messages',
              count: rows.length,
              last_ts: lastTs,
              messages: rows.map((m) => {
                const group = Array.isArray(m.wa_groups) ? m.wa_groups[0] : m.wa_groups;
                const analysis = Array.isArray(m.wa_analysis)
                  ? m.wa_analysis[0]
                  : m.wa_analysis;
                return {
                  id: m.id,
                  group_id: m.group_id,
                  group_name: group?.name ?? null,
                  sender_name: m.sender_name,
                  text: m.text_raw,
                  msg_timestamp: m.msg_timestamp,
                  sentiment: analysis?.sentiment ?? null,
                  urgency: analysis?.urgency ?? null,
                  keywords: analysis?.keywords ?? [],
                };
              }),
            });
          } else {
            send({ type: 'heartbeat', ts: Date.now(), last_ts: lastTs });
          }
        } catch (err) {
          send({ type: 'error', error: String(err) });
        }

        if (!closed) {
          setTimeout(poll, 5000);
        }
      };

      setTimeout(poll, 2000);

      request.signal.addEventListener('abort', () => {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
