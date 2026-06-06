'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { Users } from 'lucide-react';
import { SignOutButton } from '@/components/SignOutButton';
import { LogoMark } from '@/components/brand/Logo';
import { brand } from '@/lib/brand';
import { groupedModules, GROUP_LABELS, type OsModule } from '@/lib/modules';

function NavLink({ item, active }: { item: OsModule; active: boolean }) {
  return (
    <Link
      href={item.href}
      title={item.desc}
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 ${
        active
          ? 'bg-primary-soft text-primary'
          : 'text-slate-400 hover:bg-white/[0.04] hover:text-foreground'
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <item.icon
        className={`h-[18px] w-[18px] flex-shrink-0 transition-all duration-150 ${
          active ? 'text-primary' : 'group-hover:text-foreground'
        }`}
        strokeWidth={active ? 2.4 : 1.8}
      />
      <span
        className={`hidden lg:flex flex-1 items-center justify-between text-[12px] font-bold tracking-[0.01em] whitespace-nowrap ${
          active ? 'text-primary' : 'text-slate-500 group-hover:text-foreground'
        }`}
      >
        {item.label}
        {item.status === 'soon' && (
          <span className="ml-2 rounded-full bg-accent-soft px-1.5 py-px text-[8px] font-black uppercase tracking-[0.12em] text-accent">
            Em breve
          </span>
        )}
      </span>
    </Link>
  );
}

function SidebarNav({ isSuperadmin }: { isSuperadmin: boolean }) {
  const pathname = usePathname();
  const groups = groupedModules();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href);

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto custom-scrollbar px-2.5 py-4">
      {(['principal', 'gestao', 'sistema'] as const).map((g) => (
        <div key={g} className="flex flex-col gap-0.5">
          <p className="mb-1 hidden lg:block px-3 text-[9px] font-black uppercase tracking-[0.22em] text-slate-300">
            {GROUP_LABELS[g]}
          </p>
          {groups[g].map((item) => (
            <NavLink key={item.id} item={item} active={isActive(item.href)} />
          ))}
          {g === 'sistema' && isSuperadmin && (
            <AdminLink active={pathname.startsWith('/settings/users')} />
          )}
        </div>
      ))}
    </nav>
  );
}

function AdminLink({ active }: { active: boolean }) {
  return (
    <Link
      href="/settings/users"
      title="Usuários e permissões"
      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 ${
        active ? 'bg-primary-soft text-primary' : 'text-slate-400 hover:bg-slate-900/[0.04] hover:text-foreground'
      }`}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />}
      <Users className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={active ? 2.4 : 1.8} />
      <span className="hidden lg:block text-[12px] font-bold tracking-[0.01em] whitespace-nowrap">
        Usuários
      </span>
    </Link>
  );
}

export default function Sidebar() {
  const { data: session } = useSession();
  const isSuperadmin = session?.user?.role === 'superadmin' || session?.user?.role === 'admin';

  return (
    <aside className="z-50 flex h-full w-[68px] lg:w-[244px] flex-shrink-0 flex-col border-r border-border bg-card/70 backdrop-blur-xl">
      {/* Marca */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-5 lg:px-5">
        <LogoMark size={38} className="shadow-[0_6px_18px_-6px_rgba(79,70,229,0.55)]" />
        <div className="hidden lg:block min-w-0 leading-none">
          <p className="text-[14px] font-extrabold tracking-[-0.02em] text-foreground">{brand.name}</p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-primary">{brand.subtitle}</p>
        </div>
      </div>

      <Suspense
        fallback={
          <nav className="flex flex-1 flex-col gap-1 px-2.5 py-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-white/[0.05] animate-pulse" />
            ))}
          </nav>
        }
      >
        <SidebarNav isSuperadmin={isSuperadmin} />
      </Suspense>

      <div className="border-t border-border p-2.5">
        <SignOutButton />
      </div>
    </aside>
  );
}
