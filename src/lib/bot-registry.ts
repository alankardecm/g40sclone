import { getSupabaseAdmin } from '@/lib/supabase'

export async function registerLid(lid: string, phone: string): Promise<void> {
  const clean  = phone.replace(/\D/g, '')
  const number = clean.startsWith('55') ? clean : `55${clean}`
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('hub_bot_lid_registry')
    .upsert({ lid, phone: number })
  if (error) {
    console.error('[BotRegistry] falha ao salvar lid:', error)
  }
}

export async function resolveReplyTarget(jid: string): Promise<string | null> {
  if (!jid.includes('@lid')) return null
  const lid = jid.split('@')[0]
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('hub_bot_lid_registry')
    .select('phone')
    .eq('lid', lid)
    .single()
  if (error || !data) return null
  return data.phone
}

export async function isRegistered(jid: string): Promise<boolean> {
  if (!jid.includes('@lid')) return true
  const lid = jid.split('@')[0]
  const supabase = getSupabaseAdmin()
  const { count, error } = await supabase
    .from('hub_bot_lid_registry')
    .select('*', { count: 'exact', head: true })
    .eq('lid', lid)
  if (error || count === null) return false
  return count > 0
}

// Verifica se o número resolvido está na whitelist (BOT_WHITELIST=55199...,55119...)
export function isWhitelisted(phone: string): boolean {
  const raw = process.env.BOT_WHITELIST ?? ''
  if (!raw.trim()) return true // sem whitelist = aberto
  const allowed = raw.split(',').map(n => n.replace(/\D/g, '').trim())
  const clean   = phone.replace(/\D/g, '')
  return allowed.some(n => clean.endsWith(n) || n.endsWith(clean))
}
