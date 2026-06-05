import { isSupabaseConfigured, getSupabaseAdmin } from '@/lib/supabase'
import { getMysqlPool } from '@/infrastructure/datalake/mysql-client'
import type { RowDataPacket } from 'mysql2'
import type { UserPages } from '@/lib/user-pages'
import { DEFAULT_PAGES, SUPERADMIN_PAGES } from '@/lib/user-pages'

export type { UserPages }

export interface RegistryUser {
  name: string
  email: string
  picture?: string
  role: 'superadmin' | 'admin' | 'user'
  firstLogin: string
  lastLogin: string
  pages: UserPages
  tokenVersion: number
  preRegistered?: boolean  // cadastrado pelo admin sem ter feito login ainda
}

export type UserRegistry = Record<string, RegistryUser>

export async function loadRegistry(): Promise<UserRegistry> {
  try {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin()
      const { data, error } = await supabase.from('hub_users').select('*')
      if (error) {
        console.error('Error loading users registry from Supabase:', error)
        return {}
      }
      const registry: UserRegistry = {}
      for (const row of data || []) {
        registry[row.email] = {
          name: row.name,
          email: row.email,
          picture: row.picture || undefined,
          role: row.role,
          firstLogin: row.first_login || '',
          lastLogin: row.last_login || '',
          pages: row.pages,
          tokenVersion: row.token_version,
          preRegistered: row.pre_registered,
        }
      }
      return registry
    } else {
      const pool = getMysqlPool()
      const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM os_users')
      const registry: UserRegistry = {}
      for (const row of rows || []) {
        registry[row.email] = {
          name: row.name,
          email: row.email,
          picture: row.picture || undefined,
          role: row.role as any,
          firstLogin: row.first_login ? new Date(row.first_login).toISOString() : '',
          lastLogin: row.last_login ? new Date(row.last_login).toISOString() : '',
          pages: typeof row.pages === 'string' ? JSON.parse(row.pages) : row.pages,
          tokenVersion: row.token_version,
          preRegistered: !!row.pre_registered,
        }
      }
      return registry
    }
  } catch (e) {
    console.error('Failed to load registry:', e)
    return {}
  }
}

export async function registerLogin(params: {
  email: string
  name?: string
  picture?: string
  role: 'superadmin' | 'user'
}): Promise<RegistryUser> {
  const now = new Date().toISOString()
  
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    
    // Get existing user first to preserve role/pages/tokenVersion/etc. if needed
    const { data: existing } = await supabase
      .from('hub_users')
      .select('*')
      .eq('email', params.email)
      .single()

    const name = params.name ?? existing?.name ?? params.email
    const picture = params.picture ?? existing?.picture ?? null
    const role = existing?.role ?? params.role
    const firstLogin = existing?.first_login ?? now
    const lastLogin = now
    const pages = existing?.pages ?? (params.role === 'superadmin' ? SUPERADMIN_PAGES : DEFAULT_PAGES)
    const tokenVersion = existing?.token_version ?? 0
    const preRegistered = false

    const { error: upsertError } = await supabase
      .from('hub_users')
      .upsert({
        email: params.email,
        name,
        picture,
        role,
        first_login: firstLogin,
        last_login: lastLogin,
        pages,
        token_version: tokenVersion,
        pre_registered: preRegistered
      })

    if (upsertError) {
      console.error('Error registering login in Supabase:', upsertError)
    }

    return {
      name,
      email: params.email,
      picture: picture || undefined,
      role,
      firstLogin,
      lastLogin,
      pages,
      tokenVersion,
      preRegistered,
    }
  } else {
    const pool = getMysqlPool()
    
    // Get existing user
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM os_users WHERE email = ?', [params.email])
    const existing = rows[0]

    const name = params.name ?? existing?.name ?? params.email
    const picture = params.picture ?? existing?.picture ?? null
    const role = existing?.role ?? params.role
    const firstLogin = existing?.first_login ? new Date(existing.first_login).toISOString() : now
    const lastLogin = now
    const pages = existing?.pages 
      ? (typeof existing.pages === 'string' ? JSON.parse(existing.pages) : existing.pages)
      : (params.role === 'superadmin' ? SUPERADMIN_PAGES : DEFAULT_PAGES)
    const tokenVersion = existing?.token_version ?? 0
    const preRegistered = false

    await pool.query(
      `INSERT INTO os_users (email, name, picture, role, first_login, last_login, pages, token_version, pre_registered) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=?, picture=?, role=?, last_login=?, token_version=?, pre_registered=?`,
      [
        params.email, name, picture, role, new Date(firstLogin), new Date(lastLogin), JSON.stringify(pages), tokenVersion, preRegistered,
        name, picture, role, new Date(lastLogin), tokenVersion, preRegistered
      ]
    )

    return {
      name,
      email: params.email,
      picture: picture || undefined,
      role,
      firstLogin,
      lastLogin,
      pages,
      tokenVersion,
      preRegistered,
    }
  }
}

export async function getUserPages(email: string): Promise<UserPages> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('hub_users')
      .select('pages')
      .eq('email', email)
      .single()
    if (error || !data) return DEFAULT_PAGES
    return data.pages as UserPages
  } else {
    try {
      const pool = getMysqlPool()
      const [rows] = await pool.query<RowDataPacket[]>('SELECT pages FROM os_users WHERE email = ?', [email])
      if (rows.length === 0 || !rows[0].pages) return DEFAULT_PAGES
      const pages = rows[0].pages
      return typeof pages === 'string' ? JSON.parse(pages) : pages
    } catch {
      return DEFAULT_PAGES
    }
  }
}

export async function updateUserPages(email: string, update: Partial<UserPages>): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { data: existing, error: getError } = await supabase
      .from('hub_users')
      .select('pages')
      .eq('email', email)
      .single()
    if (getError || !existing) return false

    const newPages = { ...(existing.pages as UserPages), ...update }
    const { error: updateError } = await supabase
      .from('hub_users')
      .update({ pages: newPages })
      .eq('email', email)
    
    return !updateError
  } else {
    try {
      const pool = getMysqlPool()
      const [rows] = await pool.query<RowDataPacket[]>('SELECT pages FROM os_users WHERE email = ?', [email])
      if (rows.length === 0) return false
      const existingPages = typeof rows[0].pages === 'string' ? JSON.parse(rows[0].pages) : rows[0].pages
      const newPages = { ...existingPages, ...update }
      await pool.query('UPDATE os_users SET pages = ? WHERE email = ?', [JSON.stringify(newPages), email])
      return true
    } catch {
      return false
    }
  }
}

export async function forceLogout(email: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { data, error: getError } = await supabase
      .from('hub_users')
      .select('token_version')
      .eq('email', email)
      .single()
    if (getError || !data) return false

    const { error: updateError } = await supabase
      .from('hub_users')
      .update({ token_version: (data.token_version ?? 0) + 1 })
      .eq('email', email)

    return !updateError
  } else {
    try {
      const pool = getMysqlPool()
      const [rows] = await pool.query<RowDataPacket[]>('SELECT token_version FROM os_users WHERE email = ?', [email])
      if (rows.length === 0) return false
      const currentVersion = rows[0].token_version ?? 0
      await pool.query('UPDATE os_users SET token_version = ? WHERE email = ?', [currentVersion + 1, email])
      return true
    } catch {
      return false
    }
  }
}

export async function getTokenVersion(email: string): Promise<number> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('hub_users')
      .select('token_version')
      .eq('email', email)
      .single()
    if (error || !data) return 0
    return data.token_version
  } else {
    try {
      const pool = getMysqlPool()
      const [rows] = await pool.query<RowDataPacket[]>('SELECT token_version FROM os_users WHERE email = ?', [email])
      if (rows.length === 0) return 0
      return rows[0].token_version ?? 0
    } catch {
      return 0
    }
  }
}

// Retorna 'all' para superadmin/admin, lista de tabelas para user, [] se sem acesso
export async function getUserAllowedTables(email: string): Promise<string[] | 'all'> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('hub_users')
      .select('role, pages')
      .eq('email', email)
      .single()
    if (error || !data) return []
    if (data.role === 'superadmin' || data.role === 'admin') return 'all'
    const pages = data.pages as UserPages
    if (!pages.dashboards) return []
    return pages.dashboardTables ?? []
  } else {
    try {
      const pool = getMysqlPool()
      const [rows] = await pool.query<RowDataPacket[]>('SELECT role, pages FROM os_users WHERE email = ?', [email])
      if (rows.length === 0) return []
      const user = rows[0]
      if (user.role === 'superadmin' || user.role === 'admin') return 'all'
      const pages = typeof user.pages === 'string' ? JSON.parse(user.pages) : user.pages
      if (!pages.dashboards) return []
      return pages.dashboardTables ?? []
    } catch {
      return []
    }
  }
}

export async function setUserRole(email: string, role: 'admin' | 'user'): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { data: existing, error: getError } = await supabase
      .from('hub_users')
      .select('role')
      .eq('email', email)
      .single()
    if (getError || !existing) return false
    if (existing.role === 'superadmin') return false // superadmin não pode ser alterado

    const updatePayload: Record<string, unknown> = { role }
    if (role === 'admin') {
      updatePayload.pages = SUPERADMIN_PAGES
    }

    const { error: updateError } = await supabase
      .from('hub_users')
      .update(updatePayload)
      .eq('email', email)

    return !updateError
  } else {
    try {
      const pool = getMysqlPool()
      const [rows] = await pool.query<RowDataPacket[]>('SELECT role FROM os_users WHERE email = ?', [email])
      if (rows.length === 0) return false
      if (rows[0].role === 'superadmin') return false

      if (role === 'admin') {
        await pool.query('UPDATE os_users SET role = ?, pages = ? WHERE email = ?', [role, JSON.stringify(SUPERADMIN_PAGES), email])
      } else {
        await pool.query('UPDATE os_users SET role = ? WHERE email = ?', [role, email])
      }
      return true
    } catch {
      return false
    }
  }
}

export async function getRegistryUser(email: string): Promise<RegistryUser | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('hub_users')
      .select('*')
      .eq('email', email)
      .single()
    if (error || !data) return null
    return {
      name: data.name,
      email: data.email,
      picture: data.picture || undefined,
      role: data.role,
      firstLogin: data.first_login || '',
      lastLogin: data.last_login || '',
      pages: data.pages,
      tokenVersion: data.token_version,
      preRegistered: data.pre_registered,
    }
  } else {
    try {
      const pool = getMysqlPool()
      const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM os_users WHERE email = ?', [email])
      if (rows.length === 0) return null
      const data = rows[0]
      return {
        name: data.name,
        email: data.email,
        picture: data.picture || undefined,
        role: data.role,
        firstLogin: data.first_login ? new Date(data.first_login).toISOString() : '',
        lastLogin: data.last_login ? new Date(data.last_login).toISOString() : '',
        pages: typeof data.pages === 'string' ? JSON.parse(data.pages) : data.pages,
        tokenVersion: data.token_version,
        preRegistered: !!data.pre_registered,
      }
    } catch {
      return null
    }
  }
}

// Verifica se email existe no registro (logado OU pré-cadastrado)
export async function isEmailKnown(email: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { count, error } = await supabase
      .from('hub_users')
      .select('*', { count: 'exact', head: true })
      .eq('email', email)
    if (error || count === null) return false
    return count > 0
  } else {
    try {
      const pool = getMysqlPool()
      const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as count FROM os_users WHERE email = ?', [email])
      return (rows[0]?.count ?? 0) > 0
    } catch {
      return false
    }
  }
}

// Pré-cadastra um usuário pelo admin (sem precisar de login)
export async function preRegisterUser(name: string, email: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { data: existing } = await supabase
      .from('hub_users')
      .select('email')
      .eq('email', email)
      .single()
    
    if (existing) {
      // Já existe — apenas garante que não está marcado como pré-cadastrado se já logou
      return true
    }

    const { error: insertError } = await supabase
      .from('hub_users')
      .insert({
        name,
        email,
        role: 'user',
        first_login: null,
        last_login: null,
        pages: DEFAULT_PAGES,
        token_version: 0,
        pre_registered: true,
      })

    return !insertError
  } else {
    try {
      const pool = getMysqlPool()
      const [rows] = await pool.query<RowDataPacket[]>('SELECT email FROM os_users WHERE email = ?', [email])
      if (rows.length > 0) return true

      await pool.query(
        `INSERT INTO os_users (name, email, role, first_login, last_login, pages, token_version, pre_registered) 
         VALUES (?, ?, 'user', NULL, NULL, ?, 0, true)`,
        [name, email, JSON.stringify(DEFAULT_PAGES)]
      )
      return true
    } catch {
      return false
    }
  }
}

// Remove pré-cadastro (apenas se ainda não tiver logado)
export async function removePreRegisteredUser(email: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { data: existing, error: getError } = await supabase
      .from('hub_users')
      .select('pre_registered')
      .eq('email', email)
      .single()
    if (getError || !existing || !existing.pre_registered) return false

    const { error: deleteError } = await supabase
      .from('hub_users')
      .delete()
      .eq('email', email)

    return !deleteError
  } else {
    try {
      const pool = getMysqlPool()
      const [rows] = await pool.query<RowDataPacket[]>('SELECT pre_registered FROM os_users WHERE email = ?', [email])
      if (rows.length === 0 || !rows[0].pre_registered) return false

      await pool.query('DELETE FROM os_users WHERE email = ?', [email])
      return true
    } catch {
      return false
    }
  }
}

export async function updateUserTables(email: string, tables: string[]): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin()
    const { data: existing, error: getError } = await supabase
      .from('hub_users')
      .select('pages')
      .eq('email', email)
      .single()
    if (getError || !existing) return false

    const newPages = { ...(existing.pages as UserPages), dashboardTables: tables }
    const { error: updateError } = await supabase
      .from('hub_users')
      .update({ pages: newPages })
      .eq('email', email)

    return !updateError
  } else {
    try {
      const pool = getMysqlPool()
      const [rows] = await pool.query<RowDataPacket[]>('SELECT pages FROM os_users WHERE email = ?', [email])
      if (rows.length === 0) return false
      const existingPages = typeof rows[0].pages === 'string' ? JSON.parse(rows[0].pages) : rows[0].pages
      const newPages = { ...existingPages, dashboardTables: tables }
      await pool.query('UPDATE os_users SET pages = ? WHERE email = ?', [JSON.stringify(newPages), email])
      return true
    } catch {
      return false
    }
  }
}
