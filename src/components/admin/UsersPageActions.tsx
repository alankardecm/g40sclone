'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { PreRegisterModal } from './PreRegisterModal'

export function UsersPageActions() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 rounded-full bg-[#3B82F6] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] text-white shadow-[0_6px_20px_-6px_rgba(141,198,63,0.5)] transition-all hover:-translate-y-0.5 hover:bg-[#2563EB]"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Pré-cadastrar usuário
      </button>

      {showModal && (
        <PreRegisterModal
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false)
            window.location.reload()
          }}
        />
      )}
    </>
  )
}
