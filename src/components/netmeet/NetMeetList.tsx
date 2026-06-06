'use client'

import { useState } from 'react'
import type { NetMeetMeeting } from '@/modules/netmeet/storage'
import { ChevronDown, ChevronUp, Download, Calendar, User, CheckSquare, ClipboardList, ArrowRight, AlertTriangle } from 'lucide-react'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function displayDate(meeting: NetMeetMeeting) {
  const date = meeting.classification === 'teams-summary' && meeting.meetingDate
    ? meeting.meetingDate
    : meeting.createdAt
  return formatDate(date)
}

function downloadTxt(meeting: NetMeetMeeting) {
  const isTeams = meeting.classification === 'teams-summary'
  const lines: string[] = []
  lines.push(`ATA DE REUNIÃO`)
  lines.push(`Título: ${meeting.title}`)
  lines.push(`Data: ${displayDate(meeting)}`)
  if (meeting.senderName) lines.push(`${isTeams ? 'Organizador' : 'Participante'}: ${meeting.senderName}`)
  lines.push('')
  lines.push('RESUMO')
  lines.push(meeting.summary || 'Sem resumo.')
  if (meeting.decisions.length > 0) {
    lines.push('')
    lines.push('DECISÕES')
    meeting.decisions.forEach(d => lines.push(`• ${d}`))
  }
  if (meeting.actionItems.length > 0) {
    lines.push('')
    lines.push('TAREFAS')
    meeting.actionItems.forEach(t => {
      const due = t.due_date ? ` (prazo: ${t.due_date})` : ''
      lines.push(`• ${t.owner}: ${t.task}${due}`)
    })
  }
  if (meeting.nextSteps && meeting.nextSteps.length > 0) {
    lines.push('')
    lines.push('PRÓXIMOS PASSOS')
    meeting.nextSteps.forEach(s => lines.push(`• ${s}`))
  }
  if (meeting.risks && meeting.risks.length > 0) {
    lines.push('')
    lines.push('PONTOS DE ATENÇÃO')
    meeting.risks.forEach(r => lines.push(`• ${r}`))
  }
  if (meeting.transcript) {
    lines.push('')
    lines.push('TRANSCRIÇÃO COMPLETA')
    lines.push(meeting.transcript)
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ata-${meeting.id}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function MeetingCard({ meeting, isSuperadmin }: { meeting: NetMeetMeeting; isSuperadmin: boolean }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl border border-border bg-card shadow-[0_2px_12px_rgba(64,64,64,0.05)] overflow-hidden">

      {/* Header do card */}
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {meeting.classification === 'teams-summary' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-blue-500">
                Teams
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#3B82F6]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-[#2563EB]">
                WhatsApp
              </span>
            )}
            {meeting.senderName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                <User className="h-2.5 w-2.5" />
                {meeting.classification === 'teams-summary' ? 'Org: ' : ''}{meeting.senderName}
              </span>
            )}
          </div>
          <p className="text-[13px] font-bold text-[#E6EAF3] truncate">{meeting.title}</p>
          <div className="flex items-center gap-1 mt-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">{displayDate(meeting)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => downloadTxt(meeting)}
            title="Baixar ata em TXT"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#3B82F6]/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#2563EB] transition-all hover:bg-[#3B82F6]/20"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground transition-all hover:border-border"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? 'Fechar' : 'Ver ata'}
          </button>
        </div>
      </div>

      {/* Resumo sempre visível */}
      {meeting.summary && (
        <div className="px-5 pb-4">
          <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">{meeting.summary}</p>
        </div>
      )}

      {/* Conteúdo expandido */}
      {expanded && (
        <div className="border-t border-border px-5 py-5 flex flex-col gap-5">

          {/* Decisões */}
          {meeting.decisions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckSquare className="h-3.5 w-3.5 text-[#3B82F6]" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Decisões</p>
              </div>
              <ul className="flex flex-col gap-1.5">
                {meeting.decisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-[#E6EAF3]">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#3B82F6] flex-shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tarefas */}
          {meeting.actionItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="h-3.5 w-3.5 text-[#3B82F6]" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Tarefas</p>
              </div>
              <div className="flex flex-col gap-2">
                {meeting.actionItems.map((t, i) => (
                  <div key={i} className="rounded-xl bg-background border border-border px-3 py-2.5">
                    <p className="text-[11px] font-bold text-[#E6EAF3]">{t.task}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground">Responsável: <span className="font-semibold text-muted-foreground">{t.owner}</span></span>
                      {t.due_date && (
                        <span className="text-[10px] text-muted-foreground">Prazo: <span className="font-semibold text-muted-foreground">{t.due_date}</span></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Próximos Passos */}
          {meeting.nextSteps && meeting.nextSteps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ArrowRight className="h-3.5 w-3.5 text-blue-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Próximos Passos</p>
              </div>
              <ul className="flex flex-col gap-1.5">
                {meeting.nextSteps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-[#E6EAF3]">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pontos de Atenção */}
          {meeting.risks && meeting.risks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Pontos de Atenção</p>
              </div>
              <ul className="flex flex-col gap-1.5">
                {meeting.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-[#E6EAF3]">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcrição */}
          {meeting.transcript && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-3">Transcrição completa</p>
              <div className="rounded-xl bg-background border border-border px-4 py-3 max-h-60 overflow-y-auto custom-scrollbar">
                <p className="text-[12px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{meeting.transcript}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface Props {
  meetings: NetMeetMeeting[]
  isSuperadmin: boolean
}

export function NetMeetList({ meetings, isSuperadmin }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {meetings.map(m => (
        <MeetingCard key={m.id} meeting={m} isSuperadmin={isSuperadmin} />
      ))}
    </div>
  )
}
