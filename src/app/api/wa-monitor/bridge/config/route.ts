import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { DEFAULT_EXCLUDED_GROUPS, normalizeGroupKey } from '@/lib/waGroups';

export async function GET(request: Request) {
  const token = process.env.WHATSAPP_CAPTURE_TOKEN;
  if (token) {
    const received = new URL(request.url).searchParams.get('token') || request.headers.get('x-wa-capture-token');
    if (!received || received !== token) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
  }

  try {
    const supabase = getSupabaseAdmin();
    
    // Busca todos os grupos registrados
    const { data: groups, error: groupsError } = await supabase
      .from('wa_groups')
      .select('id, whatsapp_jid, name, is_active, description');

    if (groupsError) throw groupsError;

    // Mapeia grupos explicitamente desativados ou na blacklist padrão
    const excludedKeys = new Set(DEFAULT_EXCLUDED_GROUPS.map(normalizeGroupKey));
    
    const config = {
      monitoredGroups: groups?.filter(g => g.is_active && !excludedKeys.has(normalizeGroupKey(g.name))).map(g => ({
        jid: g.whatsapp_jid,
        name: g.name
      })) || [],
      ignoredGroups: groups?.filter(g => !g.is_active || excludedKeys.has(normalizeGroupKey(g.name))).map(g => ({
        jid: g.whatsapp_jid,
        name: g.name
      })) || [],
      settings: {
        monitorAllGroups: process.env.MONITOR_ALL_GROUPS !== 'false',
        backfillDays: Number(process.env.WA_BACKFILL_DAYS || 1),
      }
    };

    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
