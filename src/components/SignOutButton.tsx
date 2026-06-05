'use client'

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-stone-400 transition-all duration-150 hover:bg-red-50 hover:text-red-500"
      title="Sair"
    >
      <LogOut className="h-[18px] w-[18px] flex-shrink-0 transition-all duration-150 group-hover:scale-110" strokeWidth={1.8} />
      <span className="hidden lg:block text-[11px] font-bold uppercase tracking-[0.1em]">Sair</span>
    </button>
  )
}
