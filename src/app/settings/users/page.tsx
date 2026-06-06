import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { loadRegistry } from '@/lib/user-registry'
import { UserPermissionRow } from '@/components/admin/UserPermissionRow'
import { UsersPageActions } from '@/components/admin/UsersPageActions'
import Sidebar from '@/components/Sidebar'
import { Users, ShieldCheck, Wifi, Lock, BarChart2, MessageSquare, Activity, Bell, Smartphone, Database, Search, Video, LogOut, Wallet } from 'lucide-react'

export default async function UsersPage() {
  const session = await auth()
  if (!session) redirect('/auth/signin')
  if (session.user.role !== 'superadmin' && session.user.role !== 'admin') redirect('/access-denied')

  const registry = await loadRegistry()
  const users = Object.values(registry).sort((a, b) => {
    if (a.role === 'superadmin') return -1
    if (b.role === 'superadmin') return 1
    return new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime()
  })

  const total = users.length
  // eslint-disable-next-line react-hooks/purity
  const online = users.filter(u => Date.now() - new Date(u.lastLogin).getTime() < 30 * 60 * 1000).length
  const soChatCount = users.filter(u =>
    u.role !== 'superadmin' &&
    u.pages.chat &&
    !u.pages.monitoring && !u.pages.zabbix && !u.pages.whatsapp &&
    !u.pages.datalake && !u.pages.rag && !u.pages.netmeet && !u.pages.dashboards && !u.pages.custos
  ).length

  const PAGE_COLS = [
    { label: 'Dashboard', Icon: BarChart2, colspan: true },
    { label: 'Chat',      Icon: MessageSquare },
    { label: 'NOC',       Icon: Activity },
    { label: 'Zabbix',    Icon: Bell },
    { label: 'WhatsApp',  Icon: Smartphone },
    { label: 'DataLake',  Icon: Database },
    { label: 'RAG',       Icon: Search },
    { label: 'NetMeet',   Icon: Video },
    { label: 'Custos',    Icon: Wallet },
    { label: 'Logout',    Icon: LogOut },
  ]

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans">
      <Sidebar />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col gap-6">

          {/* Cabeçalho */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-[#3B82F6]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                  Controle de Acesso
                </span>
              </div>
              <h1 className="text-2xl font-[900] tracking-[-0.04em] text-[#E6EAF3]">
                Usuários & Permissões
              </h1>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Gerencie quem pode acessar cada módulo do Hub. Alterações entram em vigor no próximo login do usuário.
              </p>
            </div>
            <UsersPageActions />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Usuários cadastrados', value: total, Icon: Users,       color: '#3B82F6' },
              { label: 'Online agora',          value: online, Icon: Wifi,       color: '#3b82f6' },
              { label: 'Só chat habilitado',    value: soChatCount, Icon: Lock, color: '#f59e0b' },
            ].map(({ label, value, Icon, color }) => (
              <div
                key={label}
                className="rounded-2xl border border-border bg-card px-5 py-4 flex items-center gap-4 shadow-[0_2px_12px_rgba(64,64,64,0.05)]"
              >
                <div
                  className="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${color}18` }}
                >
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-2xl font-[900] tracking-[-0.04em]" style={{ color }}>{value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tabela */}
          <div className="rounded-2xl border border-border bg-card shadow-[0_2px_12px_rgba(64,64,64,0.05)] overflow-hidden">

            {/* Legenda dashboard */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-border bg-background/60">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#3B82F6]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Legenda Dashboard:</span>
              </div>
              {[
                { label: '—  Sem acesso',  cls: 'bg-muted text-muted-foreground' },
                { label: 'VER  Somente visualização', cls: 'bg-blue-500 text-white' },
                { label: 'EDI  Criar e editar', cls: 'bg-[#3B82F6] text-white' },
              ].map(({ label, cls }) => (
                <span key={label} className={`text-[9px] font-black uppercase tracking-wide rounded px-1.5 py-0.5 ${cls}`}>
                  {label}
                </span>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 px-5 text-left text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground min-w-[220px]">
                      Usuário
                    </th>
                    <th className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground min-w-[110px]">
                      Status
                    </th>
                    {PAGE_COLS.map(({ label, Icon, colspan }) => (
                      <th
                        key={label}
                        className="py-3 px-3 text-center text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground"
                        style={{ minWidth: colspan ? '110px' : '60px' }}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <Icon className="h-3.5 w-3.5" />
                          <span>{label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-[12px] text-muted-foreground">
                        Nenhum usuário cadastrado ainda. Aguarde o primeiro login.
                      </td>
                    </tr>
                  ) : (
                    users.map(user => (
                      <UserPermissionRow
                        key={user.email}
                        user={user}
                        isSelf={user.email === session.user.email}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {users.length > 0 && (
              <div className="px-5 py-3 border-t border-border bg-background/40">
                <p className="text-[10px] text-muted-foreground">
                  {total} {total === 1 ? 'usuário cadastrado' : 'usuários cadastrados'} · Clique nos ícones para alternar permissões · Alterações entram em vigor no próximo login do usuário
                </p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
