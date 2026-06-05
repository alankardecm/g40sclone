import { isSupabaseConfigured, getSupabaseAdmin } from '@/lib/supabase'
import { getMysqlPool } from '@/infrastructure/datalake/mysql-client'
import type { RowDataPacket } from 'mysql2'

const TTL_MS = 10 * 60 * 1000 // 10 minutos

export interface PendingItem {
  instance: string
  item: Record<string, unknown>
  replyTo: string
  pushName: string
  timestamp: string
}

export async function savePendingAudio(phone: string, item: PendingItem): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('hub_pending_audios')
      .upsert({
        phone,
        instance: item.instance,
        item: item.item,
        reply_to: item.replyTo,
        push_name: item.pushName,
        timestamp: item.timestamp,
      })
    if (error) {
      console.error('Error saving pending audio in Supabase:', error)
    }
  } else {
    try {
      const pool = getMysqlPool()
      await pool.query(
        `INSERT INTO os_pending_audios (phone, instance, item, reply_to, push_name, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE instance=?, item=?, reply_to=?, push_name=?, timestamp=?`,
        [
          phone, item.instance, JSON.stringify(item.item), item.replyTo, item.pushName, new Date(item.timestamp),
          item.instance, JSON.stringify(item.item), item.replyTo, item.pushName, new Date(item.timestamp)
        ]
      )
    } catch (err) {
      console.error('Error saving pending audio in MySQL:', err)
    }
  }
}

export async function getPendingAudio(phone: string): Promise<PendingItem | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('hub_pending_audios')
      .select('*')
      .eq('phone', phone)
      .single()

    if (error || !data) return null

    // Verifica TTL
    if (Date.now() - new Date(data.timestamp).getTime() > TTL_MS) {
      await clearPendingAudio(phone)
      return null
    }

    return {
      instance: data.instance,
      item: data.item,
      replyTo: data.reply_to,
      pushName: data.push_name,
      timestamp: data.timestamp,
    }
  } else {
    try {
      const pool = getMysqlPool()
      const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM os_pending_audios WHERE phone = ?', [phone])
      if (rows.length === 0) return null
      const data = rows[0]

      // Verifica TTL
      if (Date.now() - new Date(data.timestamp).getTime() > TTL_MS) {
        await clearPendingAudio(phone)
        return null
      }

      return {
        instance: data.instance,
        item: typeof data.item === 'string' ? JSON.parse(data.item) : data.item,
        replyTo: data.reply_to,
        pushName: data.push_name,
        timestamp: data.timestamp,
      }
    } catch {
      return null
    }
  }
}

export async function clearPendingAudio(phone: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('hub_pending_audios')
      .delete()
      .eq('phone', phone)
    if (error) {
      console.error('Error clearing pending audio in Supabase:', error)
    }
  } else {
    try {
      const pool = getMysqlPool()
      await pool.query('DELETE FROM os_pending_audios WHERE phone = ?', [phone])
    } catch (err) {
      console.error('Error clearing pending audio in MySQL:', err)
    }
  }
}
