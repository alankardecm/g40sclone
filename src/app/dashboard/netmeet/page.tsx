import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { readMeetings } from '@/modules/netmeet/storage'
import type { NetMeetMeeting } from '@/modules/netmeet/storage'
import Sidebar from '@/components/Sidebar'
import { NetMeetList } from '@/components/netmeet/NetMeetList'
import { Video, Mic } from 'lucide-react'

export default async function NetMeetPage() {
  const session = await auth()
  if (!session) redirect('/auth/signin')

  const all = await readMeetings()
  const isSuperadmin = session.user.role === 'superadmin'
  const userEmail = session.user.email ?? ''

  // Superadmin vê tudo, usuário vê as suas (organizador ou opt-in)
  const meetings: NetMeetMeeting[] = isSuperadmin
    ? all
    : all.filter(m =>
        m.userEmail === userEmail ||
        (m.recipients ?? []).includes(userEmail)
      )

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-background text-foreground font-sans">
      <Sidebar />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-4xl px-6 py-8 flex flex-col gap-6">

          {/* Cabeçalho */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Video className="h-4 w-4 text-[#8DC63F]" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
                NetMeet
              </span>
            </div>
            <h1 className="text-2xl font-[900] tracking-[-0.04em] text-[#404040]">
              {isSuperadmin ? 'Todas as Reuniões' : 'Minhas Reuniões'}
            </h1>
            <p className="mt-1 text-[12px] text-gray-400">
              {isSuperadmin
                ? `${meetings.length} ata${meetings.length !== 1 ? 's' : ''} registrada${meetings.length !== 1 ? 's' : ''} no sistema`
                : 'Atas de áudio (WhatsApp) e resumos de reuniões Teams'}
            </p>
          </div>

          {/* Estado vazio */}
          {meetings.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
              <div className="flex justify-center mb-4">
                <div className="h-14 w-14 rounded-2xl bg-[#8DC63F]/10 flex items-center justify-center">
                  <Mic className="h-6 w-6 text-[#8DC63F]" strokeWidth={1.5} />
                </div>
              </div>
              <p className="text-[13px] font-bold text-[#404040] mb-2">Nenhuma ata encontrada</p>
              <p className="text-[12px] text-gray-400 max-w-sm mx-auto leading-relaxed">
                Envie um áudio no WhatsApp para o número do Hub. Na primeira vez, o bot vai pedir
                seu email corporativo para vincular as atas à sua conta.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-[11px] font-black uppercase tracking-[0.15em] text-gray-500">
                <Mic className="h-3 w-3" />
                Envie áudio para: +55 19 99678-0064
              </div>
            </div>
          )}

          {/* Lista */}
          {meetings.length > 0 && (
            <NetMeetList meetings={meetings} isSuperadmin={isSuperadmin} />
          )}

        </div>
      </main>
    </div>
  )
}
