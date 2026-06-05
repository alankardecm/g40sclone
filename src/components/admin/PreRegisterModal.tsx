'use client'

import { useState } from 'react'
import { X, UserPlus } from 'lucide-react'

interface Props {
  onClose: () => void
  onSave: (name: string, email: string) => void
}

export function PreRegisterModal({ onClose, onSave }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    const trimName = name.trim()
    const trimEmail = email.trim().toLowerCase()

    if (!trimName || !trimEmail) {
      setError('Preencha nome e email.')
      return
    }
    if (!trimEmail.includes('@')) {
      setError('Email inválido.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users/pre-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimName, email: trimEmail }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Erro ao salvar.')
        return
      }
      onSave(trimName, trimEmail)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      <div
        className="relative bg-white rounded-2xl shadow-[0_24px_80px_rgba(64,64,64,0.18)] w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-[#8DC63F]" />
            <p className="text-[13px] font-bold text-[#404040]">Pré-cadastrar usuário</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            O usuário poderá usar o bot do WhatsApp sem precisar acessar o Hub. Ao fazer o primeiro login, será automaticamente ativado.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Nome</label>
            <input
              type="text"
              placeholder="João Silva"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-[#8DC63F]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Email corporativo</label>
            <input
              type="email"
              placeholder="joao.silva@netturbo.com.br"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="w-full px-3 py-2.5 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:border-[#8DC63F] font-mono"
            />
          </div>

          {error && (
            <p className="text-[11px] text-red-500 font-semibold">{error}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-[11px] font-black uppercase tracking-wide text-gray-400 rounded-xl border border-gray-200 hover:border-gray-300">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white bg-[#8DC63F] rounded-xl hover:bg-[#7ab030] disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
