'use client'

import { useEffect, useState } from 'react'
import { Database, X, Check, Search } from 'lucide-react'

interface Props {
  email: string
  userName: string
  currentTables: string[]
  onClose: () => void
  onSave: (tables: string[]) => void
}

export function TablePermissionsModal({ email, userName, currentTables, onClose, onSave }: Props) {
  const [allTables, setAllTables] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set(currentTables))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/tables')
      .then(r => r.json())
      .then(d => setAllTables(d.tables ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    const tables = Array.from(selected)
    try {
      await fetch(`/api/admin/users/${encodeURIComponent(email)}/tables`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables }),
      })
      onSave(tables)
    } finally {
      setSaving(false)
    }
  }

  function toggle(table: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(table) ? next.delete(table) : next.add(table)
      return next
    })
  }

  function selectAll() { setSelected(new Set(allTables)) }
  function clearAll() { setSelected(new Set()) }

  const filtered = allTables.filter(t => t.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      <div
        className="relative bg-card rounded-2xl shadow-[0_24px_80px_rgba(64,64,64,0.18)] w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Database className="h-4 w-4 text-[#3B82F6]" />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Tabelas do Dashboard</p>
            </div>
            <p className="text-[13px] font-bold text-[#E6EAF3]">{userName}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Search + ações */}
        <div className="px-6 pt-4 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filtrar tabelas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-[12px] border border-border rounded-xl focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
          <button onClick={selectAll} className="text-[10px] font-black uppercase tracking-wide text-[#3B82F6] hover:underline">Todas</button>
          <button onClick={clearAll} className="text-[10px] font-black uppercase tracking-wide text-muted-foreground hover:underline">Nenhuma</button>
        </div>

        {/* Lista */}
        <div className="px-6 py-4 max-h-72 overflow-y-auto custom-scrollbar flex flex-col gap-1">
          {loading && (
            <p className="text-[12px] text-muted-foreground text-center py-6">Carregando tabelas...</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-[12px] text-muted-foreground text-center py-6">Nenhuma tabela encontrada</p>
          )}
          {!loading && filtered.map(table => {
            const isSelected = selected.has(table)
            return (
              <button
                key={table}
                onClick={() => toggle(table)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  isSelected ? 'bg-[#3B82F6]/10 border border-[#3B82F6]/20' : 'hover:bg-background border border-transparent'
                }`}
              >
                <div className={`h-4 w-4 rounded flex-shrink-0 flex items-center justify-center border transition-all ${
                  isSelected ? 'bg-[#3B82F6] border-[#3B82F6]' : 'border-border'
                }`}>
                  {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                </div>
                <span className="text-[12px] font-medium text-[#E6EAF3] font-mono">{table}</span>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {selected.size} de {allTables.length} tabelas selecionadas
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-[11px] font-black uppercase tracking-wide text-muted-foreground rounded-xl border border-border hover:border-border transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white bg-[#3B82F6] rounded-xl shadow-[0_4px_12px_-4px_rgba(141,198,63,0.5)] hover:bg-[#2563EB] transition-all disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
