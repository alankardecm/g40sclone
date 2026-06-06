'use client'

import { useState } from 'react'
import type { RegistryUser } from '@/lib/user-registry'
import type { UserPages } from '@/lib/user-pages'
import { MessageSquare, BarChart2, Activity, Bell, Smartphone, Database, Search, Video, LogOut, ShieldCheck, ShieldOff, Wallet } from 'lucide-react'
import { TablePermissionsModal } from './TablePermissionsModal'

const SIMPLE_PAGES = [
  { key: 'chat',       label: 'Chat',      Icon: MessageSquare },
  { key: 'monitoring', label: 'NOC',       Icon: Activity },
  { key: 'zabbix',    label: 'Zabbix',    Icon: Bell },
  { key: 'whatsapp',  label: 'WhatsApp',  Icon: Smartphone },
  { key: 'datalake',  label: 'DataLake',  Icon: Database },
  { key: 'rag',       label: 'RAG',       Icon: Search },
  { key: 'netmeet',   label: 'NetMeet',   Icon: Video },
  { key: 'custos',    label: 'Custos',    Icon: Wallet },
] as const

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2)  return 'Agora'
  if (mins < 60) return `${mins}m atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h atrás`
  return `${Math.floor(hrs / 24)}d atrás`
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const AVATAR_COLORS = [
  '#3B82F6', '#3b82f6', '#8b5cf6', '#f59e0b',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4',
]

function avatarColor(email: string): string {
  let hash = 0
  for (const c of email) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

interface Props {
  user: RegistryUser
  isSelf: boolean
}

export function UserPermissionRow({ user, isSelf }: Props) {
  const [pages, setPages] = useState<UserPages>(user.pages)
  const [saving, setSaving] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [loggedOut, setLoggedOut] = useState(false)
  const [showTableModal, setShowTableModal] = useState(false)
  const [currentRole, setCurrentRole] = useState(user.role)
  const [changingRole, setChangingRole] = useState(false)

  const isOnline = Date.now() - new Date(user.lastLogin).getTime() < 30 * 60 * 1000

  async function patch(update: Partial<UserPages>) {
    const key = Object.keys(update)[0]
    setSaving(key)
    setPages(p => ({ ...p, ...update }))
    try {
      await fetch(`/api/admin/users/${encodeURIComponent(user.email)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      })
    } finally {
      setSaving(null)
    }
  }

  async function handleRoleToggle() {
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    const action = newRole === 'admin' ? 'promover a Admin' : 'rebaixar para Usuário'
    if (!confirm(`${action} ${user.name}? O usuário será deslogado automaticamente.`)) return
    setChangingRole(true)
    try {
      await fetch(`/api/admin/users/${encodeURIComponent(user.email)}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      setCurrentRole(newRole)
      setLoggedOut(true) // já foi forçado logout pelo servidor
    } finally {
      setChangingRole(false)
    }
  }

  async function handleForceLogout() {
    if (!confirm(`Forçar logout de ${user.name}?`)) return
    setLoggingOut(true)
    try {
      await fetch(`/api/admin/users/${encodeURIComponent(user.email)}/logout`, { method: 'POST' })
      setLoggedOut(true)
    } finally {
      setLoggingOut(false)
    }
  }

  const isSuperadmin = user.role === 'superadmin'
  const isPreRegistered = !!user.preRegistered

  return (
    <tr className="border-b border-border hover:bg-[#f9faf7] transition-colors group">

      {/* Usuário */}
      <td className="py-4 px-5 min-w-[220px]">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center text-[11px] font-black text-white shadow-sm"
            style={{ backgroundColor: avatarColor(user.email) }}
          >
            {user.picture
              ? <img src={user.picture} alt="" className="h-9 w-9 rounded-xl object-cover" />
              : initials(user.name)
            }
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-[#E6EAF3] truncate">{user.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="py-4 px-4 min-w-[110px]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            {isSuperadmin ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#3B82F6]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#2563EB]">
                Owner
              </span>
            ) : currentRole === 'admin' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-blue-600">
                Admin
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                Usuário
              </span>
            )}
            {!isSuperadmin && (
              <button
                onClick={handleRoleToggle}
                disabled={changingRole}
                title={currentRole === 'admin' ? 'Rebaixar para Usuário' : 'Promover a Admin'}
                className={`h-5 w-5 flex items-center justify-center rounded-md transition-all ${
                  currentRole === 'admin'
                    ? 'text-blue-400 hover:bg-red-50 hover:text-red-400'
                    : 'text-gray-300 hover:bg-blue-50 hover:text-blue-500'
                } disabled:opacity-40`}
              >
                {changingRole
                  ? <span className="h-2.5 w-2.5 rounded-full border border-current border-t-transparent animate-spin" />
                  : currentRole === 'admin'
                    ? <ShieldOff className="h-3 w-3" strokeWidth={2} />
                    : <ShieldCheck className="h-3 w-3" strokeWidth={2} />
                }
              </button>
            )}
          </div>
          {isPreRegistered ? (
            <span className="text-[9px] text-amber-500 font-bold">Aguardando 1º login</span>
          ) : (
            <div className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${isOnline ? 'bg-[#3B82F6] animate-pulse' : 'bg-gray-300'}`} />
              <span className="text-[9px] text-muted-foreground font-medium">{relativeTime(user.lastLogin)}</span>
            </div>
          )}
        </div>
      </td>

      {/* Dashboard — 3 estados + botão de tabelas */}
      <td className="py-4 px-3 text-center min-w-[130px]">
        {isSuperadmin ? (
          <span className="text-[10px] font-black text-[#3B82F6] uppercase tracking-wide">Tudo</span>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <div className="inline-flex rounded-lg border border-border overflow-hidden text-[9px] font-black uppercase tracking-wide">
              {(['false', 'view', 'edit'] as const).map((val) => {
                const active = String(pages.dashboards) === val
                return (
                  <button
                    key={val}
                    disabled={saving === 'dashboards'}
                    onClick={() => patch({ dashboards: val === 'false' ? false : val })}
                    className={`px-2 py-1.5 transition-colors ${
                      active
                        ? val === 'false'
                          ? 'bg-muted text-muted-foreground'
                          : val === 'view'
                            ? 'bg-blue-500 text-white'
                            : 'bg-[#3B82F6] text-white'
                        : 'bg-card text-gray-300 hover:bg-background'
                    } disabled:cursor-not-allowed`}
                  >
                    {val === 'false' ? '—' : val === 'view' ? 'VER' : 'EDI'}
                  </button>
                )
              })}
            </div>
            {pages.dashboards && (
              <button
                onClick={() => setShowTableModal(true)}
                className="text-[9px] font-black uppercase tracking-wide text-[#3B82F6] hover:underline"
              >
                📋 {(pages.dashboardTables ?? []).length} tabela{(pages.dashboardTables ?? []).length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}

        {showTableModal && !isSuperadmin && (
          <TablePermissionsModal
            email={user.email}
            userName={user.name}
            currentTables={pages.dashboardTables ?? []}
            onClose={() => setShowTableModal(false)}
            onSave={(tables) => {
              setPages(p => ({ ...p, dashboardTables: tables }))
              setShowTableModal(false)
            }}
          />
        )}
      </td>

      {/* Páginas simples */}
      {SIMPLE_PAGES.map(({ key, label, Icon }) => {
        const enabled = pages[key as keyof UserPages] as boolean
        return (
          <td key={key} className="py-4 px-3 text-center">
            {isSuperadmin ? (
              <span className="inline-block h-2 w-2 rounded-full bg-[#3B82F6]" />
            ) : (
              <button
                disabled={saving === key}
                onClick={() => patch({ [key]: !enabled } as Partial<UserPages>)}
                title={label}
                className={`relative inline-flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150 ${
                  enabled
                    ? 'bg-[#3B82F6]/15 text-[#2563EB] hover:bg-[#3B82F6]/25'
                    : 'bg-muted text-gray-300 hover:bg-muted'
                } disabled:cursor-not-allowed`}
              >
                {saving === key
                  ? <span className="h-3 w-3 rounded-full border-2 border-border border-t-[#3B82F6] animate-spin" />
                  : <Icon className="h-3.5 w-3.5" strokeWidth={enabled ? 2.5 : 1.5} />
                }
              </button>
            )}
          </td>
        )
      })}

      {/* Force Logout — sempre no final */}
      <td className="py-4 px-3 text-center">
        <button
          onClick={handleForceLogout}
          disabled={loggingOut}
          title={loggedOut ? 'Kick enviado — sessão será invalidada no próximo acesso' : 'Forçar logout (kick)'}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150 ${
            loggedOut
              ? 'bg-amber-100 text-amber-500 cursor-default'
              : 'bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loggingOut
            ? <span className="h-3 w-3 rounded-full border-2 border-red-200 border-t-red-500 animate-spin" />
            : <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
          }
        </button>
      </td>
    </tr>
  )
}
