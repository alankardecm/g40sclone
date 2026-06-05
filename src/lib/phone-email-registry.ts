import { isSupabaseConfigured, getSupabaseAdmin } from '@/lib/supabase'
import { getMysqlPool } from '@/infrastructure/datalake/mysql-client'
import type { RowDataPacket } from 'mysql2'

export async function getEmailByPhone(phone: string): Promise<string | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('hub_phone_email')
      .select('email')
      .eq('phone', phone)
      .single()
    if (error || !data) return null
    return data.email
  } else {
    try {
      const pool = getMysqlPool()
      const [rows] = await pool.query<RowDataPacket[]>('SELECT email FROM os_phone_email WHERE phone = ?', [phone])
      if (rows.length === 0) return null
      return rows[0].email
    } catch {
      return null
    }
  }
}

export async function registerPhoneEmail(phone: string, email: string): Promise<void> {
  const cleanEmail = email.toLowerCase().trim()
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('hub_phone_email')
      .upsert({
        phone,
        email: cleanEmail
      })
    if (error) {
      console.error('Error registering phone email in Supabase:', error)
    }
  } else {
    try {
      const pool = getMysqlPool()
      await pool.query(
        'INSERT INTO os_phone_email (phone, email) VALUES (?, ?) ON DUPLICATE KEY UPDATE email = ?',
        [phone, cleanEmail, cleanEmail]
      )
    } catch (err) {
      console.error('Error registering phone email in MySQL:', err)
    }
  }
}

export async function isPhoneRegistered(phone: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { count, error } = await supabase
      .from('hub_phone_email')
      .select('*', { count: 'exact', head: true })
      .eq('phone', phone)
    if (error || count === null) return false
    return count > 0
  } else {
    try {
      const pool = getMysqlPool()
      const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM os_phone_email WHERE phone = ?', [phone])
      return (rows[0]?.count ?? 0) > 0
    } catch {
      return false
    }
  }
}
