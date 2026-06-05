'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { useSession } from 'next-auth/react';
import {
  Home, Grid, MessageSquare,
  Settings, Users, Video,
  Activity, Database, Bell, BarChart2,
  Bot, TriangleAlert, Smartphone, TrendingUp,
  Wallet, Star
} from 'lucide-react';
import { SignOutButton } from '@/components/SignOutButton';

const NAV_ITEMS = [
  { icon: Home,          href: '/',                        label: 'Hub' },
  { icon: Grid,          href: '/dashboard',               label: 'Workspace' },
  { icon: BarChart2,     href: '/dashboards',              label: 'Dashboard' },
  { icon: TrendingUp,    href: '/dashboard/protocolos',    label: 'Protocolos' },
  { icon: Bell,          href: '/monitoring/zabbix',       label: 'Zabbix' },
  { icon: Star,          href: '/monitoring/clientes',     label: 'TOP Clientes' },
  { icon: Bot,           href: '/dashboard/comunicacao',   label: 'IA Comunicação' },
  { icon: Smartphone,    href: '/dashboard/whatsapp',      label: 'WhatsApp' },
  { icon: TriangleAlert, href: '/dashboard/alertas',       label: 'Conversas' },
  { icon: Database,      href: '/datalake',                label: 'DataLake' },
  { icon: MessageSquare, href: '/chat',                    label: 'Chat' },
  { icon: Video,         href: '/dashboard/netmeet',       label: 'NetMeet' },
  { icon: Wallet,        href: '/dashboard/custos',        label: 'Custos' },
  { icon: Settings,      href: '/settings',                label: 'Diagnóstico' },
];

function SidebarAdminLink() {
  const pathname = usePathname()
  const isActive = pathname.startsWith('/settings/users')
  return (
    <Link
      href="/settings/users"
      title="Usuários"
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 ${
        isActive ? 'bg-[#8DC63F]/10 text-[#8DC63F]' : 'text-stone-400 hover:bg-[#404040]/5 hover:text-[#404040]'
      }`}
    >
      {isActive && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#8DC63F]" />}
      <Users className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? 'text-[#8DC63F]' : 'group-hover:text-[#404040]'}`} strokeWidth={isActive ? 2.5 : 1.8} />
      <span className={`hidden lg:block text-[11px] font-bold uppercase tracking-[0.1em] whitespace-nowrap ${isActive ? 'text-[#8DC63F]' : 'text-stone-500 group-hover:text-[#404040]'}`}>
        Usuários
      </span>
    </Link>
  )
}

function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href ||
          (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 ${
              isActive
                ? 'bg-[#8DC63F]/10 text-[#8DC63F]'
                : 'text-stone-400 hover:bg-[#404040]/5 hover:text-[#404040]'
            }`}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#8DC63F]" />
            )}
            <item.icon
              className={`h-[18px] w-[18px] flex-shrink-0 transition-all duration-150 ${
                isActive ? 'text-[#8DC63F]' : 'group-hover:text-[#404040]'
              }`}
              strokeWidth={isActive ? 2.5 : 1.8}
            />
            <span className={`hidden lg:block text-[11px] font-bold uppercase tracking-[0.1em] whitespace-nowrap ${
              isActive ? 'text-[#8DC63F]' : 'text-stone-500 group-hover:text-[#404040]'
            }`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  const { data: session } = useSession()
  const isSuperadmin = session?.user?.role === 'superadmin' || session?.user?.role === 'admin'

  return (
    <aside className="z-50 flex h-full w-[72px] lg:w-60 flex-shrink-0 flex-col border-r border-[#404040]/8 bg-white backdrop-blur-xl transition-all duration-300">

      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-[#404040]/6 px-4 py-6 lg:px-5">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[#8DC63F]/12 ring-1 ring-[#8DC63F]/20">
          <div className="h-4 w-4 rounded-full bg-[#8DC63F] shadow-[0_0_10px_rgba(55,152,144,0.4)]" />
        </div>
        <div className="hidden lg:block min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#404040]">
            {process.env.NEXT_PUBLIC_APP_NAME || "G4OS"}
          </p>
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8DC63F]">
            {process.env.NEXT_PUBLIC_APP_SUBTITLE || "Business OS"}
          </p>
        </div>
      </div>

      {/* Nav — isolado em Suspense para que usePathname não dispare antes do router inicializar */}
      <Suspense fallback={
        <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3">
          {NAV_ITEMS.map((item) => (
            <div key={item.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 opacity-30">
              <item.icon className="h-[18px] w-[18px] flex-shrink-0 text-stone-400" strokeWidth={1.8} />
              <span className="hidden lg:block text-[11px] font-bold uppercase tracking-[0.1em] text-stone-400 whitespace-nowrap">
                {item.label}
              </span>
            </div>
          ))}
        </nav>
      }>
        <SidebarNav />
      </Suspense>

      {/* Admin link */}
      {isSuperadmin && (
        <div className="px-2 pb-1">
          <SidebarAdminLink />
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-[#404040]/6 p-2">
        <SignOutButton />
      </div>
    </aside>
  );
}
